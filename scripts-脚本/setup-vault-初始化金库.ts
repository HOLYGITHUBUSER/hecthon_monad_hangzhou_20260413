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
    "function maxSingleLimit() view returns (uint256)",
    "function maxDailyOps() view returns (uint256)",
    "function getLedgerCount() view returns (uint256)",
  ], wallet);

  // 存 0.5 MON
  console.log("Depositing 0.5 MON...");
  const depTx = await contract.deposit({ value: ethers.parseEther("0.5") });
  await depTx.wait();
  const bal = await contract.getBalance();
  console.log("Vault balance:", ethers.formatEther(bal), "MON");

  // 检查配置
  const maxLimit = await contract.maxSingleLimit();
  const maxOps = await contract.maxDailyOps();
  console.log("Max single limit:", ethers.formatEther(maxLimit), "MON");
  console.log("Max daily ops:", maxOps.toString());

  // 授权 3 个队友（24h 过期）
  const teammates = [
    { name: "队友A", address: "0xd5b01140584dD89780938207FDD094614526e3D2" },
    { name: "队友B", address: "0xa0ba2b8857c550E0A4633DA05e30391957a56245" },
    { name: "队友C", address: "0x7AfA6CccFEb0f402632B169C6E0a45a9a5faB1D1" },
  ];

  const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;

  for (const mate of teammates) {
    console.log("Authorizing", mate.name, mate.address, "...");
    const tx = await contract.authorizeAgent(
      mate.address,
      ethers.parseEther("0.1"),   // singleLimit
      ethers.parseEther("0.5"),   // dailySpendLimit
      expiry,                     // expiry
      false,                       // requireApproval
      false                        // whitelistEnabled
    );
    await tx.wait();
    console.log("  done");
  }

  const ledgerCount = await contract.getLedgerCount();
  console.log("Ledger entries:", ledgerCount.toString());
  console.log("All done!");
}

main().catch(console.error);
