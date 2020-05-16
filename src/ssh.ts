import * as fs from "fs";
import { URL } from "url";
import * as SSH from "ssh2";
import * as http from "http";
import * as net from "net";
import { tunnelEndpoint } from "./utils";
import makeLogger from "./ssh-logging";
import * as config from "../package.json";

interface AuthenticatedConnection {
  username: string;
  connection: SSH.Connection;
}

type Callback = (error: Error | undefined, socket: SSH.ServerChannel) => void;

interface TunnelPool {
  [domain: string]: {
    connection: SSH.Connection;
    tunnel(addr: string, port: number, cb: Callback): void;
  };
}

const tunnels: TunnelPool = {};

// Accept all incoming connections
function authenticate(connection: SSH.Connection): Promise<AuthenticatedConnection> {
  return new Promise((resolve, _reject) => {
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
  return new Promise((resolve, _reject) => {
    connection.on("session", getSession => {
      const session = getSession();
      session.on("pty", (_accept, reject, _info) => {
        reject && reject();
      });
      session.on("shell", accept => {
        resolve(accept());
      });
    });
  });
}

function getAddressInfo(connection: SSH.Connection): Promise<net.AddressInfo> {
  const promise = new Promise((resolve, _reject) => {
    connection.on("request", (accept, deny, name, { bindAddr: address, bindPort: port }) => {
      if (name === "tcpip-forward") {
        accept && accept();
      } else {
        return deny && deny();
      }
      resolve({ family: "", address, port });
    });
  });
  const timeout = new Promise((_resolve, reject) =>
    setTimeout(reject, 30000, new Error("Timeout reached"))
  );
  return Promise.race([promise, timeout]) as Promise<net.AddressInfo>;
}

function chunk<T>(arr: T[], size: number) {
  const copy = [...arr];
  const results = [];
  while (copy.length) {
    results.push(copy.splice(0, size));
  }
  return results;
}

function httpMessage(req: http.IncomingMessage) {
  const CRLF = "\r\n";
  const headers = [
    ...req.rawHeaders,
    "X-Tunnel-Server",
    `${config.name};version=${config.version}`
  ];
  const lines = [
    `${req.method} ${req.url} HTTP/${req.httpVersion}`,
    ...chunk(headers, 2).map(h => h.join(": ")),
    `${CRLF}${CRLF}`
  ];
  return lines.join(CRLF);
}

export default (hostKeys: string[], { maxConnections = 1 } = {}) => {

  function canTunnel() {
    return Object.keys(tunnels).length <= Number(maxConnections);
  }

  const server = new SSH.Server({
    hostKeys: hostKeys.map(fname => fs.readFileSync(fname))
  });

  server.on("connection", async (connection, { ip }) => {

    console.log(`Client connected (${ip})`);
    connection.on("end", () => console.log(`Client disconnected (${ip})`));

    try {

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

      if (!canTunnel()) {
        const error = new Error(`The server has run out of resources. Try again later. Sorry!`);
        authenticated.emit("error", error);
        return;
      }

      if (tunnels[url.hostname]) {
        authenticated.emit("error", new Error(`Domain ${url.hostname} is already in use`));
        return;
      }

      logging.info(`Starting the tunnel`);
      logging.info(`Remote endpoint is available at ${url}`);
      logging.info(`Press ^C to stop`);

      tunnels[url.hostname] = {
        connection: authenticated,
        tunnel: authenticated.forwardOut.bind(authenticated, info.address, info.port)
      };

      authenticated.on("tunnel", (req: http.IncomingMessage) => {
        logging.access(req);
      });

      authenticated.on("end", () => { delete tunnels[url.hostname]; });

    } catch (error) {
      connection.end();
    }

  });

  server.on("tunnel", (req: http.IncomingMessage) => {

    const url = new URL(`http://${req.headers.host}`);
    const hostname = url.hostname;

    if (!tunnels[hostname]) {
      req.socket.end();
      return;
    }

    const { port, address } = req.socket.address();
    const { tunnel, connection } = tunnels[hostname];

    tunnel(address, port, (error, localhost) => {
      if (error) {
        connection.emit("error", error);
        return;
      }
      connection.emit("tunnel", req);
      req.socket.pipe(localhost).pipe(req.socket);
      localhost.write(httpMessage(req));
    });
  });

  server.on("error", (error) => {
    console.error(error);
  });

  return server;
};
