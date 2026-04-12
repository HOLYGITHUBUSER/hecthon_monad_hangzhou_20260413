# Demo 场景文档

## 概述

项目包含 3 个演示场景，展示 AgentVault 的核心功能。有两种运行方式：

| 方式 | 命令 | 使用的 SDK |
|------|------|-----------|
| 单场景运行 | `npm run scenario1` / `scenario2` / `scenario3` | Standalone SDK |
| 全场景一键运行 | `npm run demo` | Standalone SDK |

**推荐使用 `npm run demo`**（Standalone 版，无需 Hardhat 环境）。

---

## 前置条件

1. 合约已部署：`npx tsx scripts-脚本/deploy-ethers.ts`
2. `deployment.json` 已生成
3. `.env` 中配置了 `PRIVATE_KEY`
4. 部署钱包有足够的 Monad 测试网 MON

---

## Scenario 1：小额支付成功

**文件**：`demo-演示/scenario1-success-场景1成功支付.ts`

**流程**：
1. Owner 存入 10 MON 到 Vault
2. Owner 授权 Agent（日限额 20 MON，单笔限额 5 MON，24h 有效）
3. Agent 支付 0.5 MON 给 API Provider（"Purchase GPT-4 API tokens"）
4. ✅ 支付自动通过（0.5 < 5 单笔限额，且 < 20 日限额）
5. 查看剩余日限额
6. 查看审计日志

**预期结果**：支付成功，Vault 余额变为 9.5 MON。

---

## Scenario 2：超额支付被拒

**文件**：`demo-演示/scenario2-rejected-场景2拒绝支付.ts`

**流程**：
1. Agent 尝试支付 8 MON 给 GPU Provider
2. ❌ 被合约拒绝（8 > 5 单笔限额）
3. Agent 连续支付 4 次 × 4 MON = 16 MON（日限额 20 MON）
4. Agent 再尝试支付 5 MON
5. ❌ 被合约拒绝（16 + 5 = 21 > 20 日限额）

**预期结果**：超额支付被正确拒绝，Agent 应通知用户请求提额或人工审批。

---

## Scenario 3：审计日志

**文件**：`demo-演示/scenario3-audit-场景3审计日志.ts`

**流程**：
1. 查询链上所有 `AgentPayment` 事件
2. 以表格形式展示：Agent ID、金额、原因、Task ID、时间戳、是否自动审批
3. 汇总：总支付笔数、总金额、Vault 余额

**预期结果**：显示完整支付审计记录。

---

## run-all-scenarios.ts

**文件**：`demo-演示/run-all-scenarios-运行全部场景.ts`

一键运行全部 3 个场景，使用 Standalone SDK。

**特殊处理**：
- Agent 钱包使用 Hardhat 默认测试私钥 `0xac09...1c1c`（仅限 demo，生产环境不可用）
- API Provider 钱包随机生成
- 从 `deployment.json` 读取合约地址和 ABI

**运行命令**：
```bash
npm run demo
# 或
npx tsx demo-演示/run-all-scenarios.ts
```
