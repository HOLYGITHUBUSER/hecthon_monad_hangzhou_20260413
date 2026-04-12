# 部署指南

## 环境要求

- Node.js（注意：Hardhat 可能与 Node 23 有兼容问题，推荐使用 Node 20/22）
- npm
- Monad 测试网 MON 代币（从水龙头获取）

## 步骤

### 1. 安装依赖

```bash
cd AgentVault
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
PRIVATE_KEY=你的私钥
```

⚠️ **绝对不要把 `.env` 文件提交到 Git！**

### 3. 编译合约

```bash
npm run compile
# 或
npx solcjs --abi --bin contracts-合约/AgentVault.sol --output-dir artifacts
```

编译产物：
- `artifacts-编译产物/contracts_AgentVault_sol_AgentVault.abi` — ABI
- `artifacts-编译产物/contracts_AgentVault_sol_AgentVault.bin` — 字节码

### 4. 部署合约

**推荐方式**（纯 ethers，绕过 Hardhat 兼容问题）：

```bash
npm run deploy
# 或
npx tsx scripts-脚本/deploy-ethers-部署合约.ts
```

**Hardhat 方式**（如果环境兼容）：

```bash
npx hardhat run scripts-脚本/deploy.ts --network monadTestnet
```

部署成功后会生成 `deployment.json`，包含：
- `network` — 网络名称
- `contract` — 合约名
- `address` — 合约地址
- `deployer` — 部署者地址
- `deployedAt` — 部署时间
- `abi` — 合约 ABI（仅 ethers 版部署脚本包含）

### 5. 运行 Demo

```bash
npm run demo
# 或逐个运行
npm run scenario1
npm run scenario2
npm run scenario3
```

---

## 网络配置

Monad Testnet 参数（在 `hardhat.config.ts` 中配置）：

| 参数 | 值 |
|------|-----|
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | 10143 |
| 浏览器 | `https://monadvision.com` |
| 水龙头 | `https://app.monad.xyz` |

---

## 获取测试网 MON

1. 访问 https://app.monad.xyz
2. 连接钱包
3. 从水龙头获取测试 MON

---

## 常见问题

### Hardhat 与 Node 23 不兼容

如果 `npx hardhat compile` 或 `npx hardhat run` 报错，使用纯 ethers 方式：
- 编译：`npm run compile`（使用 solcjs）
- 部署：`npm run deploy`（使用 deploy-ethers.ts）
- Demo：`npm run demo`（使用 standalone SDK）

### 部署失败：余额不足

确保部署钱包有足够的 MON 测试币。

### deployment.json 不存在

必须先部署合约再运行 Demo。
