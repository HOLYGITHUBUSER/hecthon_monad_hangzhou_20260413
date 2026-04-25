# 下载后运行与部署指南

目标：从 GitHub 下载这个仓库后，除私钥、Bot Token 这类不能上传的敏感信息外，项目应尽量可以直接安装、构建和部署。

## 1. 环境要求

- Node.js 20 或 22 推荐。当前脚本也可在 Node 23 下运行，但部分 ESLint 依赖会提示 engine warning。
- npm
- Monad 测试网 MON，用于部署合约和发送测试交易。

## 2. 下载项目

```bash
git clone https://github.com/HOLYGITHUBUSER/hecthon_monad_hangzhou_20260413.git
cd hecthon_monad_hangzhou_20260413
```

## 3. 安装依赖

根项目和前端是两个 npm 项目，下载后需要都安装：

```bash
npm run install:all
```

等价于：

```bash
npm install
npm install --prefix frontend-前端
```

## 4. 配置环境变量

`.env` 不会上传到 GitHub，这是正常的，因为里面可能包含私钥和 Bot Token。

```bash
cp .env.example .env
```

然后编辑 `.env`：

```env
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
PRIVATE_KEY=你的部署钱包私钥
AGENT_PRIVATE_KEY=你的Agent钱包私钥
HOST_IP=localhost
TELEGRAM_BOT_TOKEN=你的Telegram Bot Token
TELEGRAM_CHAT_ID=你的Telegram Chat ID
```

最小可运行配置：

- `MONAD_RPC_URL`：可以直接使用模板里的 Monad 测试网 RPC。
- `PRIVATE_KEY`：部署、demo、测试链上交易都需要。
- `AGENT_PRIVATE_KEY`：可选，不填时部分脚本会回退到 `PRIVATE_KEY`，但建议单独配置。

可选配置：

- `AGENT_A_KEY`、`AGENT_B_KEY`、`AGENT_C_KEY`：完整多人 Agent 测试需要。
- `HOST_IP`：HTTPS 代理演示需要，默认 `localhost`。
- `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`：Telegram 审批 Bot 需要。

## 5. 构建检查

```bash
npm run build:all
```

这会执行：

- `npm run compile`：编译智能合约到 `artifacts-编译产物/`
- `npm run build:frontend`：构建 React 前端到 `frontend-前端/dist/`

`dist/`、`node_modules/` 是本地生成内容，不需要上传。

## 6. 部署合约

确认 `.env` 中的钱包有 Monad 测试网 MON 后运行：

```bash
npm run deploy
```

部署成功后会更新 `deployment.json`。如果你希望 GitHub 上的默认部署地址也同步更新，需要提交并推送这个文件。

## 7. 运行项目

前端 Dashboard：

```bash
npm run dashboard
```

默认地址：

```text
http://localhost:5173
```

链上 Demo：

```bash
npm run demo
```

单独场景：

```bash
npm run scenario1
npm run scenario2
npm run scenario3
```

Telegram 审批 Bot：

```bash
npm run bot
```

x402 服务端和演示：

```bash
npm run x402-server
npm run x402-demo
```

## 8. 哪些内容不上传

这些内容应该保留在本地或部署平台配置里，不要提交到 GitHub：

- `.env`
- `node_modules/`
- `frontend-前端/node_modules/`
- `frontend-前端/dist/`
- `demo-演示/.certs/`
- `*.pem`
- `backup-备份/`
- `Teammate-Guide-队友指南/`

部署平台需要的密钥、RPC、Bot Token，应在平台的 Environment Variables 中配置，而不是提交 `.env`。

## 9. 下载后是否能直接部署

可以，但前提是完成两件事：

1. 运行 `npm run install:all` 安装根项目和前端依赖。
2. 根据 `.env.example` 配置 `.env` 或部署平台环境变量。

代码、合约、前端、部署脚本都在 GitHub 仓库中；缺失的只应该是不能公开上传的敏感配置和本地生成文件。
