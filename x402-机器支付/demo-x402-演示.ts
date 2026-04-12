/**
 * AgentVault x402 端到端演示
 *
 * 演示 Agent 通过 x402 协议按次付费调用 API 的完整流程：
 * 1. 启动付费 API 服务端
 * 2. Agent 请求 → 收到 402 → 签名支付 → 重试 → 获取资源
 *
 * 启动: npx tsx x402-机器支付/demo-x402-演示.ts
 *
 * 注意: 需要先启动服务端: npx tsx x402-机器支付/x402-server-服务端.ts
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { AgentVaultSDK } from "../sdk-开发包/agent-vault-standalone-独立SDK";
import { X402Client } from "./x402-client-客户端";

dotenv.config();

// ============ 初始化 ============

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(rpcUrl);

const ownerPk = process.env.PRIVATE_KEY || "";
const agentPk = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
if (!ownerPk) { console.error("PRIVATE_KEY not set"); process.exit(1); }

const ownerWallet = new ethers.Wallet(ownerPk, provider);
const agentWallet = new ethers.Wallet(agentPk, provider);

const deploymentPath = path.join(process.cwd(), "deployment.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
const ownerSDK = new AgentVaultSDK(deployment.address, ownerWallet, deployment.abi);
const agentSDK = new AgentVaultSDK(deployment.address, agentWallet, deployment.abi);

const x402Client = new X402Client(agentSDK, agentWallet);

// ============ 演示 ============

async function main() {
  console.log("=".repeat(60));
  console.log("AgentVault x402 端到端演示");
  console.log("=".repeat(60));
  console.log(`Agent: ${agentWallet.address}`);
  console.log(`Vault: ${deployment.address}`);
  console.log();

  // 先查余额
  const balance = await ownerSDK.getBalance();
  console.log(`Vault 余额: ${balance} MON`);
  console.log();

  // 确保 Agent 已授权
  const isActive = await ownerSDK.isAgentActive(agentWallet.address);
  if (!isActive) {
    console.log(`--- 授权 Agent ${agentWallet.address} ---`);
    await ownerSDK.authorizeAgent(agentWallet.address, "0.05", "0.02", 24);
    console.log(`Agent 已授权\n`);
  } else {
    console.log(`Agent 已授权，跳过\n`);
  }

  // ---- Scenario 1: 调用 GPT-4 API (0.005 MON) ----
  console.log("--- Scenario 1: 调用 GPT-4 API ---");
  const result1 = await x402Client.fetch("http://localhost:3001/api/gpt4", {
    amountMax: "0.01",
    reason: "Call GPT-4 for task analysis",
    taskId: "demo-task-001",
    agentId: "agentvault-demo",
  });

  if (result1.success) {
    console.log(`✅ GPT-4 API 调用成功!`);
    console.log(`   返回数据: ${JSON.stringify(result1.data)}`);
    console.log(`   支付凭证: tx=${result1.receipt?.txHash?.slice(0, 16)}... amount=${result1.receipt?.amount} MON`);
  } else {
    console.log(`❌ GPT-4 API 调用失败: ${result1.error}`);
    console.log(`   (确保 x402-server 已启动: npx tsx x402-机器支付/x402-server-服务端.ts)`);
  }
  console.log();

  // ---- Scenario 2: 调用 GPU API (0.01 MON) ----
  console.log("--- Scenario 2: 调用 GPU 集群 API ---");
  const result2 = await x402Client.fetch("http://localhost:3001/api/gpu", {
    amountMax: "0.02",
    reason: "Rent GPU for model training",
    taskId: "demo-task-002",
    agentId: "agentvault-demo",
  });

  if (result2.success) {
    console.log(`✅ GPU API 调用成功!`);
    console.log(`   返回数据: ${JSON.stringify(result2.data)}`);
    console.log(`   支付凭证: tx=${result2.receipt?.txHash?.slice(0, 16)}... amount=${result2.receipt?.amount} MON`);
  } else {
    console.log(`❌ GPU API 调用失败: ${result2.error}`);
  }
  console.log();

  // ---- Scenario 3: 超额拒绝 ----
  console.log("--- Scenario 3: 超额拒绝 (amountMax=0.001) ---");
  const result3 = await x402Client.fetch("http://localhost:3001/api/gpu", {
    amountMax: "0.001",
    reason: "Should be rejected",
    taskId: "demo-task-003",
    agentId: "agentvault-demo",
  });

  if (!result3.success) {
    console.log(`✅ 正确拒绝: ${result3.error}`);
  } else {
    console.log(`❌ 不应该成功`);
  }
  console.log();

  // ---- Scenario 4: 查看审计日志 ----
  console.log("--- Scenario 4: 查看审计日志 ---");
  const currentBlock = await provider.getBlockNumber();
  const logs = await agentSDK.getPaymentLogs(Math.max(0, currentBlock - 99));
  const recentLogs = logs.slice(-5);
  console.log(`最近 ${recentLogs.length} 条支付日志:`);
  recentLogs.forEach((log: any) => {
    console.log(`  ${log.agentId}: ${log.amount} MON → ${log.recipient?.slice(0, 10)}... [${log.policyHit}] ${log.autoApproved ? "auto" : "manual"}`);
  });

  console.log();
  console.log("=".repeat(60));
  console.log("x402 演示完成!");
  console.log("=".repeat(60));
}

main().catch(console.error);
