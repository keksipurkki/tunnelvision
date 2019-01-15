import * as http from "http";
import * as express from "express";
import { URL } from "url";
import ssh from "./ssh";

const SSH_PORT = Number(process.env.SSH_PORT);
const PROXY_PORT = Number(process.env.PROXY_PORT);
const HTTP_PORT = Number(process.env.HTTP_PORT);

function homepage(): URL {
  return new URL(`http://${process.env.DOMAIN}`);
}

console.log(`
===============================================================================

Starting tunnelvision in environment '${process.env.NODE_ENV}'

Image: ${process.env.COMMIT}
Documentation: ${homepage()}

===============================================================================
`);

const sshServer = ssh();

const proxy = http.createServer(req => {
  sshServer.emit("tunnel", req);
});

const httpServer = express();
httpServer.use("/", express.static(__dirname + "/../public"));

try {
  proxy.listen(PROXY_PORT, () => {
    console.log(`Proxy server is up`);
  });
  sshServer.listen(SSH_PORT, () => {
    console.log(`SSH server is up`);
  });
  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP server is up`);
  });
} catch (error) {
  console.error(`Failed to start tunnelvision`);
  console.error(error);
  process.exit(1);
}
