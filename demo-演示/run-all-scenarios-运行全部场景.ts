/**
 * Run all 3 demo scenarios end-to-end
 * 
 * Usage: npx tsx demo-演示/run-all-scenarios-运行全部场景.ts
 * 
 * Prerequisites:
 *   1. Deploy contract: npx tsx scripts-脚本/deploy-ethers-部署合约.ts
 *   2. Fund deployer wallet with Monad testnet MON
 *   3. Set PRIVATE_KEY in .env
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

  if (!privateKey) {
    console.error("ERROR: Set PRIVATE_KEY in .env file");
    process.exit(1);
  }

  // Load deployment info
  const deploymentPath = path.join(process.cwd(), "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("ERROR: deployment.json not found. Deploy contract first: npx tsx scripts-脚本/deploy-ethers.ts");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const vaultAddress = deployment.address;
  const abi = deployment.abi;

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Owner wallet
  const ownerWallet = new ethers.Wallet(privateKey, provider);

  // Agent wallet (derived from owner's private key + offset for demo)
  // In production, agent would have its own key
  const agentWallet = new ethers.Wallet(
    process.env.AGENT_PRIVATE_KEY || privateKey,
    provider
  );

  // API provider wallet
  const apiProviderWallet = ethers.Wallet.createRandom(provider);

  console.log("=== AgentVault Demo — All Scenarios ===\n");
  console.log(`Vault: ${vaultAddress}`);
  console.log(`Owner: ${ownerWallet.address}`);
  console.log(`Agent: ${agentWallet.address}`);
  console.log(`API Provider: ${apiProviderWallet.address}\n`);

  // Fund agent wallet with MON for gas
  console.log("--- Funding Agent wallet with 0.05 MON for gas ---");
  const fundTx = await ownerWallet.sendTransaction({
    to: agentWallet.address,
    value: ethers.parseEther("0.05"),
  });
  await fundTx.wait();
  console.log(`Agent funded with 0.05 MON\n`);

  const ownerSDK = new AgentVaultSDK(vaultAddress, ownerWallet, abi);
  const agentSDK = new AgentVaultSDK(vaultAddress, agentWallet, abi);

  // ==========================================
  // SCENARIO 1: Agent small payment succeeds
  // ==========================================
  console.log("══════════════════════════════════════════");
  console.log("SCENARIO 1: Agent Small Payment Succeeds");
  console.log("══════════════════════════════════════════\n");

  // Step 1: Deposit
  console.log("--- Step 1: Owner deposits 0.01 MON ---");
  await ownerSDK.deposit("0.01");
  console.log(`Vault balance: ${await ownerSDK.getBalance()} MON\n`);

  // Step 2: Authorize agent
  console.log("--- Step 2: Owner authorizes Agent ---");
  await ownerSDK.authorizeAgent(agentWallet.address, "0.01", "0.005", 24);
  const config = await ownerSDK.getAgentConfig(agentWallet.address);
  console.log(`Agent config: daily=${config.dailySpendLimit} MON, single=${config.singleLimit} MON, active=${config.active}, expiry=24h\n`);

  // Step 3: Agent pays for API
  console.log("--- Step 3: Agent pays 0.001 MON for GPT-4 API ---");
  const result1 = await agentSDK.pay(
    apiProviderWallet.address,
    "0.001",
    "Purchase GPT-4 API tokens for translation task",
    "task-001",
    "claude-code"
  );
  console.log(`Payment result: ${result1.success ? "SUCCESS ✅" : "FAILED ❌"}\n`);

  // Step 4: Check remaining ops & budget
  console.log("--- Step 4: Check remaining daily ops & budget ---");
  const dailyOps = await ownerSDK.getAgentDailyOps(agentWallet.address);
  console.log(`Pays left: ${dailyOps.paysLeft}, Spend left: ${dailyOps.spendLeft} MON\n`);

  // ==========================================
  // SCENARIO 2: Agent exceeds limit → rejected
  // ==========================================
  console.log("\n══════════════════════════════════════════");
  console.log("SCENARIO 2: Agent Payment Rejected (Exceeds Limit)");
  console.log("══════════════════════════════════════════\n");

  console.log("--- Agent tries to pay 0.01 MON for GPU cluster ---");
  console.log("(Single limit is 0.005 MON → should be REJECTED)\n");

  const result2 = await agentSDK.pay(
    apiProviderWallet.address,
    "0.01",
    "Purchase GPU compute cluster for training",
    "task-002",
    "claude-code"
  );

  if (!result2.success) {
    console.log(`\n✅ Payment correctly REJECTED!`);
    console.log(`Reason: Exceeds single transaction limit (0.01 MON > 0.005 MON)`);
    console.log(`Agent should notify user: "I need 8 MON for GPU but my limit is 5 MON. Please approve."\n`);
  }

  // ==========================================
  // SCENARIO 3: Audit log
  // ==========================================
  console.log("\n══════════════════════════════════════════");
  console.log("SCENARIO 3: Audit Log");
  console.log("══════════════════════════════════════════\n");

  console.log("--- Fetching all payment events from chain ---\n");
  // Monad testnet limits eth_getLogs to 100 block range, fetch recent blocks only
  const currentBlock = await provider.getBlockNumber();
  const logs = await ownerSDK.getPaymentLogs(Math.max(0, currentBlock - 99));

  if (logs.length > 0) {
    console.log("Payment Audit Log:");
    console.log("=".repeat(100));
    console.table(
      logs.map((log: any) => ({
        "Agent ID": log.agentId,
        Agent: `${log.agent.slice(0, 10)}...`,
        Recipient: `${log.recipient.slice(0, 10)}...`,
        "Amount (MON)": log.amount,
        Reason: log.reason.length > 35 ? log.reason.slice(0, 35) + "..." : log.reason,
        "Task ID": log.taskId,
        Time: log.timestamp,
        "Auto-approved": log.autoApproved ? "Yes" : "No (human)",
        "Policy": log.policyHit,
      }))
    );

    const totalSpent = logs.reduce((sum: number, log: any) => sum + parseFloat(log.amount), 0);
    console.log(`\nTotal payments: ${logs.length}`);
    console.log(`Total spent: ${totalSpent.toFixed(4)} MON`);
  }

  console.log(`\nVault balance: ${await ownerSDK.getBalance()} MON`);

  console.log("\n══════════════════════════════════════════");
  console.log("ALL SCENARIOS COMPLETE");
  console.log("══════════════════════════════════════════");
}

main().catch((error) => {
  console.error("Demo failed:", error.message);
  process.exit(1);
});
