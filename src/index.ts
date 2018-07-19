import * as fs from "fs";
import ssh from "./server";

const hostKey = `${process.env.HOME}/.ssh/proxy.pem`;

const sshConfig = {
  hostKeys: [fs.readFileSync(hostKey)]
};

const server = ssh(sshConfig);
server.listen(22);
