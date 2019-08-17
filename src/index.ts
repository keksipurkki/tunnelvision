import * as http from "http";
import assert from "assert";
import { homepage } from "./utils";
import ssh from "./ssh";
import { hostKeys } from "./ssh-keys";

const SSH_PORT = 2000;
const PROXY_PORT = 3000;

assert(process.env.NODE_ENV, "NODE_ENV is required");

async function main(..._args: string[]) {
  console.log(`
===============================================================================

Starting tunnelvision in environment '${process.env.NODE_ENV}'
Documentation: ${homepage()}

===============================================================================
`);

  try {

    const keys = await hostKeys();
    const maxConnections = Number(process.env.MAX_CONNECTIONS) || 50;
    const sshServer = ssh(keys, { maxConnections });

    const proxy = http.createServer(req => {
      sshServer.emit("tunnel", req);
    });

    proxy.listen(PROXY_PORT, () => {
      console.log(`Proxy server is up`);
    });

    sshServer.listen(SSH_PORT, () => {
      console.log(`SSH server is up`);
    });

  } catch (error) {
    console.error(`Failed to start tunnelvision`);
    console.error(error);
    process.exit(1);
  }
}

main(...process.argv.slice(2));
