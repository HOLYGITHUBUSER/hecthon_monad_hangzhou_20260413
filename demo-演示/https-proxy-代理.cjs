const https = require("https");
const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const certDir = path.join(__dirname, ".certs");
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
const keyFile = path.join(certDir, "key.pem");
const certFile = path.join(certDir, "cert.pem");

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  console.log("Generating self-signed certificate...");
  try {
    const hostIP = process.env.HOST_IP || "localhost";
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/CN=${hostIP}"`, { stdio: "pipe" });
    console.log("Certificate generated.");
  } catch (e) {
    console.error("openssl not found.");
    process.exit(1);
  }
}

const key = fs.readFileSync(keyFile);
const cert = fs.readFileSync(certFile);

const TARGETS = {
  18443: { targetHost: "127.0.0.1", targetPort: 18789, name: "OpenClaw" },
  18444: { targetHost: "127.0.0.1", targetPort: 5173, name: "Frontend Dashboard" },
};

Object.entries(TARGETS).forEach(([port, cfg]) => {
  const server = https.createServer({ key, cert }, (req, res) => {
    // HTTP proxy
    const options = {
      hostname: cfg.targetHost,
      port: cfg.targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${cfg.targetHost}:${cfg.targetPort}` },
    };
    const proxy = http.request(options, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res, { end: true });
    });
    proxy.on("error", (e) => { res.writeHead(502); res.end("Proxy error: " + e.message); });
    req.pipe(proxy, { end: true });
  });

  // WebSocket upgrade handler
  server.on("upgrade", (req, socket, head) => {
    console.log(`[WS] ${cfg.name}: ${req.url}`);
    const wsReq = http.request({
      hostname: cfg.targetHost,
      port: cfg.targetPort,
      path: req.url,
      method: "GET",
      headers: {
        ...req.headers,
        host: `${cfg.targetHost}:${cfg.targetPort}`,
        connection: "upgrade",
        upgrade: req.headers.upgrade || "websocket",
      },
    });
    wsReq.on("upgrade", (pRes, pSocket, pHead) => {
      pSocket.on("error", () => socket.destroy());
      socket.on("error", () => pSocket.destroy());
      socket.write("HTTP/1.1 101 Switching Protocols\r\n");
      Object.entries(pRes.headers).forEach(([k, v]) => {
        socket.write(`${k}: ${v}\r\n`);
      });
      socket.write("\r\n");
      if (pHead && pHead.length) socket.write(pHead);
      pSocket.pipe(socket);
      socket.pipe(pSocket);
    });
    wsReq.on("error", (e) => { console.error(`[WS Error] ${e.message}`); socket.destroy(); });
    wsReq.end();
  });

  server.listen(Number(port), "0.0.0.0", () => {
    const hostIP = process.env.HOST_IP || "localhost";
    console.log(`${cfg.name}: https://${hostIP}:${port} -> http://${cfg.targetHost}:${cfg.targetPort}`);
  });
});

console.log('\nFirst visit will show security warning -> click Advanced -> Proceed anyway');
console.log('This is due to self-signed cert, safe to proceed\n');
