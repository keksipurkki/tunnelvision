import { Stream, Writable } from "stream";
import chalk from "chalk";
import * as SSH from "ssh2";
import * as net from "net";

interface TunnelEvent {
  origin: net.AddressInfo;
  stream: Stream;
}

function banner(server: net.Server) {
  const { port } = server.address() as net.AddressInfo;
  return chalk`
   {green {blue [i]} Started the tunnel. Press ^C to stop  }
\n\r`;
}

function consume(stream: Stream): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", chunks.push.bind(chunks));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function formatted(request: string, { address, port }: net.AddressInfo) {
  const [requestLine, ...headers] = request.split(/[\r\n]+/);
  return `[${new Date().toISOString()}]: ${requestLine} (${address}:${port})\n\r`;
}

function tunnel(connection: SSH.Connection, src: net.AddressInfo) {
  return (sink: net.Socket) => {
    const { address, port } = sink.address() as net.AddressInfo;
    connection.forwardOut(src.address, src.port, address, port, (error, response) => {
      if (error) {
        throw error;
      }
      connection.emit("tunnel", {
        origin: sink.address(),
        stream: sink.pipe(response).pipe(sink)
      });
    });
  };
}

function authenticate(connection: SSH.Connection): Promise<SSH.Connection> {
  return new Promise(resolve => {
    connection.on("authentication", context => context.accept()).on("ready", () => resolve(connection));
  });
}

function bind(connection: SSH.Connection): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    connection.on("request", (accept, reject, name, { bindAddr: address, bindPort: port }) => {
      if (name === "tcpip-forward") {
        accept();
      } else {
        return reject();
      }
      const server = net.createServer();
      server.on("connection", tunnel(connection, { family: "", address, port }));
      server.listen(443, "0.0.0.0", () => resolve(server));
    });
  });
}

function getSession(connection: SSH.Connection): Promise<SSH.ServerChannel> {
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

export default (config: SSH.ServerConfig) =>
  new SSH.Server(config, async (connection, { ip }) => {
    console.log(`Client connected (${ip})`);
    const authenticated = await authenticate(connection);
    const [server, shell] = await Promise.all([bind(authenticated), getSession(authenticated)]);
    shell.write(banner(server));
    authenticated
      .on("tunnel", ({ stream, origin }: TunnelEvent) => {
        consume(stream)
          .then(req => shell.write(formatted(req, origin)))
          .catch(error => authenticated.emit("error", error));
      })
      .on("end", () => {
        server.close();
        console.log(`Client disconnected (${ip})`);
      })
      .on("error", (error) => {
        shell.write(`[e] Caught an unexpected error. Aborting.`);
        console.error(error);
      });
  });
