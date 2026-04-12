import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

/**
 * 授权队友自己的钱包地址
 * 用法: npx tsx scripts-脚本/authorize-wallet-授权钱包.ts <地址> <角色A/B/C>
 * 
 * 例: npx tsx scripts-脚本/authorize-wallet-授权钱包.ts 0x1234... A
 */

const MON = ethers.parseEther;

// 差异化配置
const CONFIGS: Record<string, { singleLimit: string; dailySpendLimit: string; requireApproval: boolean; whitelistEnabled: boolean; name: string }> = {
  A: { singleLimit: "0.5", dailySpendLimit: "2", requireApproval: false, whitelistEnabled: false, name: "队友A（合约开发）" },
  B: { singleLimit: "0.2", dailySpendLimit: "1", requireApproval: false, whitelistEnabled: false, name: "队友B（SDK开发）" },
  C: { singleLimit: "0.1", dailySpendLimit: "0.5", requireApproval: true, whitelistEnabled: true, name: "队友C（前端）" },
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("用法: npx tsx scripts-脚本/authorize-wallet-授权钱包.ts <地址> <角色A/B/C>");
    console.log("例: npx tsx scripts-脚本/authorize-wallet-授权钱包.ts 0x1234... A");
    process.exit(1);
  }

  const agentAddress = args[0];
  const role = args[1].toUpperCase();
  const config = CONFIGS[role];
  if (!config) {
    console.log("角色必须是 A/B/C");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));

  const contract = new ethers.Contract(dep.address, [
    "function authorizeAgent(address, uint256, uint256, uint256, bool, bool)",
    "function addWhitelist(address, address)",
    "function getAgentConfig(address) view returns (uint256, uint256, uint256, uint256, bool, bool, bool)",
  ], wallet);

  const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;

  console.log(`授权 ${config.name}: ${agentAddress}`);
  console.log(`  单笔=${config.singleLimit} MON | 日消费=${config.dailySpendLimit} MON | 审批=${config.requireApproval} | 白名单=${config.whitelistEnabled}`);

  const tx = await contract.authorizeAgent(
    agentAddress,
    MON(config.singleLimit),
    MON(config.dailySpendLimit),
    expiry,
    config.requireApproval,
    config.whitelistEnabled
  );
  await tx.wait();
  console.log("✅ 授权成功");

  // 队友C 加白名单
  if (config.whitelistEnabled) {
    console.log("添加白名单地址...");
    const wlTx = await contract.addWhitelist(agentAddress, "0x6E19752543144A16b953c089A8E204f1fECAB8eF");
    await wlTx.wait();
    console.log("✅ 白名单已添加");
  }

  // 验证
  const [sl, dl, st, exp, active, appr, wl] = await contract.getAgentConfig(agentAddress);
  console.log(`\n验证: 单笔=${ethers.formatEther(sl)} 日=${ethers.formatEther(dl)} 审批=${appr} 白名单=${wl} 活跃=${active}`);
}

main().catch(console.error);
