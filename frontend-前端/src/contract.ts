import { ethers } from "ethers";

const VAULT_ADDRESS = "0xf9d7a48c10C2bCe029159d1B4C433B9821956e41";
const MONAD_RPC = "https://testnet-rpc.monad.xyz";
const MONAD_CHAIN_ID = 10143;

const ABI = [
  "function getBalance() view returns (uint256)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function getAgentConfig(address) view returns (uint256 singleLimit, uint256 dailySpendLimit, uint256 spentToday, uint256 expiry, bool active, bool requireApproval, bool whitelistEnabled)",
  "function getAgentDailyOps(address) view returns (uint256 depositsLeft, uint256 withdrawsLeft, uint256 paysLeft, uint256 spendLeft)",
  "function isAgentActive(address) view returns (bool)",
  "function getLedgerCount() view returns (uint256)",
  "function getLedgerEntry(uint256) view returns (address operator, string opType, uint256 amount, address counterparty, string reason, uint256 timestamp)",
  "function pendingPaymentCount() view returns (uint256)",
  "function pendingPayments(uint256) view returns (address agent, address recipient, uint256 amount, string reason, string taskId, string agentId, bool approved, bool exists)",
  "function approvePayment(uint256)",
  "function rejectPayment(uint256)",
  "function authorizeAgent(address, uint256, uint256, uint256, bool, bool)",
  "function revokeAgent(address)",
  "function updateAgentConfig(address, uint256, uint256, uint256, bool, bool)",
  "function updateAgentExpiry(address, uint256)",
  "function addWhitelist(address, address)",
  "function removeWhitelist(address, address)",
  "function deposit() payable",
  "function withdraw(uint256)",
  "function emergencyPause()",
  "function unpause()",
  "function setMaxSingleLimit(uint256)",
  "function setMaxDailyOps(uint256)",
  "event AgentPayment(address indexed agent, address indexed recipient, uint256 amount, string reason, string taskId, string agentId, uint256 timestamp, bool autoApproved, string policyHit)",
];

export function getReadContract() {
  const provider = new ethers.JsonRpcProvider(MONAD_RPC);
  return new ethers.Contract(VAULT_ADDRESS, ABI, provider);
}

export function getWriteContract(signer: ethers.Signer) {
  return new ethers.Contract(VAULT_ADDRESS, ABI, signer);
}

export async function getSigner(): Promise<ethers.Signer | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (accounts.length === 0) return null;
    // Check we're on Monad testnet
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== MONAD_CHAIN_ID) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2797" }], // 10143
        });
      } catch {
        return null;
      }
    }
    return await provider.getSigner();
  } catch {
    return null;
  }
}

export { VAULT_ADDRESS, MONAD_CHAIN_ID, MONAD_RPC };

export function getProvider() {
  return new ethers.JsonRpcProvider(MONAD_RPC);
}
