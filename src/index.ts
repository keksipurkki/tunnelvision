import * as net from "net";
import * as http from "http";
import * as assert from "assert";
import { URL } from "url";
import ssh from "./ssh";

const SSH_PORT = Number(process.env.SSH_PORT);
const PROXY_PORT = Number(process.env.PROXY_PORT);
const HTTP_PORT = Number(process.env.HTTP_PORT);

console.log(`
==================================================================

Starting tunnelvision in environment '${process.env.NODE_ENV}'

==================================================================
`);

const sshServer = ssh();

const proxy = http.createServer((req, res) => {
  sshServer.emit("tunnel", req, res);
});

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write(`Write the docs...`);
  res.end();
});

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
