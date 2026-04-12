import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey || privateKey.includes("PASTE")) {
  console.log("❌ 请先在 .env 文件中设置有效的 PRIVATE_KEY");
  process.exit(1);
}

try {
  const wallet = new ethers.Wallet(privateKey);
  console.log("✅ .env 中私钥对应的钱包地址:");
  console.log(wallet.address);
  console.log("\n对比你提供的地址:");
  console.log("0x2C7c26E395A5861380451CcCFf303F58Feb190D9");
  
  const match = wallet.address.toLowerCase() === "0x2C7c26E395A5861380451CcCFf303F58Feb190D9".toLowerCase();
  console.log(match ? "\n✅ 地址匹配!" : "\n❌ 地址不匹配!");
} catch (e) {
  console.log("❌ 私钥格式错误:", e);
}
