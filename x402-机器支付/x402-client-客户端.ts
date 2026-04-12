/**
 * AgentVault x402 Client — HTTP 402 支付客户端中间件
 *
 * 让 AgentVault Agent 可通过 x402 协议按次付费调用 API。
 * 流程: 请求资源 → 402 + 支付信息 → AgentVault 签名支付 → 重试请求 → 200 返回资源
 *
 * 用法:
 *   const client = new X402Client(sdk);
 *   const data = await client.fetch("http://localhost:3001/api/gpt4", { amountMax: "0.01" });
 */
import { ethers } from "ethers";
import { AgentVaultSDK } from "../sdk-开发包/agent-vault-standalone-独立SDK";

// ============ Types ============

export interface X402PaymentRequirements {
  /** 收款方地址 */
  payTo: string;
  /** 支付金额（MON） */
  amount: string;
  /** 资源描述 */
  resource: string;
  /** 支付网络（默认 monad-testnet） */
  network?: string;
  /** 支付 ID（用于防重放） */
  paymentId?: string;
}

export interface X402Response {
  success: boolean;
  status: number;
  data?: any;
  paymentInfo?: X402PaymentRequirements;
  receipt?: {
    txHash: string;
    amount: string;
    recipient: string;
    timestamp: number;
  };
  error?: string;
}

// ============ X402 Client ============

export class X402Client {
  private sdk: AgentVaultSDK;
  private signer: ethers.Wallet;

  constructor(sdk: AgentVaultSDK, signer: ethers.Wallet) {
    this.sdk = sdk;
    this.signer = signer;
  }

  /**
   * 发起 x402 付费请求
   * @param url 目标 API URL
   * @param options.amountMax 最大可接受金额（MON），超过则拒绝
   * @param options.reason 支付原因
   * @param options.taskId 任务 ID
   * @param options.agentId Agent 标识
   */
  async fetch(
    url: string,
    options: {
      amountMax?: string;
      reason?: string;
      taskId?: string;
      agentId?: string;
    } = {}
  ): Promise<X402Response> {
    const { amountMax, reason = "x402 API call", taskId = "x402-auto", agentId = "agentvault-x402" } = options;

    // Step 1: 发起初始请求
    console.log(`[x402] Requesting ${url}...`);
    const initialResp = await globalThis.fetch(url);

    // 如果不是 402，直接返回
    if (initialResp.status !== 402) {
      const data = initialResp.status === 200 ? await initialResp.json() : null;
      return { success: initialResp.status === 200, status: initialResp.status, data };
    }

    // Step 2: 解析 402 支付要求
    const paymentBody = await initialResp.json();
    const paymentReq: X402PaymentRequirements = {
      payTo: paymentBody.payTo || paymentBody.pay_to,
      amount: paymentBody.amount || paymentBody.price,
      resource: paymentBody.resource || url,
      network: paymentBody.network || "monad-testnet",
      paymentId: paymentBody.paymentId || paymentBody.payment_id,
    };

    console.log(`[x402] Payment required: ${paymentReq.amount} MON to ${paymentReq.payTo}`);

    // Step 3: 检查金额上限
    if (amountMax && parseFloat(paymentReq.amount) > parseFloat(amountMax)) {
      return {
        success: false,
        status: 402,
        paymentInfo: paymentReq,
        error: `Amount ${paymentReq.amount} MON exceeds max ${amountMax} MON`,
      };
    }

    // Step 4: 预检预算
    const budgetCheck = await this.sdk.checkBudget(paymentReq.amount, paymentReq.payTo);
    if (!budgetCheck.canPay) {
      return {
        success: false,
        status: 402,
        paymentInfo: paymentReq,
        error: `Budget check failed: ${budgetCheck.reasons.join("; ")}`,
      };
    }

    // Step 5: 通过 AgentVault 合约执行支付
    const payResult = await this.sdk.payWithRetry(
      paymentReq.payTo,
      paymentReq.amount,
      reason,
      taskId,
      agentId
    );

    if (!payResult.success) {
      return {
        success: false,
        status: 402,
        paymentInfo: paymentReq,
        error: `Payment failed: ${payResult.error?.message || "unknown"}`,
      };
    }

    // Step 6: 带支付凭证重试请求
    console.log(`[x402] Payment done, retrying request with receipt...`);
    const receiptHeaders: Record<string, string> = {
      "X-Payment-Receipt": payResult.tx?.hash || "",
      "X-Payment-Amount": paymentReq.amount,
      "X-Payment-Recipient": paymentReq.payTo,
    };

    const retryResp = await globalThis.fetch(url, {
      headers: {
        ...receiptHeaders,
        "X-Agent-Id": agentId,
        "X-Task-Id": taskId,
      },
    });

    if (retryResp.status === 200) {
      const data = await retryResp.json();
      return {
        success: true,
        status: 200,
        data,
        receipt: {
          txHash: payResult.tx?.hash || "",
          amount: paymentReq.amount,
          recipient: paymentReq.payTo,
          timestamp: Date.now(),
        },
      };
    }

    return {
      success: false,
      status: retryResp.status,
      error: `Retry failed with status ${retryResp.status}`,
    };
  }
}
