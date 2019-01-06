import chalk from "chalk";
import { Writable } from "stream";
import * as http from "http";

export default (writable: Writable) => ({
  error(message: string) {
    return writable.write(chalk`{red [e]} ${message}\n\r`);
  },
  info(message: string) {
    return writable.write(chalk`{blue [i]} ${message}\n\r`);
  },
  http(request: http.IncomingMessage) {
    const { port, address } = request.connection.address();
    return writable.write(
      `[${new Date().toISOString()}]: ${request.method} ${request.url} (${address}:${port})\n\r`
    );
  }
});
