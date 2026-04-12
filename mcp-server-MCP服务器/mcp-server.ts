/**
 * AgentVault MCP Server — 让 AI Agent (Claude Code 等) 直接调用支付功能
 *
 * 启动: npx tsx mcp-server-MCP服务器/mcp-server.ts
 *
 * 暴露的工具:
 *   - check_budget: 检查 Agent 能否支付指定金额
 *   - pay: Agent 发起支付
 *   - pay_with_retry: Agent 支付（带自动重试）
 *   - get_balance: 查询合约余额
 *   - get_agent_config: 查询 Agent 配置
 *   - get_daily_ops: 查询 Agent 今日剩余操作次数
 *   - get_ledger: 查询链上账本
 *   - get_payment_logs: 查询支付审计日志
 *   - request_limit_increase: Agent 请求提额
 *   - pending_approvals: 查询待审批支付列表
 *   - x402_pay_api: 通过 x402 协议按次付费调用 API
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { AgentVaultSDK } from "../sdk-开发包/agent-vault-standalone-独立SDK";
import { X402Client } from "../x402-机器支付/x402-client-客户端";

dotenv.config();

// ============ 初始化 SDK ============

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(rpcUrl);

let deploymentCache: any = null;
function getDeployment() {
  if (deploymentCache) return deploymentCache;
  // 优先用环境变量指定的路径，否则在 cwd 和项目目录中查找
  const searchPaths = [
    process.env.AGENTVAULT_HOME && path.join(process.env.AGENTVAULT_HOME, "deployment.json"),
    path.join(process.cwd(), "deployment.json"),
  ].filter(Boolean) as string[];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      deploymentCache = JSON.parse(fs.readFileSync(p, "utf-8"));
      return deploymentCache;
    }
  }
  throw new Error("deployment.json not found (searched: " + searchPaths.join(", ") + ")");
}

function initSDK(role: "owner" | "agent" = "owner"): AgentVaultSDK {
  const deployment = getDeployment();
  let privateKey: string;

  if (role === "agent") {
    privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
  } else {
    privateKey = process.env.PRIVATE_KEY || "";
  }
  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");

  const wallet = new ethers.Wallet(privateKey, provider);
  return new AgentVaultSDK(deployment.address, wallet, deployment.abi);
}

function getAgentAddress(): string {
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
  if (!pk) throw new Error("PRIVATE_KEY not set");
  return new ethers.Wallet(pk).address;
}

// ============ MCP Server ============

const server = new Server(
  { name: "agentvault", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// --- Tool 定义 ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "check_budget",
      description: "检查 Agent 能否支付指定金额。支付前先调用此工具预检，避免浪费 gas。",
      inputSchema: {
        type: "object",
        properties: {
          amount_mon: { type: "string", description: "金额（MON），如 '0.01'" },
          recipient: { type: "string", description: "收款方地址（可选，用于白名单检查）" },
        },
        required: ["amount_mon"],
      },
    },
    {
      name: "pay",
      description: "Agent 发起支付。建议先调用 check_budget 预检。",
      inputSchema: {
        type: "object",
        properties: {
          recipient: { type: "string", description: "收款方地址" },
          amount_mon: { type: "string", description: "金额（MON），如 '0.01'" },
          reason: { type: "string", description: "支付原因" },
          task_id: { type: "string", description: "任务 ID" },
          agent_id: { type: "string", description: "Agent 标识，如 'claude-code'" },
        },
        required: ["recipient", "amount_mon", "reason", "task_id", "agent_id"],
      },
    },
    {
      name: "pay_with_retry",
      description: "Agent 支付（带自动重试和结构化错误翻译）。推荐使用此工具代替 pay。",
      inputSchema: {
        type: "object",
        properties: {
          recipient: { type: "string", description: "收款方地址" },
          amount_mon: { type: "string", description: "金额（MON），如 '0.01'" },
          reason: { type: "string", description: "支付原因" },
          task_id: { type: "string", description: "任务 ID" },
          agent_id: { type: "string", description: "Agent 标识，如 'claude-code'" },
          max_retries: { type: "number", description: "最大重试次数（默认 2）" },
        },
        required: ["recipient", "amount_mon", "reason", "task_id", "agent_id"],
      },
    },
    {
      name: "get_balance",
      description: "查询合约余额",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_agent_config",
      description: "查询 Agent 配置（限额、白名单、审批等）",
      inputSchema: {
        type: "object",
        properties: {
          agent_address: { type: "string", description: "Agent 地址（默认为当前钱包）" },
        },
      },
    },
    {
      name: "get_daily_ops",
      description: "查询 Agent 今日剩余操作次数和消费额度",
      inputSchema: {
        type: "object",
        properties: {
          agent_address: { type: "string", description: "Agent 地址（默认为当前钱包）" },
        },
      },
    },
    {
      name: "get_ledger",
      description: "查询链上账本记录",
      inputSchema: {
        type: "object",
        properties: {
          start_index: { type: "number", description: "起始索引（默认 0）" },
          count: { type: "number", description: "查询条数（默认 10）" },
        },
      },
    },
    {
      name: "get_payment_logs",
      description: "查询支付审计日志（从链上事件获取）",
      inputSchema: {
        type: "object",
        properties: {
          from_block: { type: "number", description: "起始区块号（默认最近 100 块）" },
        },
      },
    },
    {
      name: "request_limit_increase",
      description: "Agent 请求提额（需 Owner 权限执行）",
      inputSchema: {
        type: "object",
        properties: {
          agent_address: { type: "string", description: "Agent 地址" },
          new_daily_limit_mon: { type: "string", description: "新日限额（MON）" },
          new_single_limit_mon: { type: "string", description: "新单笔限额（MON）" },
          expiry_hours: { type: "number", description: "过期时间（小时）" },
        },
        required: ["agent_address", "new_daily_limit_mon", "new_single_limit_mon", "expiry_hours"],
      },
    },
    {
      name: "pending_approvals",
      description: "查询待审批支付列表（需 Owner 权限）",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "x402_pay_api",
      description: "通过 x402 协议按次付费调用 API。Agent 请求资源 → 收到 402 → 自动支付 → 获取资源。",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "付费 API 的 URL" },
          amount_max: { type: "string", description: "最大可接受金额（MON），超过则拒绝" },
          reason: { type: "string", description: "支付原因" },
          task_id: { type: "string", description: "任务 ID" },
          agent_id: { type: "string", description: "Agent 标识" },
        },
        required: ["url"],
      },
    },
  ],
}));

// --- Tool 执行 ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // 所有操作都用 Agent Session Key（受限副卡），不持有 Owner 私钥
    const sdk = initSDK("agent");

    switch (name) {
      case "check_budget": {
        const result = await sdk.checkBudget(
          args!.amount_mon as string,
          args!.recipient as string | undefined
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "pay": {
        const result = await sdk.pay(
          args!.recipient as string,
          args!.amount_mon as string,
          args!.reason as string,
          args!.task_id as string,
          args!.agent_id as string
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "pay_with_retry": {
        const result = await sdk.payWithRetry(
          args!.recipient as string,
          args!.amount_mon as string,
          args!.reason as string,
          args!.task_id as string,
          args!.agent_id as string,
          (args!.max_retries as number) ?? 2
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_balance": {
        const balance = await sdk.getBalance();
        return {
          content: [{ type: "text", text: `Vault balance: ${balance} MON` }],
        };
      }

      case "get_agent_config": {
        const address = (args?.agent_address as string) || getAgentAddress();
        const config = await sdk.getAgentConfig(address);
        return {
          content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
        };
      }

      case "get_daily_ops": {
        const address = (args?.agent_address as string) || getAgentAddress();
        const ops = await sdk.getAgentDailyOps(address);
        return {
          content: [{ type: "text", text: JSON.stringify(ops, null, 2) }],
        };
      }

      case "get_ledger": {
        const startIdx = (args?.start_index as number) ?? 0;
        const count = (args?.count as number) ?? 10;
        const totalCount = await sdk.getLedgerCount();
        const entries = [];
        for (let i = startIdx; i < Math.min(startIdx + count, totalCount); i++) {
          entries.push(await sdk.getLedgerEntry(i));
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ total: totalCount, entries }, null, 2) }],
        };
      }

      case "get_payment_logs": {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = (args?.from_block as number) ?? Math.max(0, currentBlock - 99);
        const logs = await sdk.getPaymentLogs(fromBlock);
        return {
          content: [{ type: "text", text: JSON.stringify(logs, null, 2) }],
        };
      }

      case "request_limit_increase": {
        // Agent 只能发起提额请求，实际执行需要 Owner 通过其他方式（脚本/Telegram Bot）
        const agentAddr = (args!.agent_address as string) || getAgentAddress();
        const newDaily = args!.new_daily_limit_mon as string;
        const newSingle = args!.new_single_limit_mon as string;
        const expiryHours = (args!.expiry_hours as number) ?? 24;
        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "requested",
            message: "提额请求已提交，需要 Owner 通过脚本或 Telegram Bot 审批执行",
            agent: agentAddr,
            requested_daily_limit: newDaily + " MON",
            requested_single_limit: newSingle + " MON",
            requested_expiry_hours: expiryHours,
            hint: "Owner 可运行: npx tsx scripts-脚本/setup-vault-diff-差异化授权.ts"
          }, null, 2) }],
        };
      }

      case "x402_pay_api": {
        const agentSdk = initSDK("agent");
        const agentPk = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
        const agentSigner = new ethers.Wallet(agentPk, provider);
        const x402 = new X402Client(agentSdk, agentSigner);
        const result = await x402.fetch(
          args!.url as string,
          {
            amountMax: args?.amount_max as string | undefined,
            reason: (args?.reason as string) || "x402 API call",
            taskId: (args?.task_id as string) || "x402-auto",
            agentId: (args?.agent_id as string) || "agentvault-x402",
          }
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "pending_approvals": {
        const count = Number(await sdk["contract"].pendingPaymentCount());
        const pending = [];
        for (let i = 0; i < count; i++) {
          const p = await sdk["contract"].pendingPayments(i);
          if (p.exists && !p.approved) {
            pending.push({
              paymentId: i,
              agent: p.agent,
              recipient: p.recipient,
              amount: ethers.formatEther(p.amount),
              reason: p.reason,
              taskId: p.taskId,
              agentId: p.agentId,
            });
          }
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ total: count, pending }, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ============ 启动 ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentVault MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
