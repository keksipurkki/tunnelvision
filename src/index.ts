import * as fs from "fs";
import ssh from "./server";
import health from "./health";

const hostKeys = [
  "/etc/ssh/ssh_host_ecdsa_key",
  "/etc/ssh/ssh_host_rsa_key"
];

const sshConfig = {
  hostKeys: hostKeys.map(fname => fs.readFileSync(fname))
};

const server = ssh(sshConfig);
console.log(`
==================================================================

Starting the tunnel server in environment '${process.env.NODE_ENV}'

==================================================================
`);

server.listen(22);
health.listen(8080);
