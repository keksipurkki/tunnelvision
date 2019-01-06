import * as fs from "fs";
import { URL } from "url";
import * as SSH from "ssh2";
import * as http from "http";
import * as net from "net";
import makeLogger from "./ssh-logging";
import * as config from "../package.json";

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

function getAddressInfo(connection: SSH.Connection): Promise<net.AddressInfo> {
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
  const headers = [
    ...req.rawHeaders,
    "X-Tunnel-Server",
    `${config.name};version=${config.version}`
  ];
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

function canTunnel() {
  return Object.keys(tunnels).length <= Number(process.env.MAX_CONNECTIONS);
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
    const [info, shell] = await Promise.all([
      getAddressInfo(authenticated),
      getShell(authenticated)
    ]);
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

    if (!canTunnel()) {
      authenticated.emit("error", new Error(`Run out of resources. Try again later. Sorry!`));
      return;
    }

    if (tunnels[url.hostname]) {
      authenticated.emit("error", new Error(`Domain ${url.hostname} is already in use`));
    } else {
      logging.info(`Starting the tunnel`);
      logging.info(`Remote endpoint is available at ${url}. Press ^C to stop`);
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
      res.writeHead(404);
      res.end();
      return;
    }
    const tunnel = tunnels[hostname];
    tunnel(req, res);
  });

  return server;
};
