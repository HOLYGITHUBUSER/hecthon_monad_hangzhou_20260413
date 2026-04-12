# AgentVault SDK 文档

## 概述

SDK 文件：`sdk-开发包/agent-vault-standalone-独立SDK.ts`

纯 ethers.js v6，无 Hardhat 依赖。分三层：
- **基础层** — 合约函数 1:1 封装
- **Agent 原生层** — 预检 + 重试 + 错误翻译（赛题 #3 核心）
- **查询层** — 链上数据读取

---

## 构造函数

```typescript
new AgentVaultSDK(contractAddress: string, signer: ethers.Wallet, abi: any[])
```

ABI 从 `deployment.json` 读取。

---

## Owner 函数

### `deposit(amount: string)`
向合约存入 MON。
- `amount` — MON 数量字符串，如 `"10"`

### `withdraw(amount: string)`
从合约提款到 owner 地址。
- `amount` — MON 数量字符串

### `authorizeAgent(agentAddress, dailyLimitMON, singleLimitMON, expiryHours, requireApproval?, whitelistEnabled?)`
授权 Agent，设置支付限额和过期时间。
- `agentAddress` — Agent 钱包地址
- `dailyLimitMON` — 日限额（MON 字符串）
- `singleLimitMON` — 单笔限额（MON 字符串）
- `expiryHours` — Session Key 有效时长（小时）
- `requireApproval` — 是否每笔需人工审批（默认 false）
- `whitelistEnabled` — 是否启用白名单（默认 false）

### `revokeAgent(agentAddress)`
撤销 Agent 权限。

### `updateAgentConfig(agentAddress, dailyLimitMON, singleLimitMON, expiryHours, requireApproval?, whitelistEnabled?)`
更新 Agent 配置。

### `updateAgentExpiry(agentAddress, expiryHours)`
更新 Agent 过期时间（简化版）。

### `addWhitelist(agentAddress, recipientAddress)`
为 Agent 添加收款方白名单。

### `removeWhitelist(agentAddress, recipientAddress)`
为 Agent 移除收款方白名单。

### `approvePayment(paymentId)`
批准待审批支付。

### `rejectPayment(paymentId)`
拒绝待审批支付。

### `emergencyPause()`
紧急暂停合约，所有支付操作被阻止。

### `unpause()`
取消暂停。

---

## Agent 函数

### `pay(recipientAddress, amountMON, reason, taskId, agentId)`
Agent 发起支付。
- `recipientAddress` — 收款方地址
- `amountMON` — 金额（MON 字符串）
- `reason` — 支付原因描述
- `taskId` — 任务 ID
- `agentId` — Agent 标识

**返回值**：
```typescript
{ success: true, tx } // 支付成功
{ success: false, error: string } // 支付失败（被合约拒绝等）
```

### `agentWithdraw(amountMON)`
Agent 从合约取钱到自己的钱包。
- `amountMON` — 金额（MON 字符串）

---

## Agent 原生增强函数

### `checkBudget(amountMON, recipientAddress?)`
支付前预检——本地模拟 10 道安全检查，避免浪费 gas。
- `amountMON` — 金额（MON 字符串）
- `recipientAddress` — 收款方地址（可选，用于白名单检查）

**返回值**：
```typescript
{
  canPay: boolean,           // 是否可以支付
  reasons: string[],         // 阻塞原因列表
  remaining: {
    paysLeft: number,        // 今日剩余支付次数
    spendLeftMON: string     // 今日剩余消费额度（MON）
  },
  agentConfig: object        // Agent 完整配置
}
```

### `payWithRetry(recipientAddress, amountMON, reason, taskId, agentId, maxRetries?)`
Agent 支付（带自动重试 + 结构化错误翻译）。推荐使用此函数代替 `pay`。
- 先调用 `checkBudget` 预检
- 预检通过后发送交易
- 失败时根据错误类型决定是否重试（nonce/gas 错误自动重试，策略错误不重试）
- `maxRetries` — 最大重试次数（默认 2）

**返回值**：
```typescript
{
  success: boolean,
  tx?: any,                    // 成功时的交易回执
  error?: PaymentError,        // 失败时的结构化错误
  preCheck?: object            // 预检结果
}
```

**PaymentError 结构**：
```typescript
{
  code: string,           // 机器可读错误码（如 "SINGLE_LIMIT", "DAILY_SPEND_LIMIT"）
  message: string,        // 原始错误信息
  canRetry: boolean,      // 是否可重试
  suggestion?: string     // Agent 下一步建议
}
```

错误码映射：

| 合约 revert | code | canRetry | suggestion |
|-------------|------|----------|------------|
| Agent not authorized | `NOT_AUTHORIZED` | false | 请求 Owner 授权 |
| Session key expired | `SESSION_EXPIRED` | false | 请求 Owner 延长过期时间 |
| Contract is paused | `PAUSED` | true | 等待 Owner 取消暂停 |
| Exceeds personal single limit | `SINGLE_LIMIT` | false | 请求提额或拆分支付 |
| Exceeds global single limit | `GLOBAL_LIMIT` | false | 超过 1 MON 全局上限 |
| Insufficient balance | `INSUFFICIENT_BALANCE` | true | 等待 Vault 充值 |
| Daily pay limit reached | `DAILY_PAY_LIMIT` | true | 等待明日重置 |
| Exceeds daily spend limit | `DAILY_SPEND_LIMIT` | false | 请求 Owner 提高日限额 |
| Recipient not in whitelist | `WHITELIST` | false | 请求 Owner 添加白名单 |
| Transfer failed | `TRANSFER_FAILED` | true | 重试支付 |

### `requestLimitIncrease(agentAddress, newDailyLimitMON, newSingleLimitMON, expiryHours)`
Agent 请求提额（需 Owner 钱包签名执行）。

---

## 查看函数

### `getBalance()`
返回合约余额（MON 字符串）。

### `getAgentConfig(agentAddress)`
返回 Agent 配置对象：
```typescript
{
  singleLimit: string,        // MON
  dailySpendLimit: string,    // MON
  spentToday: string,         // MON
  expiry: number,             // Unix 时间戳
  active: boolean,
  requireApproval: boolean,
  whitelistEnabled: boolean
}
```

### `getAgentDailyOps(agentAddress)`
返回 Agent 今日剩余操作次数和消费额度：
```typescript
{
  depositsLeft: number,
  withdrawsLeft: number,
  paysLeft: number,
  spendLeft: string  // MON
}
```

### `isAgentActive(agentAddress)`
返回 Agent 是否活跃（已授权 + 未过期）。

### `getLedgerCount()`
返回账本总条数。

### `getLedgerEntry(index)`
返回账本条目详情：
```typescript
{
  operator: string,
  opType: string,       // "deposit" / "withdraw" / "pay" / "approve"
  amount: string,       // MON
  counterparty: string,
  reason: string,
  timestamp: number
}
```

### `getPaymentLogs(fromBlock?)`
查询链上所有 `AgentPayment` 事件，返回支付审计日志数组：
```typescript
[{
  agent: string,
  recipient: string,
  amount: string,          // MON
  reason: string,
  taskId: string,
  agentId: string,
  timestamp: string,       // ISO 8601
  autoApproved: boolean,
  policyHit: string        // "auto_approved" / "whitelist_checked" / "human_approved"
}]
```

---

## 使用示例

```typescript
import { ethers } from "ethers";
import { AgentVaultSDK } from "./sdk-开发包/agent-vault-standalone-独立SDK";
import deployment from "./deployment.json";

const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const sdk = new AgentVaultSDK(deployment.address, wallet, deployment.abi);

// 存款
await sdk.deposit("10");

// 授权 Agent（带白名单）
await sdk.authorizeAgent(agentAddr, "20", "5", 24, false, true);
await sdk.addWhitelist(agentAddr, recipientAddr);

// Agent 预检
const check = await agentSdk.checkBudget("0.5", recipientAddr);
if (!check.canPay) {
  console.log("Cannot pay:", check.reasons);
  return;
}

// Agent 支付（带重试）
const result = await agentSdk.payWithRetry(recipientAddr, "0.5", "API fee", "task-1", "claude-code");
if (!result.success && result.error) {
  console.log(`Error: ${result.error.code} — ${result.error.suggestion}`);
}

// 查看审计日志（含策略命中）
const logs = await sdk.getPaymentLogs();
logs.forEach(log => console.log(`${log.agentId}: ${log.amount} MON — policy: ${log.policyHit}`));
```
