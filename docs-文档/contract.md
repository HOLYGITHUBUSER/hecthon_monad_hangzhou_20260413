# AgentVault 智能合约文档

## 概述

`contracts-合约/AgentVault.sol` — 458 行，Solidity 0.8.28，非托管智能合约钱包。

**核心设计**：用户持有私钥（主控），Agent 只有 Session Key（受限副卡），小额自动支付，超额需人类审批。

---

## 数据结构

### AgentConfig

```solidity
struct AgentConfig {
    uint256 singleLimit;        // 个人单笔上限（wei）
    uint256 dailySpendLimit;    // 个人每日消费上限（wei）
    uint256 spentToday;         // 今日已消费金额（wei）
    uint256 expiry;             // Session Key 过期时间戳
    bool active;                // Agent 是否已被授权
    bool requireApproval;       // 是否每笔支付都需要人工审批
    bool whitelistEnabled;      // 是否启用白名单
    uint256 lastResetDay;       // 上次重置日期
    uint256 depositCountToday;  // 今日存入次数
    uint256 withdrawCountToday; // 今日取出次数
    uint256 payCountToday;      // 今日支付次数
}
```

### PendingPayment

```solidity
struct PendingPayment {
    address agent;
    address recipient;
    uint256 amount;
    string reason;
    string taskId;
    string agentId;
    bool approved;
    bool exists;
}
```

---

## 状态变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `owner` | address | 合约所有者 |
| `paused` | bool | 紧急暂停状态 |
| `maxSingleLimit` | uint256 | 全局单笔上限（1 MON） |
| `maxDailyOps` | uint256 | 每人每天每种操作最大次数（10） |
| `agents` | mapping(address → AgentConfig) | Agent 配置映射 |
| `whitelist` | mapping(agent → recipient → bool) | 白名单映射 |
| `ledger` | LedgerEntry[] | 链上账本 |
| `ledgerCount` | uint256 | 账本条目总数 |
| `pendingPayments` | mapping(uint256 → PendingPayment) | 待审批支付 |
| `pendingPaymentCount` | uint256 | 待审批支付计数器 |

---

## 事件

| 事件 | 参数 | 触发时机 |
|------|------|----------|
| `Deposited` | user, amount | 存款 |
| `AgentAuthorized` | agent, singleLimit, dailySpendLimit, expiry, requireApproval, whitelistEnabled | 授权 Agent |
| `AgentRevoked` | agent | 撤销 Agent |
| `AgentConfigUpdated` | agent, singleLimit, dailySpendLimit, expiry | 更新 Agent 配置 |
| `AgentPayment` | agent, recipient, amount, reason, taskId, agentId, timestamp, autoApproved, **policyHit** | 支付成功 |
| `PaymentPendingApproval` | paymentId, agent, recipient, amount | 支付待人工审批 |
| `PaymentApproved` | paymentId, approvedBy | 人工批准支付 |
| `PaymentRejectedByHuman` | paymentId, rejectedBy | 人工拒绝支付 |
| `Withdrawn` | user, amount | 提款 |
| `EmergencyPaused` | by | 紧急暂停 |
| `EmergencyUnpaused` | by | 取消暂停 |
| `WhitelistAdded` | agent, recipient | 添加白名单 |
| `WhitelistRemoved` | agent, recipient | 移除白名单 |
| `LedgerEntryAdded` | index, operator, opType, amount | 账本新增条目 |

---

## 函数

### 用户（Owner）函数

| 函数 | 参数 | 说明 |
|------|------|------|
| `deposit()` | payable | 存入 MON（任何人可调用，受单笔上限和日次数限制） |
| `withdraw(amount)` | amount | 提款到 owner 地址（仅 Owner，任意金额） |
| `authorizeAgent(agent, singleLimit, dailySpendLimit, expiry, requireApproval, whitelistEnabled)` | — | 授权 Agent，差异化配置 |
| `revokeAgent(agent)` | — | 撤销 Agent 权限 |
| `updateAgentConfig(agent, singleLimit, dailySpendLimit, expiry, requireApproval, whitelistEnabled)` | — | 更新 Agent 配置 |
| `updateAgentExpiry(agent, expiry)` | — | 更新 Agent 过期时间（简化版） |
| `addWhitelist(agent, recipient)` | — | 添加白名单 |
| `removeWhitelist(agent, recipient)` | — | 移除白名单 |
| `approvePayment(paymentId)` | — | 批准待审批支付 |
| `rejectPayment(paymentId)` | — | 拒绝待审批支付 |
| `emergencyPause()` | — | 紧急暂停合约 |
| `unpause()` | — | 取消暂停 |
| `setMaxSingleLimit(limit)` | — | 修改全局单笔上限 |
| `setMaxDailyOps(ops)` | — | 修改每日操作次数上限 |

### Agent 函数

| 函数 | 参数 | 说明 |
|------|------|------|
| `agentPay(recipient, amount, reason, taskId, agentId)` | — | Agent 发起支付（受限额/白名单/审批约束） |
| `agentWithdraw(amount)` | amount | Agent 从合约取钱到自己的钱包（受个人单笔限额+日次数约束） |

### 查看函数

| 函数 | 返回值 | 说明 |
|------|--------|------|
| `getBalance()` | uint256 | 合约余额 |
| `getAgentConfig(agent)` | singleLimit, dailySpendLimit, spentToday, expiry, active, requireApproval, whitelistEnabled | Agent 完整配置 |
| `getAgentDailyOps(agent)` | depositsLeft, withdrawsLeft, paysLeft, spendLeft | Agent 今日剩余操作次数和消费额度 |
| `getLedgerCount()` | uint256 | 账本总条数 |
| `getLedgerEntry(index)` | operator, opType, amount, counterparty, reason, timestamp | 账本条目详情 |
| `isAgentActive(agent)` | bool | Agent 是否活跃（已授权 + 未过期） |

---

## 支付安全检查流程

`agentPay()` 执行时依次检查：

1. **Agent 是否已授权** — `agents[msg.sender].active == true`（`onlyActiveAgent` 修饰符）
2. **Session Key 是否过期** — `block.timestamp <= config.expiry`（`onlyActiveAgent` 修饰符）
3. **合约是否暂停** — `!paused`（`notPaused` 修饰符）
4. **个人单笔限额** — `amount <= config.singleLimit`
5. **全局单笔限额** — `amount <= maxSingleLimit`（1 MON）
6. **合约余额充足** — `amount <= address(this).balance`
7. **每日支付次数** — `config.payCountToday < maxDailyOps`（10 次）
8. **日消费限额** — `config.spentToday + amount <= config.dailySpendLimit`（新的一天自动重置）
9. **白名单检查** — 如果 `config.whitelistEnabled == true`，收款方必须在白名单内
10. **审批检查** — 如果 `requireApproval == true`，支付进入待审批队列，不立即执行

### 策略命中记录（policyHit）

每笔成功支付的事件中包含 `policyHit` 字段，记录命中的策略：

| policyHit 值 | 含义 |
|-------------|------|
| `auto_approved` | 自动通过（无白名单、无审批） |
| `whitelist_checked` | 白名单检查通过后自动执行 |
| `human_approved` | 人工审批通过后执行 |

---

## 白名单机制（已修复 ✅）

白名单使用 `whitelistEnabled` bool 字段控制启用，逻辑清晰：

```solidity
// 授权时设置
agents[agent] = AgentConfig({
    ...
    whitelistEnabled: _whitelistEnabled,
    ...
});

// 支付时检查
if (config.whitelistEnabled) {
    require(whitelist[msg.sender][recipient], "Recipient not in whitelist");
}
```

- `addWhitelist(agent, recipient)` — 添加白名单地址
- `removeWhitelist(agent, recipient)` — 移除白名单地址
- 早期版本使用 `address(0)` / `address(1)` 作为标志位，存在 Bug，已通过 `whitelistEnabled` 字段修复
