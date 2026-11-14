// Stands in for the Resend API in tests. Records every message; GET /sent?to= returns them.
import http from "http";
const sent = [];
http.createServer((req, res) => {
  if (req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { if (process.env.FAIL === "1") { res.statusCode = 500; return res.end("{}"); } const j = JSON.parse(b); sent.push({ auth: req.headers.authorization, ...j }); res.end('{"id":"x"}'); }); return; }
  const to = new URL(req.url, "http://x").searchParams.get("to");
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify(sent.filter((m) => !to || m.to.includes(to))));
}).listen(3198);
