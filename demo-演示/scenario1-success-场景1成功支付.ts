/**
 * Scenario 1: Agent small payment succeeds
 * 
 * Flow: Agent pays 0.5 MON for API call → auto-approved → success
 * 
 * Usage: npx tsx demo-演示/scenario1-success-场景1成功支付.ts
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
  const apiProviderWallet = ethers.Wallet.createRandom(provider);

  console.log("=== Scenario 1: Agent Small Payment Succeeds ===\n");
  console.log(`Vault: ${vaultAddress}`);
  console.log(`Owner: ${ownerWallet.address}`);
  console.log(`Agent: ${agentWallet.address}`);
  console.log(`API Provider: ${apiProviderWallet.address}\n`);

  const ownerSDK = new AgentVaultSDK(vaultAddress, ownerWallet, abi);
  const agentSDK = new AgentVaultSDK(vaultAddress, agentWallet, abi);

  // Step 1: Deposit funds
  console.log("--- Step 1: Owner deposits 0.01 MON ---");
  await ownerSDK.deposit("0.01");
  console.log(`Vault balance: ${await ownerSDK.getBalance()} MON\n`);

  // Step 2: Authorize agent
  console.log("--- Step 2: Owner authorizes Agent ---");
  await ownerSDK.authorizeAgent(agentWallet.address, "0.01", "0.005", 24);
  const config = await ownerSDK.getAgentConfig(agentWallet.address);
  console.log(`Agent config: daily=${config.dailySpendLimit} MON, single=${config.singleLimit} MON, active=${config.active}\n`);

  // Step 3: Agent pays for API
  console.log("--- Step 3: Agent pays 0.001 MON for GPT-4 API ---");
  const result = await agentSDK.pay(
    apiProviderWallet.address,
    "0.001",
    "Purchase GPT-4 API tokens for translation task",
    "task-001",
    "claude-code"
  );
  console.log(`Payment result: ${result.success ? "SUCCESS ✅" : "FAILED ❌"}\n`);

  // Step 4: Check remaining ops & budget
  console.log("--- Step 4: Check remaining daily ops & budget ---");
  const dailyOps = await ownerSDK.getAgentDailyOps(agentWallet.address);
  console.log(`Pays left: ${dailyOps.paysLeft}, Spend left: ${dailyOps.spendLeft} MON\n`);

  // Step 5: View audit log
  console.log("--- Step 5: Audit log ---");
  const currentBlock = await provider.getBlockNumber();
  const logs = await ownerSDK.getPaymentLogs(Math.max(0, currentBlock - 99));
  if (logs.length > 0) console.table(logs);
  else console.log("No payment logs found in recent blocks.");

  console.log("\n=== Scenario 1 Complete ===");
}

main().catch((error) => { console.error("Scenario 1 failed:", error.message); process.exit(1); });
