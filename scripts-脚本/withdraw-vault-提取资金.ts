import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const bal = await provider.getBalance(wallet.address);
  console.log("Wallet balance:", ethers.formatEther(bal), "MON");

  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const contract = new ethers.Contract(dep.address, [
    "function getBalance() view returns (uint256)",
    "function withdraw(uint256)",
  ], wallet);

  const vaultBal = await contract.getBalance();
  console.log("Vault balance:", ethers.formatEther(vaultBal), "MON");

  if (BigInt(vaultBal) > 0n) {
    console.log("Withdrawing...");
    const tx = await contract.withdraw(vaultBal);
    await tx.wait();
    console.log("Withdrawn!");
    const newBal = await provider.getBalance(wallet.address);
    console.log("New wallet balance:", ethers.formatEther(newBal), "MON");
  } else {
    console.log("Vault is empty, nothing to withdraw.");
  }
}

main().catch(console.error);
