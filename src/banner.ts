import chalk from "chalk";
import * as net from "net";

function banner(server: net.Server) {
  const { port } = server.address() as net.AddressInfo;
  return chalk`
   {green {blue [i]} Started the tunnel. Press ^C to stop  }
\n\r`;
}

export default banner;
