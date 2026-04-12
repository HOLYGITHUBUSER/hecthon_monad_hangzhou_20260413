import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const MON = ethers.parseEther;

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));

  const ownerABI = [
    "function deposit() payable",
    "function withdraw(uint256)",
    "function getBalance() view returns (uint256)",
    "function getLedgerCount() view returns (uint256)",
    "function getLedgerEntry(uint256) view returns (address operator, string opType, uint256 amount, address counterparty, string reason, uint256 timestamp)",
    "function getAgentDailyOps(address) view returns (uint256, uint256, uint256, uint256)",
    "function getAgentConfig(address) view returns (uint256, uint256, uint256, uint256, bool, bool, bool)",
    "function approvePayment(uint256)",
    "function rejectPayment(uint256)",
    "function pendingPaymentCount() view returns (uint256)",
    "function addWhitelist(address, address)",
  ];
  const agentABI = [
    "function deposit() payable",
    "function agentWithdraw(uint256)",
    "function agentPay(address, uint256, string, string, string)",
  ];

  const ownerContract = new ethers.Contract(dep.address, ownerABI, wallet);

  // 3 个 Agent 钱包
  const agentA = new ethers.Wallet(process.env.AGENT_A_KEY || "0x" + "0".repeat(64), provider);
  const agentB = new ethers.Wallet(process.env.AGENT_B_KEY || "0x" + "0".repeat(64), provider);
  const agentC = new ethers.Wallet(process.env.AGENT_C_KEY || "0x" + "0".repeat(64), provider);

  const contractA = new ethers.Contract(dep.address, agentABI, agentA);
  const contractB = new ethers.Contract(dep.address, agentABI, agentB);
  const contractC = new ethers.Contract(dep.address, agentABI, agentC);

  // 给 Agent 们转 gas 费
  console.log("=== 准备 gas 费 ===");
  for (const [name, addr] of [["A", agentA.address], ["B", agentB.address], ["C", agentC.address]]) {
    const bal = await provider.getBalance(addr);
    if (bal < MON("0.05")) {
      console.log(`给队友${name}转 0.1 MON gas...`);
      const tx = await wallet.sendTransaction({ to: addr, value: MON("0.1") });
      await tx.wait();
    }
  }

  // ========== 测试1: 差异化限额 ==========
  console.log("\n=== 测试1: 差异化限额 ===");

  // Agent A: 单笔0.5, 日2 → 付0.3 应该成功
  console.log("Agent A 付 0.3 MON (限额0.5)...");
  let tx = await contractA.agentPay("0x6E19752543144A16b953c089A8E204f1fECAB8eF", MON("0.3"), "GPT-4 API", "task-1", "agent-A");
  await tx.wait();
  console.log("✅ 成功\n");

  // Agent B: 单笔0.2 → 付0.3 应该失败
  console.log("Agent B 付 0.3 MON (限额0.2)...");
  try {
    tx = await contractB.agentPay("0x6E19752543144A16b953c089A8E204f1fECAB8eF", MON("0.3"), "GPU", "task-2", "agent-B");
    await tx.wait();
    console.log("❌ 应该失败但成功了！");
  } catch (e: any) {
    console.log("✅ 被拒绝: " + (e.reason || e.shortMessage || "个人单笔限额"));
  }

  // Agent B: 付0.1 应该成功
  console.log("Agent B 付 0.1 MON (限额0.2)...");
  tx = await contractB.agentPay("0x6E19752543144A16b953c089A8E204f1fECAB8eF", MON("0.1"), "API call", "task-3", "agent-B");
  await tx.wait();
  console.log("✅ 成功\n");

  // ========== 测试2: 白名单 ==========
  console.log("=== 测试2: 白名单 ===");

  // Agent C 有白名单，只能付给白名单地址
  // 付给非白名单地址应该失败
  console.log("Agent C 付给非白名单地址...");
  try {
    tx = await contractC.agentPay("0x1234567890123456789012345678901234567890", MON("0.01"), "test", "task-4", "agent-C");
    await tx.wait();
    console.log("❌ 应该失败但成功了！");
  } catch (e: any) {
    console.log("✅ 被拒绝: " + (e.reason || e.shortMessage || "白名单"));
  }

  // 付给白名单地址应该挂起（需要审批）
  console.log("Agent C 付给白名单地址 0.01 MON (需审批)...");
  tx = await contractC.agentPay("0x6E19752543144A16b953c089A8E204f1fECAB8eF", MON("0.01"), "API", "task-5", "agent-C");
  await tx.wait();
  const pendingCount = await ownerContract.pendingPaymentCount();
  console.log(`✅ 已挂起，待审批ID: ${pendingCount - 1n}\n`);

  // ========== 测试3: 审批流程 ==========
  console.log("=== 测试3: 审批流程 ===");

  // 批准支付
  const paymentId = pendingCount - 1n;
  console.log(`Owner 批准支付 #${paymentId}...`);
  tx = await ownerContract.approvePayment(paymentId);
  await tx.wait();
  console.log("✅ 批准成功，支付已执行\n");

  // ========== 测试4: 查询 ==========
  console.log("=== 测试4: 查询配置和剩余 ===");

  for (const [name, addr] of [["A", agentA.address], ["B", agentB.address], ["C", agentC.address]]) {
    const [sl, dl, st, exp, active, appr, wl] = await ownerContract.getAgentConfig(addr);
    const [depL, witL, payL, spendL] = await ownerContract.getAgentDailyOps(addr);
    console.log(`队友${name}: 单笔=${ethers.formatEther(sl)} 日=${ethers.formatEther(dl)} 已花=${ethers.formatEther(st)} 审批=${appr} 白名单=${wl} | 剩余: 存${depL} 取${witL} 花${payL} 额度${ethers.formatEther(spendL)}`);
  }

  // ========== 最终账本 ==========
  const count = await ownerContract.getLedgerCount();
  console.log(`\n========== 最终账本 (${count}条) ==========`);
  for (let i = Number(count) - 5; i < Number(count); i++) {
    if (i < 0) continue;
    const e = await ownerContract.getLedgerEntry(i);
    const t = new Date(Number(e.timestamp) * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    console.log(`[${i}] ${e.opType.padEnd(8)} | ${e.operator.slice(0, 8)}... | ${ethers.formatEther(e.amount).padStart(6)} MON | 对手: ${e.counterparty === ethers.ZeroAddress ? "-" : e.counterparty.slice(0, 8) + "..."} | 原因: ${e.reason || "-"} | ${t}`);
  }

  console.log("\n合约余额:", ethers.formatEther(await ownerContract.getBalance()), "MON");
  console.log("\n🎉 全部测试完成！");
}

main().catch(console.error);
