import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const p = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const c = new ethers.Contract(dep.address, [
    "function getLedgerCount() view returns (uint256)",
    "function getLedgerEntry(uint256) view returns (address operator, string opType, uint256 amount, address counterparty, string reason, uint256 timestamp)",
  ], p);

  const count = await c.getLedgerCount();
  console.log("========== 账本记录 ==========");
  console.log("总条数:", count.toString(), "\n");

  for (let i = 0; i < Number(count); i++) {
    const e = await c.getLedgerEntry(i);
    const t = new Date(Number(e.timestamp) * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const cp = e.counterparty === ethers.ZeroAddress ? "-" : e.counterparty.slice(0, 10) + "...";
    console.log(`[${i}] ${e.opType.padEnd(8)} | ${e.operator.slice(0, 10)}... | ${ethers.formatEther(e.amount).padStart(7)} MON | 对手: ${cp} | 原因: ${e.reason || "-"} | ${t}`);
  }
}

main().catch(console.error);
