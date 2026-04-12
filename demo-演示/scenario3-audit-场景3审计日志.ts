/**
 * Scenario 3: Audit log — view all payment history
 * 
 * Flow: Query chain events → display structured audit log
 * 
 * Usage: npx tsx demo-演示/scenario3-audit-场景3审计日志.ts
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { AgentVaultSDK } from "../sdk-开发包/agent-vault-standalone-独立SDK";

dotenv.config();

async function main() {
  const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) { console.error("ERROR: Set PRIVATE_KEY in .env"); process.exit(1); }

  const deployment = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployment.json"), "utf-8"));
  const vaultAddress = deployment.address;
  const abi = deployment.abi;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const ownerWallet = new ethers.Wallet(privateKey, provider);

  console.log("=== Scenario 3: Audit Log ===\n");

  const ownerSDK = new AgentVaultSDK(vaultAddress, ownerWallet, abi);

  // Get all payment events (Monad testnet limits eth_getLogs to 100 block range)
  console.log("--- Fetching all payment events from chain ---\n");
  const currentBlock = await provider.getBlockNumber();
  const logs = await ownerSDK.getPaymentLogs(Math.max(0, currentBlock - 99));

  if (logs.length === 0) {
    console.log("No payments found. Run scenario1 and scenario2 first.");
    return;
  }

  // Display as table
  console.log("Payment Audit Log:");
  console.log("=".repeat(100));
  console.table(
    logs.map((log: any) => ({
      "Agent ID": log.agentId,
      Agent: `${log.agent.slice(0, 8)}...`,
      Recipient: `${log.recipient.slice(0, 8)}...`,
      "Amount (MON)": log.amount,
      Reason: log.reason.length > 30 ? log.reason.slice(0, 30) + "..." : log.reason,
      "Task ID": log.taskId,
      Time: log.timestamp,
      "Auto-approved": log.autoApproved ? "Yes" : "No (human)",
    }))
  );

  // Summary
  const totalSpent = logs.reduce((sum: number, log: any) => sum + parseFloat(log.amount), 0);
  console.log(`\nTotal payments: ${logs.length}`);
  console.log(`Total spent: ${totalSpent.toFixed(4)} MON`);
  console.log(`Vault balance: ${await ownerSDK.getBalance()} MON`);

  console.log("\n=== Scenario 3 Complete ===");
}

main().catch((error) => { console.error("Scenario 3 failed:", error.message); process.exit(1); });
