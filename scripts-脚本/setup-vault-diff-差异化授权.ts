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
    "function authorizeAgent(address, uint256, uint256, uint256, bool, bool)",
    "function addWhitelist(address, address)",
    "function maxSingleLimit() view returns (uint256)",
    "function maxDailyOps() view returns (uint256)",
    "function getAgentConfig(address) view returns (uint256, uint256, uint256, uint256, bool, bool, bool)",
  ], wallet);

  // 存 1 MON × 2（单笔上限1 MON）
  console.log("Depositing 1 MON...");
  let depTx = await contract.deposit({ value: ethers.parseEther("1") });
  await depTx.wait();
  console.log("Depositing 1 MON...");
  depTx = await contract.deposit({ value: ethers.parseEther("1") });
  await depTx.wait();
  const bal = await contract.getBalance();
  console.log("Vault balance:", ethers.formatEther(bal), "MON");

  const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
  const MON = ethers.parseEther;

  // 队友A（合约开发）：单笔0.5, 日消费2, 无需审批, 无白名单
  console.log("\nAuthorizing 队友A (单笔0.5, 日2, 无审批, 无白名单)...");
  let tx = await contract.authorizeAgent(
    "0xd5b01140584dD89780938207FDD094614526e3D2",
    MON("0.5"),   // singleLimit
    MON("2"),     // dailySpendLimit
    expiry,
    false,        // requireApproval
    false         // whitelistEnabled
  );
  await tx.wait();
  console.log("  ✅ done");

  // 队友B（SDK开发）：单笔0.2, 日消费1, 无需审批, 无白名单
  console.log("Authorizing 队友B (单笔0.2, 日1, 无审批, 无白名单)...");
  tx = await contract.authorizeAgent(
    "0xa0ba2b8857c550E0A4633DA05e30391957a56245",
    MON("0.2"),
    MON("1"),
    expiry,
    false,
    false
  );
  await tx.wait();
  console.log("  ✅ done");

  // 队友C（前端）：单笔0.1, 日消费0.5, 需审批, 有白名单
  console.log("Authorizing 队友C (单笔0.1, 日0.5, 需审批, 有白名单)...");
  tx = await contract.authorizeAgent(
    "0x7AfA6CccFEb0f402632B169C6E0a45a9a5faB1D1",
    MON("0.1"),
    MON("0.5"),
    expiry,
    true,         // requireApproval
    true          // whitelistEnabled
  );
  await tx.wait();
  console.log("  ✅ done");

  // 给队友C加白名单
  console.log("Adding whitelist for 队友C...");
  tx = await contract.addWhitelist(
    "0x7AfA6CccFEb0f402632B169C6E0a45a9a5faB1D1",
    "0x6E19752543144A16b953c089A8E204f1fECAB8eF"
  );
  await tx.wait();
  console.log("  ✅ done");

  // 验证配置
  console.log("\n=== Agent 配置验证 ===");
  const agents = [
    { name: "队友A", addr: "0xd5b01140584dD89780938207FDD094614526e3D2" },
    { name: "队友B", addr: "0xa0ba2b8857c550E0A4633DA05e30391957a56245" },
    { name: "队友C", addr: "0x7AfA6CccFEb0f402632B169C6E0a45a9a5faB1D1" },
  ];
  for (const a of agents) {
    const [sl, dl, st, exp, active, appr, wl] = await contract.getAgentConfig(a.addr);
    console.log(`${a.name}: 单笔=${ethers.formatEther(sl)} 日=${ethers.formatEther(dl)} 已花=${ethers.formatEther(st)} 审批=${appr} 白名单=${wl}`);
  }

  console.log("\nAll done!");
}

main().catch(console.error);
