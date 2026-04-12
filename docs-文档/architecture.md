# AgentVault 项目架构

## 项目定位

AgentVault 是一个基于 Monad 链的 Agent 原生安全支付系统，核心是非托管智能合约钱包，让 AI Agent 在用户授权下自主完成链上支付，同时确保安全、可控、可审计。

## 目录结构

```
AgentVault/
├── contracts-合约/
│   └── AgentVault.sol                              # 核心智能合约（460行）
├── sdk-开发包/
│   └── agent-vault-standalone-独立SDK.ts             # SDK（纯 ethers.js，含 Agent 原生增强）
├── mcp-server-MCP服务器/
│   └── mcp-server.ts                                # MCP Server（9 个工具给 AI Agent）
├── scripts-脚本/
│   ├── deploy-ethers-部署合约.ts                     # 部署脚本
│   ├── setup-vault-初始化金库.ts                     # 存钱 + 授权队友
│   ├── setup-vault-diff-差异化授权.ts                # 差异化授权 Agent
│   ├── authorize-wallet-授权钱包.ts                   # 授权钱包
│   ├── get-address-获取地址.ts                       # 查看钱包地址
│   └── withdraw-vault-提取资金.ts                    # 从合约取回资金
├── demo-演示/
│   ├── scenario1-success-场景1成功支付.ts             # 场景1：小额支付成功
│   ├── scenario2-rejected-场景2拒绝支付.ts            # 场景2：超额支付被拒
│   ├── scenario3-audit-场景3审计日志.ts               # 场景3：审计日志查询
│   └── run-all-scenarios-运行全部场景.ts              # 全场景一键运行
├── test-测试/
│   ├── test-full-完整功能测试.ts                      # 存/取/花 + 账本完整测试
│   ├── test-ledger-账本测试.ts                       # 账本专项测试
│   └── view-ledger-查看账本.ts                       # 查看链上账本记录
├── Teammate-Guide-队友指南/
│   ├── README-使用说明.txt                           # 队友使用说明
│   └── 队友操作测试-存取花查账.py                    # Python 测试脚本（web3.py）
├── artifacts-编译产物/
│   ├── contracts-合约_AgentVault_sol_AgentVault.abi  # 合约 ABI
│   └── contracts-合约_AgentVault_sol_AgentVault.bin  # 合约字节码
├── docs-文档/                                      # 项目文档
├── backup-备份/                                     # 历史备份文件
├── deployment.json                                  # 部署信息 + ABI
├── package.json                                     # 依赖管理
├── tsconfig.json                                    # TypeScript 配置
├── .env / .env.example                              # 环境变量
└── README.md                                        # 项目简介
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 智能合约 | Solidity 0.8.28 |
| 区块链交互 | ethers.js 6.16.0 |
| 运行时 | TypeScript 6.0.2 + tsx 4.21.0 |
| 目标网络 | Monad Testnet (chainId: 10143) |
| 编译器 | solc 0.8.34（npm 包，solcjs） |
| MCP Server | @modelcontextprotocol/sdk |

## 模块关系

```
AI Agent (Claude Code / OpenClaw)
    ↓ 调用 MCP Server / SDK
AgentVault MCP Server (9 tools)
    ↓ 调用 SDK
AgentVault SDK (TypeScript, 含 Agent 原生增强)
    ↓ 预检 Policy + Session Key → 发送交易
AgentVault 合约 (Monad 链上)
    ↓ 执行支付 + 记录策略命中
收款方 / MPP 服务
```

## SDK 架构

SDK 分三层：

| 层 | 函数 | 说明 |
|---|------|------|
| **基础层** | `deposit` / `withdraw` / `authorizeAgent` / `revokeAgent` / `updateAgentConfig` / `addWhitelist` / `removeWhitelist` / `approvePayment` / `rejectPayment` / `emergencyPause` / `unpause` / `pay` / `agentWithdraw` | 合约函数 1:1 封装 |
| **Agent 原生层** | `checkBudget` / `payWithRetry` / `requestLimitIncrease` | 预检 + 重试 + 错误翻译 + 提额请求 |
| **查询层** | `getBalance` / `getAgentConfig` / `getAgentDailyOps` / `getLedgerEntry` / `getLedgerCount` / `isAgentActive` / `getPaymentLogs` | 链上数据读取 |
