import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const contract = new ethers.Contract(dep.address, [
    "function deposit() payable",
    "function getBalance() view returns (uint256)",
    "function getLedgerCount() view returns (uint256)",
    "function getLedgerEntry(uint256) view returns (address operator, string opType, uint256 amount, address counterparty, string reason, uint256 timestamp)",
    "function agentPay(address, uint256, string, string, string)",
    "function getAgentDailyOps(address) view returns (uint256, uint256, uint256)",
  ], wallet);

  // 查看当前账本
  let count = await contract.getLedgerCount();
  console.log("=== 当前账本 ===");
  console.log("总条数:", count.toString());
  for (let i = 0; i < Number(count); i++) {
    const entry = await contract.getLedgerEntry(i);
    console.log(`[${i}] ${entry.opType} | 操作者: ${entry.operator} | 金额: ${ethers.formatEther(entry.amount)} MON | 对手方: ${entry.counterparty} | 原因: ${entry.reason} | 时间: ${new Date(Number(entry.timestamp) * 1000).toISOString()}`);
  }

  // 做几笔操作，测试账本记录
  console.log("\n=== 测试操作 ===");

  // 1. 存 0.1 MON
  console.log("存 0.1 MON...");
  const depTx = await contract.deposit({ value: ethers.parseEther("0.1") });
  await depTx.wait();

  // 2. 给 Agent 转 gas 费
  const agentWallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY || process.env.AGENT_A_KEY || "0x" + "0".repeat(64), provider);
  console.log("给 Agent 转 gas 费 0.1 MON...");
  const fundTx = await wallet.sendTransaction({ to: agentWallet.address, value: ethers.parseEther("0.1") });
  await fundTx.wait();

  // 3. Agent 支付 0.01 MON
  console.log("Agent 支付 0.01 MON...");
  const agentContract = new ethers.Contract(dep.address, [
    "function agentPay(address, uint256, string, string, string)",
    "function getAgentDailyOps(address) view returns (uint256, uint256, uint256)",
  ], agentWallet);
  const payTx = await agentContract.agentPay("0x6E19752543144A16b953c089A8E204f1fECAB8eF", ethers.parseEther("0.01"), "测试支付", "test-001", "agent-A", { gasLimit: 500000n });
  await payTx.wait();

  // 3. 查 Agent 剩余次数
  const [depLeft, witLeft, payLeft] = await contract.getAgentDailyOps(agentWallet.address);
  console.log(`Agent A 剩余: 存${depLeft}次 / 取${witLeft}次 / 花${payLeft}次`);

  // 4. 查看更新后的账本
  count = await contract.getLedgerCount();
  console.log("\n=== 更新后账本 ===");
  console.log("总条数:", count.toString());
  for (let i = 0; i < Number(count); i++) {
    const entry = await contract.getLedgerEntry(i);
    console.log(`[${i}] ${entry.opType} | 操作者: ${entry.operator} | 金额: ${ethers.formatEther(entry.amount)} MON | 对手方: ${entry.counterparty} | 原因: ${entry.reason} | 时间: ${new Date(Number(entry.timestamp) * 1000).toISOString()}`);
  }

  const bal = await contract.getBalance();
  console.log("\n合约余额:", ethers.formatEther(bal), "MON");
}

main().catch(console.error);
