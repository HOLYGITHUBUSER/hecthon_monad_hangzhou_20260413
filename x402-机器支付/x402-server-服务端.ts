/**
 * AgentVault x402 Server — 付费 API 示例服务端
 *
 * 实现 HTTP 402 协议：未付费请求返回 402 + 支付信息，验证支付后返回资源。
 * 适合做"Agent 按次付费调用 API"的场景。
 *
 * 启动: npx tsx x402-机器支付/x402-server-服务端.ts
 *
 * 端口: 3001
 */
import http from "http";
import fs from "fs";
import path from "path";

// ============ 配置 ============

const PORT = 3001;

// 从 deployment.json 读取合约地址
const deploymentPath = path.join(process.cwd(), "deployment.json");
let VAULT_ADDRESS = "0x0000000000000000000000000000000000000000";
let API_PROVIDER_ADDRESS = "0x2C7c26E395A5861380451CcCFf303F58Feb190D9"; // API 收款方（合约 Owner）
try {
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  VAULT_ADDRESS = deployment.address;
} catch {
  console.warn("[x402-server] deployment.json not found, using zero address");
}

// ============ 付费 API 定义 ============

interface PaidAPI {
  path: string;
  price: string;       // MON
  description: string;
  response: any;       // 返回数据
}

const APIS: Record<string, PaidAPI> = {
  "/api/gpt4": {
    path: "/api/gpt4",
    price: "0.005",
    description: "GPT-4 API 调用",
    response: { model: "gpt-4", result: "This is a simulated GPT-4 response", tokens: 150 },
  },
  "/api/gpu": {
    path: "/api/gpu",
    price: "0.01",
    description: "GPU 集群租用",
    response: { gpu: "A100", status: "allocated", hours: 1, jobId: "gpu-" + Date.now() },
  },
  "/api/data": {
    path: "/api/data",
    price: "0.002",
    description: "数据集下载",
    response: { dataset: "monad-transactions", records: 10000, format: "json" },
  },
  "/api/storage": {
    path: "/api/storage",
    price: "0.003",
    description: "去中心化存储",
    response: { storage: "1GB", provider: "monad-storage", cid: "QmXxxx" },
  },
  "/api/weather": {
    path: "/api/weather",
    price: "0.002",
    description: "天气数据查询",
    response: { city: "Hangzhou", temp: 22, humidity: 65, condition: "Cloudy" },
  },
};

// ============ 已验证支付缓存 ============

const verifiedPayments = new Map<string, { amount: string; recipient: string; timestamp: number }>();

// ============ HTTP Server ============

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Payment-Receipt, X-Payment-Amount, X-Payment-Recipient, X-Agent-Id, X-Task-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API 列表
  if (url.pathname === "/api") {
    const list = Object.values(APIS).map(api => ({
      path: api.path,
      price: api.price + " MON",
      description: api.description,
    }));
    jsonResponse(res, 200, { apis: list, vault: VAULT_ADDRESS });
    return;
  }

  // 付费 API
  const api = APIS[url.pathname];
  if (!api) {
    jsonResponse(res, 404, { error: "API not found. Visit /api for available APIs." });
    return;
  }

  // 检查支付凭证
  const receipt = req.headers["x-payment-receipt"] as string;
  const paymentAmount = req.headers["x-payment-amount"] as string;
  const paymentRecipient = req.headers["x-payment-recipient"] as string;

  if (receipt && paymentAmount && paymentRecipient) {
    // 验证支付：金额匹配 + 收款方是合约地址
    if (paymentAmount === api.price) {
      // 检查是否已使用（防重放）
      if (verifiedPayments.has(receipt)) {
        jsonResponse(res, 402, {
          error: "Payment receipt already used",
          payTo: API_PROVIDER_ADDRESS,
          amount: api.price,
          resource: api.description,
        });
        return;
      }

      // 标记已使用
      verifiedPayments.set(receipt, {
        amount: paymentAmount,
        recipient: paymentRecipient,
        timestamp: Date.now(),
      });

      console.log(`[x402-server] Payment verified for ${url.pathname}: ${api.price} MON, receipt: ${receipt.slice(0, 16)}...`);

      // 返回资源
      jsonResponse(res, 200, {
        ...api.response,
        receipt: { txHash: receipt, amount: api.price, paidAt: new Date().toISOString() },
      });
      return;
    } else {
      jsonResponse(res, 402, {
        error: "Invalid payment: amount or recipient mismatch",
        expected: { amount: api.price, payTo: API_PROVIDER_ADDRESS },
        received: { amount: paymentAmount, recipient: paymentRecipient },
      });
      return;
    }
  }

  // 未付费 → 返回 402
  console.log(`[x402-server] 402 for ${url.pathname}: ${api.price} MON required`);
  res.writeHead(402, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: 402,
    error: "Payment Required",
    payTo: API_PROVIDER_ADDRESS,
    amount: api.price,
    resource: api.description,
    network: "monad-testnet",
    paymentId: `pay-${Date.now()}`,
    message: `This API costs ${api.price} MON. Pay to ${VAULT_ADDRESS} and retry with X-Payment-Receipt header.`,
  }));
});

function jsonResponse(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

// ============ 启动 ============

server.listen(PORT, () => {
  console.log(`[x402-server] Paid API server running on http://localhost:${PORT}`);
  console.log(`[x402-server] Vault address: ${VAULT_ADDRESS}`);
  console.log(`[x402-server] Available APIs:`);
  Object.values(APIS).forEach(api => {
    console.log(`  ${api.path} — ${api.price} MON — ${api.description}`);
  });
  console.log(`[x402-server] Visit http://localhost:${PORT}/api for API list`);
});
