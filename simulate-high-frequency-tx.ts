import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
const contractAddr = "0x1cAEb53198fCBB80B3F004C92200812687D040F4";

async function simulateHighFrequencyTx() {
  const NUM_TX = 1000;
  const AMOUNT_PER_TX = "0.000001";
  const REASON = "租用 GPU 训练模型";

  // 使用 Agent 钱包
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY || "0x...";
  const wallet = new ethers.Wallet(agentPrivateKey, provider);
  const contract = new ethers.Contract(contractAddr, deployment.abi, wallet);

  console.log(`🚀 开始模拟 ${NUM_TX} 笔高频并发交易`);
  console.log(`💰 每笔金额: ${AMOUNT_PER_TX} MON`);
  console.log(`📝 用途: ${REASON}`);
  console.log(`👛 发送者: ${wallet.address}`);
  console.log(`⏱️ 时间戳: ${new Date().toISOString()}`);
  console.log("---");

  const startTime = Date.now();
  const nonce = await provider.getTransactionCount(wallet.address, "latest");

  // 构建所有交易
  const txs = [];
  for (let i = 0; i < NUM_TX; i++) {
    const amount = ethers.parseEther(AMOUNT_PER_TX);
    const taskId = `hft-sim-${Date.now()}-${i}`;
    
    const txData = await contract.agentPay.populateTransaction(
      wallet.address, // recipient
      amount,
      REASON,
      taskId,
      "claude-code" // agentId
    );

    txs.push({
      ...txData,
      nonce: nonce + i,
      gasLimit: 500000,
      maxFeePerGas: ethers.parseUnits("202", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      chainId: 10143,
    });
  }

  // 一次性发送所有交易（真并发）
  console.log(`📤 正在发送 ${NUM_TX} 笔交易...`);
  const promises = txs.map((tx) => wallet.sendTransaction(tx));
  
  const results = await Promise.allSettled(promises);
  
  const endTime = Date.now();
  const duration = endTime - startTime;

  // 统计结果
  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log("---");
  console.log(`✅ 成功: ${success}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⏱️ 总耗时: ${duration}ms`);
  console.log(`📊 平均每笔: ${(duration / NUM_TX).toFixed(3)}ms`);
  console.log(`💸 总金额: ${(parseFloat(AMOUNT_PER_TX) * NUM_TX)} MON`);

  if (success > 0) {
    console.log("---");
    console.log("📋 成功交易哈希:");
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`  [${i}] ${r.value.hash}`);
      }
    });
  }

  if (failed > 0) {
    console.log("---");
    console.log("📋 失败交易错误:");
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.log(`  [${i}] ${r.reason?.message?.slice(0, 100) || r.reason}`);
      }
    });
  }
}

simulateHighFrequencyTx().catch(console.error);
