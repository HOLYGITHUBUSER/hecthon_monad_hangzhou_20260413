/**
 * Scenario 2: Agent exceeds limit → payment rejected
 * 
 * Flow: Agent tries to pay 0.01 MON → exceeds single limit (0.005 MON) → REVERT
 * 
 * Usage: npx tsx demo-演示/scenario2-rejected-场景2拒绝支付.ts
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
  const agentWallet = new ethers.Wallet(
    process.env.AGENT_PRIVATE_KEY || privateKey,
    provider
  );
  const gpuProviderWallet = ethers.Wallet.createRandom(provider);

  console.log("=== Scenario 2: Agent Payment Rejected (Exceeds Limit) ===\n");

  const ownerSDK = new AgentVaultSDK(vaultAddress, ownerWallet, abi);
  const agentSDK = new AgentVaultSDK(vaultAddress, agentWallet, abi);

  // Make sure agent is authorized (same as scenario 1)
  console.log("--- Agent config ---");
  const config = await ownerSDK.getAgentConfig(agentWallet.address);
  console.log(`Daily limit: ${config.dailySpendLimit} MON, Single limit: ${config.singleLimit} MON\n`);

  // Agent tries to pay 0.01 MON for GPU (exceeds single limit of 0.005 MON)
  console.log("--- Agent tries to pay 0.01 MON for GPU cluster ---");
  console.log("(Single limit is 0.005 MON → should be REJECTED)\n");

  const result = await agentSDK.pay(
    gpuProviderWallet.address,
    "0.01",
    "Purchase GPU compute cluster for training",
    "task-002",
    "claude-code"
  );

  if (!result.success) {
    console.log(`\n✅ Payment correctly REJECTED!`);
    console.log(`Reason: Exceeds single transaction limit (0.01 MON > 0.005 MON)`);
    console.log(`Agent should notify user: "I need 0.01 MON for GPU but my limit is 0.005 MON. Please approve."`);
  }

  console.log("\n=== Scenario 2 Complete ===");
}

main().catch((error) => { console.error("Scenario 2 failed:", error.message); process.exit(1); });
