/**
 * AgentVault Telegram 审批 Bot
 *
 * 监听合约 PaymentPendingApproval 事件，推送审批请求到 Telegram。
 * 支持 inline button 批准/拒绝，回调触发合约 approvePayment/rejectPayment。
 *
 * 启动: npx tsx bot-机器人/telegram-approval-审批通知.ts
 *
 * .env 需新增:
 *   TELEGRAM_BOT_TOKEN=你的bot token
 *   TELEGRAM_CHAT_ID=你的chat id
 */
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { AgentVaultSDK } from "../sdk-开发包/agent-vault-standalone-独立SDK";

dotenv.config();

// ============ 配置 ============

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

if (!BOT_TOKEN) { console.error("TELEGRAM_BOT_TOKEN not set"); process.exit(1); }
if (!CHAT_ID) { console.error("TELEGRAM_CHAT_ID not set"); process.exit(1); }
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY not set"); process.exit(1); }

// ============ 初始化 ============

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const deploymentPath = path.join(process.cwd(), "deployment.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
const contract = new ethers.Contract(deployment.address, deployment.abi, provider);
const sdk = new AgentVaultSDK(deployment.address, wallet, deployment.abi);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ============ 监听待审批事件 ============

console.log("AgentVault Telegram Bot started, polling for pending payments every 30s...");

// Monad testnet 不支持 eth_newFilter，改用轮询
let lastPendingCount = 0;
let notifiedPayments = new Set<number>();

async function pollPendingPayments() {
  try {
    const count = Number(await contract.pendingPaymentCount());
    if (count > lastPendingCount || count > 0) {
      for (let i = 0; i < count; i++) {
        if (notifiedPayments.has(i)) continue;
        try {
          const payment = await contract.pendingPayments(i);
          if (payment.exists && !payment.approved) {
            notifiedPayments.add(i);
            const amountMON = ethers.formatEther(payment.amount);
            const shortAgent = payment.agent.slice(0, 6) + "..." + payment.agent.slice(-4);
            const shortRecipient = payment.recipient.slice(0, 6) + "..." + payment.recipient.slice(-4);
            const reason = payment.reason || "N/A";
            const taskId = payment.taskId || "N/A";
            const agentId = payment.agentId || "N/A";

            const msg = [
              `🔔 *待审批支付请求*`,
              ``,
              `📋 Payment #${i}`,
              `💰 金额: ${amountMON} MON`,
              `🤖 Agent: \`${shortAgent}\` (${agentId})`,
              `📍 收款方: \`${shortRecipient}\``,
              `📝 原因: ${reason}`,
              `🔗 任务: ${taskId}`,
            ].join("\n");

            const inlineKeyboard = {
              inline_keyboard: [
                [
                  { text: "✅ 批准", callback_data: `approve_${i}` },
                  { text: "❌ 拒绝", callback_data: `reject_${i}` },
                ],
              ],
            };

            try {
              await bot.sendMessage(CHAT_ID, msg, {
                parse_mode: "Markdown",
                reply_markup: inlineKeyboard,
              });
              console.log(`[Bot] Pushed pending payment #${i} to Telegram`);
            } catch (error: any) {
              console.error(`[Bot] Failed to send message: ${error.message}`);
            }
          }
        } catch {}
      }
    }
    lastPendingCount = count;
  } catch (error: any) {
    console.error(`[Bot] Poll error: ${error.message}`);
  }
}

// 每 30 秒轮询一次
setInterval(pollPendingPayments, 30000);
pollPendingPayments();

// ============ 回调处理 ============

bot.on("callback_query", async (query) => {
  const data = query.data;
  if (!data) return;

  const chatId = query.message?.chat.id;
  const msgId = query.message?.message_id;

  if (data.startsWith("approve_")) {
    const paymentId = Number(data.split("_")[1]);
    try {
      await bot.answerCallbackQuery(query.id, { text: "正在批准..." });
      const tx = await sdk.approvePayment(paymentId);
      await tx.wait();
      await bot.editMessageText(`✅ Payment #${paymentId} 已批准并执行`, {
        chat_id: chatId,
        message_id: msgId,
      });
      console.log(`[Bot] Approved payment #${paymentId}`);
    } catch (error: any) {
      await bot.editMessageText(`❌ 批准失败: ${error.message?.slice(0, 100)}`, {
        chat_id: chatId,
        message_id: msgId,
      });
      console.error(`[Bot] Approve failed: ${error.message}`);
    }
  } else if (data.startsWith("reject_")) {
    const paymentId = Number(data.split("_")[1]);
    try {
      await bot.answerCallbackQuery(query.id, { text: "正在拒绝..." });
      const tx = await sdk.rejectPayment(paymentId);
      await tx.wait();
      await bot.editMessageText(`❌ Payment #${paymentId} 已拒绝`, {
        chat_id: chatId,
        message_id: msgId,
      });
      console.log(`[Bot] Rejected payment #${paymentId}`);
    } catch (error: any) {
      await bot.editMessageText(`❌ 拒绝失败: ${error.message?.slice(0, 100)}`, {
        chat_id: chatId,
        message_id: msgId,
      });
      console.error(`[Bot] Reject failed: ${error.message}`);
    }
  }
});

// ============ 命令处理 ============

bot.onText(/\/status/, async () => {
  try {
    const balance = await sdk.getBalance();
    const pendingCount = await contract.pendingPaymentCount();
    await bot.sendMessage(CHAT_ID, [
      `📊 *AgentVault 状态*`,
      ``,
      `💰 余额: ${balance} MON`,
      `⏳ 待审批: ${pendingCount} 笔`,
      `📍 合约: \`${deployment.address.slice(0, 10)}...\``,
    ].join("\n"), { parse_mode: "Markdown" });
  } catch (error: any) {
    await bot.sendMessage(CHAT_ID, `查询失败: ${error.message}`);
  }
});

bot.onText(/\/pending/, async () => {
  try {
    const count = Number(await contract.pendingPaymentCount());
    if (count === 0) {
      await bot.sendMessage(CHAT_ID, "✅ 当前没有待审批支付");
      return;
    }
    const lines = [`⏳ *待审批列表*`, ``];
    for (let i = 0; i < count; i++) {
      const payment = await contract.pendingPayments(i);
      if (payment.exists && !payment.approved) {
        const amountMON = ethers.formatEther(payment.amount);
        const shortAgent = payment.agent.slice(0, 6) + "..." + payment.agent.slice(-4);
        lines.push(`#${i}: ${amountMON} MON → ${shortAgent} — ${payment.reason}`);
      }
    }
    await bot.sendMessage(CHAT_ID, lines.join("\n"), { parse_mode: "Markdown" });
  } catch (error: any) {
    await bot.sendMessage(CHAT_ID, `查询失败: ${error.message}`);
  }
});

bot.onText(/\/help/, () => {
  bot.sendMessage(CHAT_ID, [
    `🤖 *AgentVault 审批 Bot*`,
    ``,
    `/status — 查看合约状态`,
    `/pending — 查看待审批列表`,
    `/help — 显示帮助`,
    ``,
    `当有待审批支付时，Bot 会自动推送通知。`,
  ].join("\n"), { parse_mode: "Markdown" });
});

console.log("Bot commands: /status, /pending, /help");
