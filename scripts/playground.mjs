// Serves the playground page for trying the extension: npm start
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const port = Number(process.env.PORT) || 4173;
const page = new URL("../playground/index.html", import.meta.url);

createServer(async (req, res) => {
  if (req.url !== "/" && req.url !== "/index.html") {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(await readFile(page));
}).listen(port, "127.0.0.1", () => {
  console.log(`Socrates playground: http://127.0.0.1:${port}`);
});
