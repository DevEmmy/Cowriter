// A stand-in detector service for tests only: GPTZero-shaped and Originality-shaped endpoints.
import http from "node:http";
http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
    const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.url === "/v2/predict/text") return req.headers["x-api-key"] === "fake" ? send(200, { documents: [{ class_probabilities: { ai: 0.12, human: 0.88 }, predicted_class: "human" }], echoedWords: JSON.parse(body).document.split(" ").length }) : send(401, { error: "bad key" });
    if (req.url === "/api/v1/scan/ai") return send(200, { success: true, surprise: "no score here" });
    send(404, {});
  });
}).listen(3199, () => console.log("fake detector on 3199"));
