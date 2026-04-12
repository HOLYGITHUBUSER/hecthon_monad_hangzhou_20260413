import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));

async function main() {
  for (const addr of ["0x1cAEb53198fCBB80B3F004C92200812687D040F4", "0x500B1C12D43AdadC1835320053750Ca135f1e91D"]) {
    const contract = new ethers.Contract(addr, deployment.abi, wallet);
    try {
      const owner = await contract.owner();
      const balance = await provider.getBalance(addr);
      console.log(addr);
      console.log("  owner:", owner);
      console.log("  balance:", ethers.formatEther(balance), "MON");
      try {
        const config = await contract.agents("0x9c108bbE0333d978e582Ba32980Cf2d3F3f6d684");
        console.log("  agent active:", config.active);
        console.log("  agent singleLimit:", ethers.formatEther(config.singleLimit));
        console.log("  agent dailySpendLimit:", ethers.formatEther(config.dailySpendLimit));
        console.log("  agent expiry:", Number(config.expiry), new Date(Number(config.expiry) * 1000).toISOString());
      } catch (e: any) {
        console.log("  agent query error:", e.message?.substring(0, 80));
      }
    } catch (e: any) {
      console.log(addr, "error:", e.message?.substring(0, 80));
    }
    console.log();
  }
}

main().catch(console.error);
