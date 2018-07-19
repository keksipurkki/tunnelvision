import * as http from "http";

export default http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.write(JSON.stringify({ message: "pong" }));
  res.end();
});
