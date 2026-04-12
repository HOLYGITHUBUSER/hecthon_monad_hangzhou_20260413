import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));

// 用正确的合约地址
const contractAddr = "0x1cAEb53198fCBB80B3F004C92200812687D040F4";
const contract = new ethers.Contract(contractAddr, deployment.abi, wallet);

async function main() {
  const agentAddr = "0x9c108bbE0333d978e582Ba32980Cf2d3F3f6d684";

  // 授权 Agent，单笔 1 MON，日限额 5 MON
  const singleLimit = ethers.parseEther("1");
  const dailyLimit = ethers.parseEther("5");
  const expiry = Math.floor(Date.now() / 1000) + 72 * 3600;

  console.log("Authorizing agent on", contractAddr);
  const tx = await contract.authorizeAgent(agentAddr, singleLimit, dailyLimit, expiry, false, false);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("Agent authorized! 单笔 1 MON, 日限额 5 MON");

  // 转 gas 费
  const fundTx = await wallet.sendTransaction({
    to: agentAddr,
    value: ethers.parseEther("0.05"),
  });
  console.log("Gas fund tx:", fundTx.hash);
  await fundTx.wait();
  console.log("Gas funded!");
}

main().catch(console.error);
