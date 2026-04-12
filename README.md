<div align="center">

# 🏦 AgentVault

### AI Agent 安全支付金库 — 让 AI 帮你花钱，但只能按你的规则花

**Monad Blitz @ 杭州 V2 — Agentic Payment 参赛项目**

[![Monad Testnet](https://img.shields.io/badge/Chain-Monad%20Testnet-836EF9?logo=ethereum)](https://testnet.monad.xyz)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Protocol-FF6B35?logo=anthropic)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 💡 一句话

> 你存钱进链上金库，AI Agent 按你设的规则帮你花钱。Agent 只能花限额内的钱，你随时可以一键撤销。

---

## ✨ 核心亮点

| 亮点 | 说明 |
|------|------|
| 🔐 **非托管** | 你的钱在链上合约里，没有第三方，代码即规则 |
| 🎯 **差异化授权** | 每个 Agent 独立配置：单笔限额 / 日限额 / 过期时间 / 审批 / 白名单 |
| 🤖 **Agent 原生** | 预检 → 支付 → 自动重试 → 结构化错误翻译，Agent 无需理解 Solidity |
| 📋 **全链上审计** | 每笔操作记入账本，策略命中记录（policyHit），可追溯不可篡改 |
| ⚡ **紧急暂停** | 一键冻结所有 Agent 操作，Session Key 泄露也能秒级止损 |
| 🧩 **MCP 集成** | 11 个 MCP 工具，AI Agent 用自然语言即可操作合约 |
| 💰 **x402 付费 API** | Agent 按次付费调用外部 API，HTTP 402 协议实现机器对机器支付 |
| 📱 **Telegram 审批** | Agent 发起待审批支付 → Telegram 推送 → 你在手机上批准/拒绝 |
| 🖥️ **前端 Dashboard** | React 全功能面板：存取款 / 授权 / 审批 / 白名单 / 账本 / 架构说明 |

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     👤 Owner（你）                          │
│   MetaMask 钱包  ←→  前端 Dashboard                      │
│   存款 / 提款 / 授权 / 撤销 / 审批 / 白名单 / 紧急暂停    │
└──────────────────────┬──────────────────────────────────────┘
                       │ Owner 私钥签名
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              🏦 AgentVault 合约（Monad 链上）               │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌────────┐ │
│  │ Policy      │  │ Session    │  │ 审批队列  │  │ 链上   │ │
│  │ Engine      │  │ Key 管理   │  │          │  │ 账本   │ │
│  │ • 单笔限额  │  │ • 过期时间 │  │ • 待审批  │  │ • 操作者│ │
│  │ • 日限额    │  │ • 差异化   │  │ • 批准    │  │ • 金额 │ │
│  │ • 白名单    │  │   配置     │  │ • 拒绝    │  │ • 原因 │ │
│  │ • 策略命中  │  │ • 自动失效 │  │          │  │ • Hit  │ │
│  └────────────┘  └────────────┘  └──────────┘  └────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ Agent Session Key 签名
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              🤖 AI Agent（OpenClaw / Claude Code）          │
│   MCP Server 11 工具  ←→  SDK（预检/重试/错误翻译）        │
└──────────────────────┬──────────────────────────────────────┘
                       │ x402 协议（HTTP 402）
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              💰 x402 付费 API 服务端                        │
│   请求 → 402 + 支付信息 → 签名支付 → 重试 → 200 + 资源    │
│   GPT-4 API / GPU 集群 / 数据集 / 去中心化存储             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 安全模型：10 道防线

Agent 每次支付，合约逐层检查，全部通过才执行：

| # | 检查项 | 失败结果 |
|---|--------|----------|
| 1 | Agent 是否已授权 | `NOT_AUTHORIZED` — 请 Owner 授权 |
| 2 | Session Key 是否过期 | `SESSION_EXPIRED` — 请 Owner 延期 |
| 3 | 合约是否暂停 | `PAUSED` — 等待 Owner 恢复 |
| 4 | 是否超过个人单笔上限 | `SINGLE_LIMIT` — 请 Owner 提额或拆分 |
| 5 | 是否超过全局单笔上限 | `GLOBAL_LIMIT` — 超过 1 MON 硬顶 |
| 6 | 合约余额是否充足 | `INSUFFICIENT_BALANCE` — 等待充值 |
| 7 | 是否超过每日操作次数 | `DAILY_PAY_LIMIT` — 等待明天重置 |
| 8 | 是否超过个人日消费上限 | `DAILY_SPEND_LIMIT` — 请 Owner 提额 |
| 9 | 白名单检查 | `WHITELIST` — 请 Owner 添加收款人 |
| 10 | 审批检查 | 进入审批队列，等待 Owner 批准 |

---

## 🤖 Agent 原生增强

AgentVault 不只是合约，它让 AI Agent 真正能用：

| 能力 | 说明 |
|------|------|
| **checkBudget()** | 支付前预检 — Agent 先问"我能付吗"，避免无谓的链上交易 |
| **payWithRetry()** | 自动重试 — nonce 冲突、gas 不足等临时错误自动重试 2 次 |
| **错误翻译** | 链上 revert → 结构化 PaymentError（code + canRetry + suggestion） |
| **MCP Server** | 11 个工具注册为 MCP 协议，AI Agent 用自然语言即可调用 |
| **x402 协议** | HTTP 402 机器对机器支付，Agent 可按次付费调用外部 API |

### 11 个 MCP 工具

| 类别 | 工具 | 说明 |
|------|------|------|
| 💳 支付 | `check_budget` | 支付前预检，返回能否支付 + 原因 |
| 💳 支付 | `pay` | 发起链上支付 |
| 💳 支付 | `pay_with_retry` | 支付 + 自动重试 + 错误翻译 |
| 📊 查询 | `get_balance` | 查询金库余额 |
| 📊 查询 | `get_agent_config` | 查询 Agent 配置 |
| 📊 查询 | `get_daily_ops` | 查询今日剩余额度 |
| 📋 审计 | `get_ledger` | 查询链上账本 |
| 📋 审计 | `get_payment_logs` | 查询支付审计日志 |
| ⚙️ 管理 | `request_limit_increase` | Agent 请求提额 |
| ⚙️ 管理 | `pending_approvals` | 查询待审批支付 |
| 💰 x402 | `x402_pay_api` | 按次付费调用外部 API |

---

## 🎯 赛题 5 项要求全覆盖

| # | 要求 | AgentVault 实现 |
|---|------|-----------------|
| 1 | **去中心化** | 非托管合约，Owner 持主私钥，Agent 持受限 Session Key，随时撤销 |
| 2 | **安全配置** | 差异化单笔/日限额 + 白名单 + 超额审批 + 紧急暂停 + 全局硬顶 |
| 3 | **Agent 原生** | 任务上下文支付 + checkBudget 预检 + payWithRetry 重试 + 错误翻译 + MCP Server |
| 4 | **可审计** | 链上账本 + 事件 + policyHit 策略命中记录 + autoApproved 标记 |
| 5 | **权限管理** | 授权/撤销/调整/Session Key 过期自动失效/紧急暂停一键冻结 |

### 加分特性

| 特性 | 说明 |
|------|------|
| 🔄 x402 机器对机器支付 | Agent 按次付费调用外部 API，HTTP 402 协议 |
| 📱 Telegram 审批 Bot | Agent 待审批 → Telegram 推送 → 手机批准/拒绝 |
| 🖥️ React Dashboard | 全功能前端面板，存取款/授权/审批/白名单/账本 |
| 🔀 差异化 Agent 配置 | 每个 Agent 独立限额/审批/白名单，预设模板一键授权 |
| 🔐 HTTPS + WebSocket 代理 | 局域网安全访问，支持 OpenClaw WebSocket 连接 |
| 📊 policyHit 策略命中 | 每笔支付记录命中了哪个策略，审计可追溯 |

---

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/AgentVault.git
cd AgentVault

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的私钥

# 4. 编译合约
npm run compile

# 5. 部署到 Monad 测试网
npm run deploy

# 6. 一键运行全部 Demo
npm run demo
```

### 各模块启动

```bash
# 前端 Dashboard
npm run dashboard          # → http://localhost:5173

# Telegram 审批 Bot（需在 .env 设置 BOT_TOKEN + CHAT_ID）
npm run bot

# x402 付费 API
npm run x402-server        # 终端1: 启动付费 API
npm run x402-demo          # 终端2: 运行 x402 演示

# OpenClaw Agent
openclaw tui               # TUI 聊天
openclaw gateway run       # Web UI → http://127.0.0.1:18789
```

---

## 🎬 3 个 Demo 场景

| 场景 | 说明 | 预期结果 |
|------|------|----------|
| **Scenario 1** | Agent 小额支付 API 费用 | ✅ 自动通过，txHash 返回 |
| **Scenario 2** | Agent 超额支付 GPU | ❌ 被合约拒绝，返回 PaymentError |
| **Scenario 3** | 查看审计日志 | 📋 完整支付记录 + policyHit |

```bash
npm run scenario1    # 成功支付
npm run scenario2    # 超额拒绝
npm run scenario3    # 审计日志
npm run demo         # 一键跑全部
```

---

## 📦 已部署合约

| 项目 | 值 |
|------|-----|
| 合约地址 | [`0xf9d7a48c10C2bCe029159d1B4C433B9821956e41`](https://testnet.monadexplorer.com/address/0xf9d7a48c10C2bCe029159d1B4C433B9821956e41) |
| 网络 | Monad 测试网 (chainId: 10143) |
| RPC | `https://testnet-rpc.monad.xyz` |
| Owner | `0x2C7c26E395A5861380451CcCFf303F58Feb190D9` |
| 合约源码 | [`contracts-合约/AgentVault.sol`](contracts-合约/AgentVault.sol) (466 行) |

---

## 📁 项目结构

```
AgentVault/
├── contracts-合约/
│   └── AgentVault.sol                    # 智能合约（466行，中文注释）
├── sdk-开发包/
│   └── agent-vault-standalone-独立SDK.ts  # SDK（ethers.js v6，Agent 原生增强）
├── mcp-server-MCP服务器/
│   └── mcp-server.ts                      # MCP Server（11 个工具）
├── bot-机器人/
│   └── telegram-approval-审批通知.ts       # Telegram 审批 Bot
├── x402-机器支付/
│   ├── x402-client-客户端.ts               # x402 支付客户端中间件
│   ├── x402-server-服务端.ts               # x402 付费 API 服务端
│   └── demo-x402-演示.ts                   # x402 端到端演示
├── frontend-前端/                          # React Dashboard（Vite + TailwindCSS）
├── demo-演示/                              # 3 个场景 + 一键全跑
├── scripts-脚本/                           # 部署/初始化/授权/提款
├── test-测试/                              # 完整功能测试 + 账本测试
├── artifacts-编译产物/                     # ABI + 字节码
├── deployment.json                         # 部署信息 + ABI
└── .env.example                            # 环境变量模板
```

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 智能合约 | Solidity 0.8.28 |
| SDK | ethers.js v6 + TypeScript |
| MCP Server | @modelcontextprotocol/sdk |
| 前端 | React + Vite + TailwindCSS |
| 链 | Monad Testnet (chainId: 10143) |
| AI Agent | OpenClaw + MiniMax (1openclaw 中转) |
| 通知 | Telegram Bot API |
| 机器支付 | x402 协议 (HTTP 402) |

---

## 📄 合约功能一览

### Owner 操作
- `deposit()` — 存入 MON
- `withdraw(amount)` — 提取 MON
- `authorizeAgent(agent, ...)` — 差异化授权 Agent
- `revokeAgent(agent)` — 撤销 Agent
- `updateAgentConfig(...)` — 调整 Agent 配置
- `updateAgentExpiry(agent, expiry)` — 更新过期时间
- `addWhitelist(agent, recipient)` / `removeWhitelist(...)` — 白名单
- `approvePayment(id)` / `rejectPayment(id)` — 审批/拒绝
- `emergencyPause()` / `unpause()` — 紧急暂停/恢复

### Agent 操作
- `agentPay(recipient, amount, reason, taskId, agentId)` — 受限支付
- `agentWithdraw(amount)` — 受限提款

### 查询
- `getLedgerEntry(index)` — 账本记录
- `getLedgerCount()` — 账本总条数
- `getAgentDailyOps(agent)` — 今日剩余额度
- `getAgentConfig(agent)` — Agent 完整配置

---

<div align="center">

**Built for Monad Blitz @ 杭州 V2**

</div>
