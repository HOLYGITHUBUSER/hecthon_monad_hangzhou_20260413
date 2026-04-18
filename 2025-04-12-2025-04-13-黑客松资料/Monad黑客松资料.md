# Monad Blitz @ 杭州 V2 — Agentic Payment 黑客松资料

## 活动信息
- 活动页：https://mojo.devnads.com/events/11
- 主题：Agentic Payment — Agent 原生安全支付系统
- 奖金：$1,500（第1名$600 / 第2名$500 / 第3名$400）+ 机械键盘
- 评审：官方 + 开发者共同投票

## Monad Blitz 规则
- **从新开始**：所有项目代码必须是今天编写
- **不要用已有项目**：不得提交已有的个人项目，标准库可以使用
- **在 Monad 上部署**：所有和区块链相关内容必须在 Monad 上部署
- **公共仓库**：代码必须存放在一个公开的 GitHub 仓库中

---

## 🔴 第一步：安装 MonSkill（强烈推荐）

MonSkill 是 Monad 官方 AI 开发 Skill，含链配置、合约模板、部署工具、SDK，装完即可开发。
```
npx skills add therealharpaljadeja/monskills
```
- 安装地址：https://skills.devnads.com/
- GitHub：https://github.com/therealharpaljadeja/monskills
- 支持：Claude Code / Cursor / Windsurf 等 AI Agent 开发环境

---

## 核心技术资源（按优先级）

### 1. MPP — Machine Payments Protocol（支付核心）
- 官网：https://mpp.dev/
- 文档：https://mpp.dev/overview
- Agent 快速开始：https://mpp.dev/quickstart/agent
- MPP TS SDK：https://github.com/monad-crypto/monad-ts/tree/main/packages/mpp
- Python SDK (pympp)：https://mpp.dev/sdk/python
- TypeScript SDK (mppx)：https://mpp.dev/sdk/typescript
- **MPP 是什么**：基于 HTTP 402 的机器对机器支付协议（Tempo + Stripe 联合开发）
- **支付流程**：Client 请求资源 → Server 返回 402 + 支付要求 → Client 签名支付 → Server 验证并返回资源
- **Agent 使用方式**：
  - Tempo Wallet（推荐）：托管 MPP 客户端，内置消费控制
  - mppx CLI：轻量级客户端，适合开发调试

### 2. x402 — Machine-Payable API 协议
- 文档：https://docs.monad.xyz/guides/x402-guide
- **x402 是什么**：基于 HTTP 402 状态码的付费 API 协议
- **流程**：请求资源 → 402 返回支付信息 → 客户端签名支付 → 重试请求 → 200 返回资源 + 收据
- **两种模式**：Direct Payment（直接链上支付）/ Facilitator（推荐，通过中间方验证结算）
- 适合做"Agent 按次付费调用 API"的场景

### 3. Monad 文档
- 总文档：https://docs.monad.xyz
- 开发者部署指南：https://docs.monad.xyz/developer-essentials/summary
- 工具与基础设施：https://docs.monad.xyz/tooling-and-infra
- 网络信息：https://docs.monad.xyz/developer-essentials/network-information
- 架构：https://docs.monad.xyz/monad-arch

### 4. GitHub 仓库（github.com/monad-crypto）
- **monad-ts**：TypeScript 工具库
  - `@monad-crypto/viem`：viem 扩展包（和 Monad 链交互）
  - `@monad-crypto/mpp`：MPP 支付协议 SDK
- **protocols**：生态协议列表（项目完成后可提交，分类 AI::Infrastructure / Infra::Wallet）
- **token-list** / **MIPs** / **airdrop-addresses**

### 5. 其他资源
- Monad 测试网：https://app.monad.xyz
- Monad Discord：https://discord.gg/monad
- MPP 服务列表：https://mpp.dev/services

---

## 赛题要求：5 项必须满足

| # | 要求 | 核心要点 |
|---|------|----------|
| 1 | **去中心化** | 非托管、Agent 不接触真实私钥、用户可撤销权限、跨平台、必须开源 |
| 2 | **安全配置** | 单笔上限、日/周预算、白名单地址/合约/Token、超阈值人工确认、紧急暂停 |
| 3 | **Agent 原生** | 为 Agent 设计而非人：请求权限、获取临时授权、解释支付原因、任务上下文支付、失败重试 |
| 4 | **可审计** | 每笔记录：触发者、任务上下文、收款方、原因、命中策略、是否人工确认、执行结果 |
| 5 | **恢复与权限管理** | 钱包恢复、Agent 权限调整、Session Key 轮换、多 Agent 差异化权限 |

## 加分特性（按影响力排序）

| 优先级 | 特性 | 说明 |
|--------|------|------|
| 🔴 A | **Session Key / Delegated Key** | 给 Agent 发放受限临时密钥（24h有效、≤5 USDC、仅指定服务） |
| 🔴 B | **Policy Engine** | 可配置策略层：日限额、超阈值审批、白名单分类、禁止个人转账 |
| 🟡 C | **现代登录** | zkLogin / Passkeys / WebAuthn，结合安全权限边界 |
| 🟡 D | **原生机器支付** | API 按次付费、Agent 间结算、streaming/micropayment、x402 |
| 🟡 E | **人机协同审批** | 小额自动 → 中额确认 → 高风险人工批准，Telegram/App/多签 |
| 🟢 F | **审计日志/Receipt** | 结构化收据：Task ID, Agent ID, 金额, 策略命中, 风险等级, 时间戳 |

---

## 项目方案：AgentSafePay

### 核心定位
基于 MPP + x402 的 Agent 原生支付系统，集成 Policy Engine + Session Key，可被 Claude Code / OpenClaw 等直接调用。

### 架构
```
AI Agent (Claude Code / OpenClaw)
    ↓ 请求支付
AgentSafePay SDK (Python/TS)
    ↓ 检查 Policy + Session Key
Smart Contract Wallet (Monad 链上)
    ↓ 执行支付
MPP / x402 服务端
```

### 必做功能（对应5项要求）
1. **非托管智能合约钱包**：用户主密钥控制，Agent 只有 Session Key
2. **Policy Engine**：可配置预算/白名单/审批阈值
3. **Agent SDK**：`agent.pay()` / `agent.request_approval()` / `agent.check_budget()`
4. **审计日志**：链上记录每笔支付的完整上下文
5. **权限管理**：Session Key 创建/轮换/撤销

### 加分功能（优先级排序）
- A. Session Key：临时受限密钥，到期自动失效
- B. Policy Engine：规则引擎（已纳入必做）
- D. x402 集成：Agent 可按次付费调用 API
- E. Telegram 审批 Bot：大额支付推送人类确认

### 集成形态
- **MCP Server**：让 Claude Code 直接调用支付功能
- **Python SDK (pympp)**：Agent 端集成
- **CLI Tool**：命令行管理钱包和策略

### 分工建议（3人队）
1. **合约 + 后端**：Solidity 写 Smart Contract Wallet + Policy Engine，部署到 Monad 测试网
2. **Agent SDK + MPP 集成**：Python/TS 写 SDK，集成 MPP/x402，实现 Agent 支付流程
3. **前端 + 审批**：React Dashboard + Telegram Bot，人类审批 + 审计日志查看

### Demo 演示脚本
1. 用户配置 Policy：日限额 20 USDC，超 3 USDC 需审批
2. Agent 收到任务："调用 GPT-4 API，费用 $2"
3. Agent 通过 SDK 请求支付 → Policy 检查通过 → Session Key 签名 → MPP 支付成功
4. Agent 收到新任务："购买 GPU 集群，$10"
5. Agent 请求支付 → 超阈值 → Telegram 推送审批 → 人类批准 → 支付成功
6. 展示审计日志：每笔支付的完整记录

### 时间规划
| 时间 | 任务 |
|------|------|
| 09:00-11:00 | 签到 + Monad 101 + 组队 + 安装 MonSkill |
| 11:00-12:00 | 确认方案 + 分工 + 搭环境 |
| 12:00-14:00 | 写 Smart Contract Wallet + Policy Engine |
| 14:00-16:00 | 写 Agent SDK + 集成 MPP/x402 |
| 16:00-17:30 | 审批界面 + Telegram Bot |
| 17:30-18:30 | 端到端测试 + Demo 录屏 + 提交 |
