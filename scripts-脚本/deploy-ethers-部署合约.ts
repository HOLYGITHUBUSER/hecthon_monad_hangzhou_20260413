/**
 * Deploy AgentVault using ethers.js directly (bypass Hardhat Node 23 compatibility issues)
 * 
 * Usage: npx tsx scripts-脚本/deploy-ethers.ts
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying AgentVault...");
  console.log(`Network: ${rpcUrl}`);
  console.log(`Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} MON`);

  // Load compiled contract
  const abiPath = path.join(process.cwd(), "artifacts-编译产物/contracts-合约_AgentVault_sol_AgentVault.abi");
  const binPath = path.join(process.cwd(), "artifacts-编译产物/contracts-合约_AgentVault_sol_AgentVault.bin");

  const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  const bytecode = "0x" + fs.readFileSync(binPath, "utf-8");

  // Deploy
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log("\nDeploying contract...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`\nAgentVault deployed to: ${contractAddress}`);

  // Save deployment info
  const deployment = {
    network: "monadTestnet",
    contract: "AgentVault",
    address: contractAddress,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    abi: abi,
  };
  fs.writeFileSync(
    path.join(process.cwd(), "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("Deployment info saved to deployment.json");
}

main().catch((error) => {
  console.error("Deployment failed:", error.message);
  process.exit(1);
});
