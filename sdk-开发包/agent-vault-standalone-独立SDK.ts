/**
 * AgentVault SDK — standalone ethers.js version (no Hardhat dependency)
 */
import { ethers } from "ethers";

// ============ Types & Helpers ============

export interface PaymentError {
  code: string;           // Machine-readable error code
  message: string;       // Human-readable description
  canRetry: boolean;     // Whether retrying might succeed
  suggestion?: string;   // What the Agent should do next
}

const ERROR_MAP: Record<string, Partial<PaymentError>> = {
  "Agent not authorized":          { code: "NOT_AUTHORIZED", canRetry: false, suggestion: "Request owner to authorize this agent" },
  "Session key expired":           { code: "SESSION_EXPIRED", canRetry: false, suggestion: "Request owner to extend session key expiry" },
  "Contract is paused":            { code: "PAUSED", canRetry: true, suggestion: "Wait for owner to unpause the contract" },
  "Exceeds personal single limit": { code: "SINGLE_LIMIT", canRetry: false, suggestion: "Request limit increase from owner or split into smaller payments" },
  "Exceeds global single limit":   { code: "GLOBAL_LIMIT", canRetry: false, suggestion: "Amount exceeds 1 MON global cap, cannot proceed" },
  "Insufficient balance":          { code: "INSUFFICIENT_BALANCE", canRetry: true, suggestion: "Wait for vault to be funded" },
  "Daily deposit limit reached":   { code: "DAILY_DEPOSIT_LIMIT", canRetry: true, suggestion: "Wait until tomorrow for daily reset" },
  "Daily withdraw limit reached":  { code: "DAILY_WITHDRAW_LIMIT", canRetry: true, suggestion: "Wait until tomorrow for daily reset" },
  "Daily pay limit reached":       { code: "DAILY_PAY_LIMIT", canRetry: true, suggestion: "Wait until tomorrow for daily reset" },
  "Exceeds daily spend limit":     { code: "DAILY_SPEND_LIMIT", canRetry: false, suggestion: "Request daily limit increase from owner" },
  "Recipient not in whitelist":    { code: "WHITELIST", canRetry: false, suggestion: "Request owner to add recipient to whitelist" },
  "Transfer failed":               { code: "TRANSFER_FAILED", canRetry: true, suggestion: "Retry the payment" },
  "nonce":                         { code: "NONCE", canRetry: true, suggestion: "Auto-retry with correct nonce" },
  "replacement fee":               { code: "GAS", canRetry: true, suggestion: "Retry with higher gas" },
};

function translateError(rawError: string): PaymentError {
  for (const [pattern, info] of Object.entries(ERROR_MAP)) {
    if (rawError.toLowerCase().includes(pattern.toLowerCase())) {
      return {
        code: info.code || "UNKNOWN",
        message: rawError,
        canRetry: info.canRetry ?? false,
        suggestion: info.suggestion,
      };
    }
  }
  return { code: "UNKNOWN", message: rawError, canRetry: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class AgentVaultSDK {
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(contractAddress: string, signer: ethers.Wallet, abi: any[]) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, abi, signer);
  }

  // ============ Owner Functions ============

  async deposit(amount: string) {
    const tx = await this.contract.deposit({ value: ethers.parseEther(amount) });
    await tx.wait();
    console.log(`Deposited ${amount} MON`);
    return tx;
  }

  async withdraw(amount: string) {
    const tx = await this.contract.withdraw(ethers.parseEther(amount));
    await tx.wait();
    console.log(`Withdrawn ${amount} MON`);
    return tx;
  }

  async authorizeAgent(
    agentAddress: string,
    dailyLimitMON: string,
    singleLimitMON: string,
    expiryHours: number,
    requireApproval: boolean = false,
    whitelistEnabled: boolean = false
  ) {
    const dailyLimit = ethers.parseEther(dailyLimitMON);
    const singleLimit = ethers.parseEther(singleLimitMON);
    const expiry = Math.floor(Date.now() / 1000) + expiryHours * 3600;
    const tx = await this.contract.authorizeAgent(agentAddress, singleLimit, dailyLimit, expiry, requireApproval, whitelistEnabled);
    await tx.wait();
    console.log(`Authorized agent ${agentAddress}: daily=${dailyLimitMON}MON, single=${singleLimitMON}MON, expiry=${expiryHours}h, approval=${requireApproval}, whitelist=${whitelistEnabled}`);
    return tx;
  }

  async revokeAgent(agentAddress: string) {
    const tx = await this.contract.revokeAgent(agentAddress);
    await tx.wait();
    console.log(`Revoked agent ${agentAddress}`);
    return tx;
  }

  async updateAgentConfig(
    agentAddress: string,
    dailyLimitMON: string,
    singleLimitMON: string,
    expiryHours: number,
    requireApproval: boolean = false,
    whitelistEnabled: boolean = false
  ) {
    const dailyLimit = ethers.parseEther(dailyLimitMON);
    const singleLimit = ethers.parseEther(singleLimitMON);
    const expiry = Math.floor(Date.now() / 1000) + expiryHours * 3600;
    const tx = await this.contract.updateAgentConfig(agentAddress, singleLimit, dailyLimit, expiry, requireApproval, whitelistEnabled);
    await tx.wait();
    console.log(`Updated agent ${agentAddress} config`);
    return tx;
  }

  async updateAgentExpiry(agentAddress: string, expiryHours: number) {
    const expiry = Math.floor(Date.now() / 1000) + expiryHours * 3600;
    const tx = await this.contract.updateAgentExpiry(agentAddress, expiry);
    await tx.wait();
    console.log(`Updated agent ${agentAddress} expiry to +${expiryHours}h`);
    return tx;
  }

  async addWhitelist(agentAddress: string, recipientAddress: string) {
    const tx = await this.contract.addWhitelist(agentAddress, recipientAddress);
    await tx.wait();
    console.log(`Added ${recipientAddress} to whitelist for agent ${agentAddress}`);
    return tx;
  }

  async removeWhitelist(agentAddress: string, recipientAddress: string) {
    const tx = await this.contract.removeWhitelist(agentAddress, recipientAddress);
    await tx.wait();
    console.log(`Removed ${recipientAddress} from whitelist for agent ${agentAddress}`);
    return tx;
  }

  async approvePayment(paymentId: number) {
    const tx = await this.contract.approvePayment(paymentId);
    await tx.wait();
    console.log(`Approved payment #${paymentId}`);
    return tx;
  }

  async rejectPayment(paymentId: number) {
    const tx = await this.contract.rejectPayment(paymentId);
    await tx.wait();
    console.log(`Rejected payment #${paymentId}`);
    return tx;
  }

  async emergencyPause() {
    const tx = await this.contract.emergencyPause();
    await tx.wait();
    console.log("Emergency pause activated");
    return tx;
  }

  async unpause() {
    const tx = await this.contract.unpause();
    await tx.wait();
    console.log("Contract unpaused");
    return tx;
  }

  // ============ Agent Functions ============

  async pay(
    recipientAddress: string,
    amountMON: string,
    reason: string,
    taskId: string,
    agentId: string
  ) {
    const amount = ethers.parseEther(amountMON);
    try {
      const tx = await this.contract.agentPay(recipientAddress, amount, reason, taskId, agentId, { gasLimit: 500000 });
      // Wait for receipt with retry on RPC rate limits
      let receipt;
      for (let i = 0; i < 5; i++) {
        try {
          receipt = await tx.wait();
          break;
        } catch (waitErr: any) {
          const msg = waitErr?.message || "";
          if ((msg.includes("rate limit") || msg.includes("coalesce")) && i < 4) {
            console.log(`[pay] tx.wait() RPC issue, retry ${i + 1}/4...`);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw waitErr;
        }
      }
      console.log(`Agent paid ${amountMON} MON to ${recipientAddress} — reason: ${reason}`);
      return { success: true, tx };
    } catch (error: any) {
      const errorMsg = error?.reason || error?.message || "Unknown error";
      console.log(`Payment failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  async agentWithdraw(amountMON: string) {
    const amount = ethers.parseEther(amountMON);
    try {
      const tx = await this.contract.agentWithdraw(amount);
      await tx.wait();
      console.log(`Agent withdrew ${amountMON} MON`);
      return { success: true, tx };
    } catch (error: any) {
      const errorMsg = error?.reason || error?.message || "Unknown error";
      console.log(`Withdraw failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  // ============ Agent-Native Enhanced Functions ============

  /**
   * Pre-flight policy check — Agent checks if a payment would succeed before sending tx.
   * Returns structured result with reasons if blocked.
   */
  async checkBudget(amountMON: string, recipientAddress?: string): Promise<{
    canPay: boolean;
    reasons: string[];
    remaining: { paysLeft: number; spendLeftMON: string };
    agentConfig: any;
  }> {
    const reasons: string[] = [];
    const amount = ethers.parseEther(amountMON);
    const agentAddress = this.signer.address;

    // Fetch current state
    const [config, dailyOps, balance, isActive] = await Promise.all([
      this.getAgentConfig(agentAddress),
      this.getAgentDailyOps(agentAddress),
      this.getBalance(),
      this.isAgentActive(agentAddress),
    ]);

    // Check 1: Active + not expired
    if (!isActive) {
      reasons.push("Agent not active or session key expired");
    }

    // Check 2: Personal single limit
    if (parseFloat(amountMON) > parseFloat(config.singleLimit)) {
      reasons.push(`Exceeds personal single limit (${amountMON} > ${config.singleLimit} MON)`);
    }

    // Check 3: Global single limit (1 MON)
    if (parseFloat(amountMON) > 1) {
      reasons.push(`Exceeds global single limit (1 MON)`);
    }

    // Check 4: Contract balance
    if (parseFloat(amountMON) > parseFloat(balance)) {
      reasons.push(`Insufficient vault balance (${balance} MON)`);
    }

    // Check 5: Daily pay count
    if (dailyOps.paysLeft <= 0) {
      reasons.push("Daily pay count exhausted");
    }

    // Check 6: Daily spend limit
    if (parseFloat(amountMON) > parseFloat(dailyOps.spendLeft)) {
      reasons.push(`Exceeds daily spend limit (remaining: ${dailyOps.spendLeft} MON)`);
    }

    // Check 7: Whitelist
    if (config.whitelistEnabled && recipientAddress) {
      const allowed = await this.contract.whitelist(agentAddress, recipientAddress);
      if (!allowed) {
        reasons.push(`Recipient ${recipientAddress} not in whitelist`);
      }
    }

    // Check 8: Approval required (not a block, but informational)
    if (config.requireApproval) {
      reasons.push("Note: payment will require human approval before execution");
    }

    return {
      canPay: reasons.filter(r => !r.startsWith("Note:")).length === 0,
      reasons,
      remaining: { paysLeft: dailyOps.paysLeft, spendLeftMON: dailyOps.spendLeft },
      agentConfig: config,
    };
  }

  /**
   * Agent payment with auto-retry and structured error translation.
   * Tries checkBudget first, then sends tx with retries on transient failures.
   */
  async payWithRetry(
    recipientAddress: string,
    amountMON: string,
    reason: string,
    taskId: string,
    agentId: string,
    maxRetries: number = 2
  ): Promise<{
    success: boolean;
    tx?: any;
    error?: PaymentError;
    preCheck?: any;
  }> {
    // Step 1: Pre-flight check
    const preCheck = await this.checkBudget(amountMON, recipientAddress);
    const hardBlocks = preCheck.reasons.filter(r => !r.startsWith("Note:"));

    if (hardBlocks.length > 0) {
      console.log(`[payWithRetry] Pre-check failed: ${hardBlocks.join("; ")}`);
      return {
        success: false,
        error: translateError(hardBlocks[0]),
        preCheck,
      };
    }

    // Step 2: Send with retry
    let lastError: PaymentError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.pay(recipientAddress, amountMON, reason, taskId, agentId);
        if (result.success) {
          return { success: true, tx: result.tx, preCheck };
        }
        // pay() caught a contract revert
        lastError = translateError(result.error);
        // Only retry on transient errors (nonce, gas, network)
        if (!lastError.canRetry) break;
        console.log(`[payWithRetry] Attempt ${attempt + 1} failed (retryable), retrying...`);
        await sleep(2000 * (attempt + 1));
      } catch (error: any) {
        lastError = translateError(error?.reason || error?.message || "Unknown error");
        if (!lastError.canRetry) break;
        console.log(`[payWithRetry] Attempt ${attempt + 1} threw error (retryable), retrying...`);
        await sleep(2000 * (attempt + 1));
      }
    }

    return { success: false, error: lastError || translateError("Unknown error"), preCheck };
  }

  /**
   * Agent requests a limit increase — calls updateAgentConfig with new limits.
   * Only works if signer is the owner (agents can't self-raise limits).
   */
  async requestLimitIncrease(
    agentAddress: string,
    newDailyLimitMON: string,
    newSingleLimitMON: string,
    expiryHours: number
  ) {
    return this.updateAgentConfig(agentAddress, newDailyLimitMON, newSingleLimitMON, expiryHours);
  }

  // ============ View Functions ============

  async getBalance() {
    const balance = await this.contract.getBalance();
    return ethers.formatEther(balance);
  }

  async getAgentConfig(agentAddress: string) {
    const config = await this.contract.getAgentConfig(agentAddress);
    return {
      singleLimit: ethers.formatEther(config[0]),
      dailySpendLimit: ethers.formatEther(config[1]),
      spentToday: ethers.formatEther(config[2]),
      expiry: Number(config[3]),
      active: config[4],
      requireApproval: config[5],
      whitelistEnabled: config[6],
    };
  }

  async getAgentDailyOps(agentAddress: string) {
    const ops = await this.contract.getAgentDailyOps(agentAddress);
    return {
      depositsLeft: Number(ops[0]),
      withdrawsLeft: Number(ops[1]),
      paysLeft: Number(ops[2]),
      spendLeft: ethers.formatEther(ops[3]),
    };
  }

  async getLedgerCount() {
    const count = await this.contract.getLedgerCount();
    return Number(count);
  }

  async getLedgerEntry(index: number) {
    const entry = await this.contract.getLedgerEntry(index);
    return {
      operator: entry[0],
      opType: entry[1],
      amount: ethers.formatEther(entry[2]),
      counterparty: entry[3],
      reason: entry[4],
      timestamp: Number(entry[5]),
    };
  }

  async isAgentActive(agentAddress: string) {
    return this.contract.isAgentActive(agentAddress);
  }

  async getPaymentLogs(fromBlock: number = 0) {
    const filter = this.contract.filters.AgentPayment();
    const events = await this.contract.queryFilter(filter, fromBlock);
    return events.map((e: any) => ({
      agent: e.args[0],
      recipient: e.args[1],
      amount: ethers.formatEther(e.args[2]),
      reason: e.args[3],
      taskId: e.args[4],
      agentId: e.args[5],
      timestamp: new Date(Number(e.args[6]) * 1000).toISOString(),
      autoApproved: e.args[7],
      policyHit: e.args[8] || "unknown",
    }));
  }
}
