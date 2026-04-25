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
git clone https://github.com/HOLYGITHUBUSER/hecthon_monad_hangzhou_20260413.git
cd hecthon_monad_hangzhou_20260413

# 2. 安装根项目和前端依赖
npm run install:all

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的私钥

# 4. 编译合约和前端
npm run build:all

# 5. 部署到 Monad 测试网
npm run deploy

# 6. 一键运行全部 Demo
npm run demo
```

更完整的下载后运行、部署和环境变量说明见 [`docs-文档/download-run-deploy.md`](docs-文档/download-run-deploy.md)。

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
├── .env.example                            # 环境变量模板（私钥/RPC/Telegram/x402）
├── .gitignore                              # 敏感文件排除规则
├── .mcp.json                               # MCP 服务器配置
├── README.md                               # 你正在看的这份文档
├── deployment.json                         # 合约部署地址 + ABI
├── package.json                            # Node 依赖（ethers/dotenv/telegraf）
├── tsconfig.json                           # TypeScript 配置
│
├── contracts-合约/
│   └── AgentVault.sol                      # 智能合约（466行，中文注释）
│
├── artifacts-编译产物/
│   ├── contracts-合约_AgentVault_sol_AgentVault.abi   # 合约 ABI
│   └── contracts-合约_AgentVault_sol_AgentVault.bin   # 合约字节码
│
├── scripts-脚本/
│   ├── deploy-ethers-部署合约.ts            # 部署合约到 Monad
│   ├── setup-vault-初始化金库.ts            # 初始化金库 + 授权 Agent
│   ├── setup-vault-diff-差异化授权.ts       # 差异化授权（不同 Agent 不同配置）
│   ├── authorize-wallet-授权钱包.ts          # 授权新 Agent 钱包
│   ├── withdraw-vault-提取资金.ts           # Owner 从 Vault 提取资金
│   └── get-address-获取地址.ts              # 从私钥推导钱包地址
│
├── sdk-开发包/
│   └── agent-vault-standalone-独立SDK.ts    # 独立 SDK（ethers.js v6，Agent 原生增强）
│
├── mcp-server-MCP服务器/
│   └── mcp-server.ts                       # MCP Server（11 个工具，stdio 通信）
│
├── x402-机器支付/
│   ├── x402-server-服务端.ts               # x402 付费 API 服务端（HTTP 402）
│   ├── x402-client-客户端.ts               # x402 客户端中间件（自动支付重试）
│   └── demo-x402-演示.ts                   # x402 端到端演示
│
├── bot-机器人/
│   └── telegram-approval-审批通知.ts        # Telegram 审批 Bot（待审批→推送→批准/拒绝）
│
├── demo-演示/
│   ├── https-proxy-代理.cjs                # HTTPS + WebSocket 代理（局域网安全访问）
│   ├── run-all-scenarios-运行全部场景.ts     # 一键运行全部 3 个场景
│   ├── scenario1-success-场景1成功支付.ts    # 场景1：Agent 小额支付 → 自动通过
│   ├── scenario2-rejected-场景2拒绝支付.ts   # 场景2：Agent 超额支付 → 被合约拒绝
│   └── scenario3-audit-场景3审计日志.ts      # 场景3：查看审计日志 + policyHit
│
├── test-测试/
│   ├── test-full-完整功能测试.ts            # 完整功能测试（3 个 Agent）
│   ├── test-ledger-账本测试.ts             # 账本记录测试
│   ├── test-openclaw-scenarios-测试OpenClaw场景.ts  # OpenClaw MCP 场景测试
│   └── view-ledger-查看账本.ts             # 查看链上账本
│
├── docs-文档/
│   ├── architecture.md                     # 架构设计文档
│   ├── contract.md                         # 合约功能文档
│   ├── sdk.md                              # SDK 使用文档
│   ├── deployment.md                       # 部署文档
│   ├── demo.md                             # 演示说明
│   ├── demo-guide-演示指南.md              # 演示操作指南
│   └── status.md                           # 项目状态
│
├── authorize-agent-授权agent.ts            # 授权 Agent 脚本
├── check-agent-检查agent.ts                # 检查 Agent 状态
├── simulate-high-frequency-tx.ts           # 高频交易模拟（压力测试）
│
└── frontend-前端/                          # ⭐ React Dashboard
    ├── index.html                          # 入口 HTML
    ├── package.json                        # 前端依赖（React/Vite/TailwindCSS/ethers）
    ├── vite.config.ts                      # Vite 配置
    ├── eslint.config.js                    # ESLint 配置
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    ├── public/
    │   ├── favicon.svg                     # 站点图标
    │   └── icons.svg                       # SVG 图标集
    └── src/
        ├── main.tsx                        # React 入口
        ├── App.tsx                         # ⭐ 主组件（1300+ 行全功能 Dashboard）
        ├── contract.ts                     # 合约连接配置（Vault 地址 + ABI + Provider）
        ├── index.css                       # TailwindCSS 样式
        └── assets/
            ├── hero.png                    # 首页 Hero 图
            ├── react.svg                   # React Logo
            └── vite.svg                    # Vite Logo
```

---

## 🖥️ 前端 Dashboard 突出点

> 单文件 `App.tsx`（1300+ 行）实现全功能管理面板，零外部 UI 库，纯 TailwindCSS 手写。

### 实时状态面板
- **Vault 余额** — 合约实时余额 + Owner/Agent 钱包余额
- **合约状态** — 紧急暂停开关实时显示
- **Agent 状态卡片** — Session Key 标签 + 单笔/日限额 + 过期倒计时 + 剩余额度

### 资金操作
- **存款到 Vault** — MetaMask 签名，MON → 合约
- **提取到 Owner** — 合约 → Owner 钱包
- **给 Agent 转 gas 费** — Owner 钱包 → Agent 钱包（地址可输入）

### Agent 授权/撤销
- **授权新 Agent** — 5 个参数可配：钱包地址/日限额/单笔限额/过期时间/审批/白名单
- **预设模板** — 一键切换"需审批"/"白名单"模式
- **撤销 Agent** — 一键移除，Session Key 立即失效
- **更新过期时间** — 延长/缩短 Session Key 有效期

### 白名单管理
- **添加/移除白名单** — 指定 Agent + 收款人地址
- 开启后 Agent 只能向白名单内地址支付

### 审批队列
- **待审批支付列表** — 显示 Agent/金额/原因/任务ID
- **批准/拒绝** — Owner 一键操作

### 链上账本
- **分页浏览** — 全部操作记录（存款/支付/提款/审批）
- **操作者 + 金额 + 对手方 + 原因 + 时间戳**

### 可折叠知识面板（5 个）
| 面板 | 内容 |
|------|------|
| 📖 **术语表** | Owner / Session Key / Vault / 白名单 / 审批 / policyHit 等核心概念解释 |
| 🏗️ **架构说明** | 四层架构图（Owner → Vault → Agent → x402）+ MCP 调用流程 + 11 个工具列表 |
| ✅ **5 项要求对照** | 赛题要求 vs AgentVault 实现，逐条对应 |
| ⭐ **加分特性** | x402 / Telegram / Dashboard / 差异化配置 / policyHit / HTTPS 代理 |
| 🎬 **演示指南** | 按 OpenClaw 聊天框格式，直接复制的命令示例 |

### 安全模型可视化
- **资金流向图** — Owner → Vault → Agent → 收款人，每步标注规则
- **Session Key 泄露场景** — 泄露 → 限额内损失 → revokeAgent 止血 → 剩余安全
- **10 道防线** — 逐层检查流程可视化

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 智能合约 | Solidity 0.8.28 |
| SDK | ethers.js v6 + TypeScript |
| MCP Server | @modelcontextprotocol/sdk（stdio 通信） |
| 前端 | React 19 + Vite 6 + TailwindCSS 4（零 UI 库，纯手写） |
| 链 | Monad Testnet (chainId: 10143) |
| AI Agent | OpenClaw + MiniMax (1openclaw 中转) |
| 通知 | Telegram Bot API (telegraf) |
| 机器支付 | x402 协议 (HTTP 402) |
| 代理 | HTTPS + WebSocket (自签名证书) |

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
