import { Stream, Writable } from "stream";
import * as fs from "fs";
import chalk from "chalk";
import { URL } from "url";
import * as SSH from "ssh2";
import * as http from "http";
import * as net from "net";
import makeLogger from "./ssh-logging";

interface AuthenticatedConnection {
  username: string;
  connection: SSH.Connection;
}

type TunnelFactory = (addr: string, port: number) => Tunnel;
type Tunnel = (req: http.IncomingMessage, res: http.ServerResponse) => void;

interface TunnelPool {
  [domain: string]: Tunnel;
}

const tunnels: TunnelPool = {};

// Accept all incoming connections
function authenticate(connection: SSH.Connection): Promise<AuthenticatedConnection> {
  return new Promise((resolve, reject) => {
    let username = "";
    connection
      .on("authentication", context => {
        username = context.username;
        context.accept();
      })
      .on("ready", () => resolve({ username, connection }));
  });
}

// Allocate a shell for connecting clients
function getShell(connection: SSH.Connection): Promise<SSH.ServerChannel> {
  return new Promise((resolve, reject) => {
    connection.on("session", getSession => {
      const session = getSession();
      session.on("pty", (accept, reject, info) => {
        reject();
      });
      session.on("shell", accept => {
        resolve(accept());
      });
    });
  });
}

function bind(connection: SSH.Connection): Promise<net.AddressInfo> {
  return new Promise((resolve, reject) => {
    connection.on("request", (accept, deny, name, { bindAddr: address, bindPort: port }) => {
      if (name === "tcpip-forward") {
        accept();
      } else {
        return deny();
      }
      resolve({ family: "", address, port });
    });
  });
}

function httpMessage(req: http.IncomingMessage) {
  const headers = [...req.rawHeaders, "X-Tunnel-Server", "tunnelvision"];
  return [
    `${req.method} ${req.url} HTTP/${req.httpVersion}`,
    headers.map((h, i) => (i % 2 === 0 ? h + ": " : h + "\r\n")).join(""),
    "\r\n\r\n"
  ].join("\r\n");
}

function tunnelEndpoint(prefix: string): URL {
  const url = new URL(`https://${prefix}.${process.env.DOMAIN}`);
  if (process.env.NODE_ENV !== "production") {
    url.protocol = "http";
  }
  return url;
}

export default () => {
  const hostKeys = ["/etc/ssh/ssh_host_ecdsa_key", "/etc/ssh/ssh_host_rsa_key"];

  const config = {
    hostKeys: hostKeys.map(fname => fs.readFileSync(fname))
  };

  const server = new SSH.Server(config);

  server.on("connection", async (connection, { ip }) => {
    console.log(`Client connected (${ip})`);
    const { username, connection: authenticated } = await authenticate(connection);
    const [info, shell] = await Promise.all([bind(authenticated), getShell(authenticated)]);
    const url = tunnelEndpoint(username);
    const logging = makeLogger(shell);

    authenticated.on("error", error => {
      logging.error(`${error.message || "Caught an unexpected error"}. Aborting.`);
      shell.end();
    });

    const makeTunnel: TunnelFactory = (bindAddr, bindPort) => (req, res) => {
      const { port, address } = req.socket.address();
      authenticated.forwardOut(bindAddr, bindPort, address, port, (error, localhost) => {
        if (error) {
          logging.error(error.message);
          return;
        }
        logging.http(req);
        req.socket.pipe(localhost).pipe(req.socket);
        localhost.write(httpMessage(req));
      });
    };

    if (tunnels[url.hostname]) {
      authenticated.emit("error", new Error(`Domain ${url.hostname} is already in use`));
    } else {
      logging.info(`Starting the tunnel. Remote endpoint is available at ${url}. Press ^C to stop.`);
      tunnels[url.hostname] = makeTunnel(info.address, info.port);
      authenticated.on("end", () => {
        delete tunnels[url.hostname];
        console.log(`Client disconnected (${ip})`);
      });
    }
  });

  server.on("tunnel", (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(`http://${req.headers.host}`);
    const hostname = url.hostname;
    if (!tunnels[hostname]) {
      return;
    }
    const tunnel = tunnels[hostname];
    console.log(`Found a tunnel for request from ${req.socket.address().address}`);
    tunnel(req, res);
  });

  return server;
};
