# AgentVault 完整演示指南

Monad Blitz @ 杭州 V2 — Agentic Payment 参赛项目

---

## 演示前准备

```bash
# 1. 安装依赖
npm install

# 2. 确认 .env 已配置 PRIVATE_KEY
cat .env

# 3. 确认合约已部署
cat deployment.json | grep address

# 4. 初始化金库（存钱 + 授权 Agent）
npx tsx scripts-脚本/setup-vault-初始化金库.ts
```

---

## 第一幕：总览（1 分钟）

> "AgentVault 是一个非托管的链上保险箱，让 AI Agent 能在用户授权下自主支付，同时确保安全、可控、可审计。"

### 展示点

- 合约余额
- 已授权 Agent 列表
- 链上账本

```bash
# 查看合约余额
npx tsx -e "
const { ethers } = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();
async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const dep = JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
  const contract = new ethers.Contract(dep.address, ['function getBalance() view returns (uint256)'], provider);
  console.log('Vault 余额:', ethers.formatEther(await contract.getBalance()), 'MON');
}
main();
"

# 查看 Agent 配置
npx tsx scripts-脚本/setup-vault-初始化金库.ts
```

---

## 第二幕：Agent 自主支付（1 分钟）

> "Agent 在限额内可以自主支付，不需要人类干预。"

### 场景 2.1：小额自动通过 ✅

Agent A（单笔限额 0.5 MON）支付 0.3 MON 调用 GPT-4 API：

```bash
npx tsx demo-演示/scenario1-success-场景1成功支付.ts
```

**预期结果**：支付成功，链上记录自动写入，policyHit = "auto_approved"

### 场景 2.2：超额被拒 ❌

Agent B（单笔限额 0.2 MON）尝试支付 0.3 MON 租 GPU：

```bash
npx tsx demo-演示/scenario2-rejected-场景2拒绝支付.ts
```

**预期结果**：合约拒绝，错误信息翻译为"超过个人单笔限额"

### 场景 2.3：支付带自动重试

Agent 支付失败后自动重试（MCP 工具 `pay_with_retry`）：

```bash
# 通过 MCP 调用
# 工具: pay_with_retry
# 参数: recipient, amount_mon="0.01", reason="API call", task_id="retry-demo", agent_id="agent-A", max_retries=2
```

---

## 第三幕：安全防线（1.5 分钟）

> "10 道安全防线，攻击全部失败。"

### 攻击模拟 1：未授权地址调用

```bash
# 陌生人尝试调用 agentPay → 被拒
# 错误: "Agent not authorized"
```

### 攻击模拟 2：过期 Session Key

```bash
# 过期 Agent 尝试支付 → 被拒
# 错误: "Session key expired"
```

### 攻击模拟 3：白名单绕过

```bash
# Agent C（启用白名单）尝试付给非白名单地址 → 被拒
# 错误: "Recipient not in whitelist"
```

### 攻击模拟 4：超过全局单笔上限

```bash
# Agent 尝试支付 > 1 MON → 被拒
# 错误: "Exceeds global single limit"
```

### 攻击模拟 5：超过每日操作次数

```bash
# Agent 连续支付 11 次 → 第 11 次被拒
# 错误: "Daily pay limit reached"
```

### 攻击模拟 6：超过日消费上限

```bash
# Agent 累计消费超过 dailySpendLimit → 被拒
# 错误: "Exceeds daily spend limit"
```

### 攻击模拟 7：非 Owner 调用管理函数

```bash
# Agent 尝试调用 withdraw / authorizeAgent → 被拒
# 错误: "Only owner"
```

### 攻击模拟 8：合约暂停时操作

```bash
# Owner 执行 emergencyPause → Agent 支付被拒
# 错误: "Contract is paused"
```

### 攻击模拟 9：重复审批

```bash
# Owner 批准支付 #0 后，再次批准 #0 → 被拒
# 错误: "Already approved"
```

### 攻击模拟 10：合约余额不足

```bash
# 合约余额为 0 时 Agent 尝试支付 → 被拒
# 错误: "Insufficient balance"
```

> 完整攻击模拟脚本：`npx tsx test-攻击模拟/attack-simulation-攻击模拟.ts`（待创建）

---

## 第四幕：审批流程（1 分钟）

> "需要审批的 Agent 支付会先挂起，Owner 批准后才执行。"

### 场景 4.1：支付挂起

Agent C（requireApproval = true）发起支付 → 支付挂起，等待审批

### 场景 4.2：Telegram 审批（🟡E 计划中）

1. Agent 发起支付 → 合约挂起
2. Telegram Bot 推送审批请求（含金额、原因、Agent、收款方）
3. 手机点 ✅ 批准 / ❌ 拒绝
4. 链上执行

```bash
# 启动 Telegram Bot
npx tsx bot-机器人/telegram-approval-审批通知.ts
```

### 场景 4.3：命令行审批

```bash
# MCP 工具: pending_approvals → 查看待审批列表
# MCP 工具: request_limit_increase → 批准/拒绝
```

---

## 第五幕：紧急暂停（30 秒）

> "异常情况下一键锁死，所有操作立即冻结。"

```bash
# Owner 暂停
npx tsx -e "
// emergencyPause()
"

# Agent 尝试支付 → 被拒: 'Contract is paused'

# Owner 恢复
npx tsx -e "
// unpause()
"
```

---

## 第六幕：差异化 Agent 管理（1 分钟）

> "每个 Agent 独立配置：单笔上限、日消费上限、审批要求、白名单——一张主卡，多张受限副卡。"

### 场景 6.1：授权新 Agent

```bash
npx tsx scripts-脚本/setup-vault-diff-差异化授权.ts
```

### 场景 6.2：调整 Agent 配置

```bash
# MCP 工具: request_limit_increase
# 参数: agent_address, new_daily_limit_mon="2", new_single_limit_mon="0.5", expiry_hours=24
```

### 场景 6.3：撤销 Agent

```bash
# revokeAgent(agent_address) → Agent 立即失效
```

### 场景 6.4：Session Key 过期自动失效

```bash
# 授权 Agent 过期时间为 1 小时后
# 1 小时后 Agent 调用 → 被拒: 'Session key expired'
# 无需手动撤销，时间到了自动失效
```

---

## 第七幕：链上审计（30 秒）

> "所有操作记入链上账本，透明、不可篡改、可追溯。"

```bash
npx tsx demo-演示/scenario3-audit-场景3审计日志.ts
```

**展示内容**：
- 每条记录：操作者、操作类型、金额、对手方、原因、时间戳
- policyHit 字段：命中了哪条策略（auto_approved / whitelist_checked / human_approved）

---

## 第八幕：x402 按次付费（🟡D 计划中，1 分钟）

> "Agent 通过 x402 协议自主完成：请求 API → 收到 402 → 自动支付 → 获取数据。"

```bash
# MCP 工具: x402_pay_api
# 参数: url="https://api.example.com/premium", amount_max="0.01", reason="data fetch"
```

**展示流程**：
1. Agent 请求付费 API
2. API 返回 402 + 支付要求
3. Agent 自动从 Vault 支付
4. 获取 API 数据

---

## 第九幕：MCP 工具全景（1 分钟）

> "11 个 MCP 工具，AI Agent 直接调用，无需写代码。"

| 工具 | 演示 |
|------|------|
| `check_budget` | "我能付 0.5 MON 吗？" → 预检结果 |
| `pay` | "付 0.01 MON 给 0x..." → 链上执行 |
| `pay_with_retry` | "付钱，失败了自动重试" → 智能重试 |
| `get_balance` | "Vault 还有多少钱？" → 余额查询 |
| `get_agent_config` | "我的限额是多少？" → 配置查询 |
| `get_daily_ops` | "我今天还能花几次？" → 剩余次数 |
| `get_ledger` | "最近 5 笔操作" → 账本查询 |
| `get_payment_logs` | "支付审计日志" → 事件查询 |
| `request_limit_increase` | "我要提额" → 请求提额 |
| `pending_approvals` | "有哪些待审批？" → 审批队列 |
| `x402_pay_api` | "调用付费 API" → x402 支付 |

---

## 第十幕：前端 Dashboard（🟡 计划中）

> "可视化总览：余额、Agent 状态、账本、审批队列一目了然。"

- 余额卡片
- Agent 列表（配置 + 剩余额度）
- 实时账本
- 审批队列
- 支付按钮

---

## 演示时间分配

| 幕 | 内容 | 时间 | 状态 |
|----|------|------|------|
| 1 | 总览 | 1min | ✅ 可演示 |
| 2 | Agent 自主支付 | 1min | ✅ 可演示 |
| 3 | 安全防线（10 道攻击） | 1.5min | 🔴 需写脚本 |
| 4 | 审批流程 | 1min | ✅ Telegram Bot 已实现 |
| 5 | 紧急暂停 | 30s | ✅ 可演示 |
| 6 | 差异化 Agent 管理 | 1min | ✅ 可演示 |
| 7 | 链上审计 | 30s | ✅ 可演示 |
| 8 | x402 按次付费 | 1min | ✅ 已实现（需测试） |
| 9 | MCP 工具全景 | 1min | ✅ 可演示 |
| 10 | 前端 Dashboard | 1min | ✅ 已实现（需完善） |
| 11 | OpenClaw Agent | 1min | ✅ 已部署运行 |
| **总计** | | **~11min** | |

---

## 一句话总结

> **AgentVault = 用户持主卡，Agent 持受限副卡，小额自动过，超额需审批，10 道防线全部链上执行，所有操作链上可查。**
