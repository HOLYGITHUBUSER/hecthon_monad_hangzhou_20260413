import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getReadContract, getWriteContract, getSigner, VAULT_ADDRESS, getProvider } from "./contract";

interface AgentInfo {
  address: string;
  singleLimit: string;
  dailySpendLimit: string;
  spentToday: string;
  expiry: number;
  active: boolean;
  requireApproval: boolean;
  whitelistEnabled: boolean;
  paysLeft: number;
  spendLeft: string;
}

interface PendingPaymentInfo {
  id: number;
  agent: string;
  recipient: string;
  amount: string;
  reason: string;
  taskId: string;
  agentId: string;
}

interface LedgerEntryInfo {
  index: number;
  operator: string;
  opType: string;
  amount: string;
  counterparty: string;
  reason: string;
  timestamp: number;
}

function App() {
  const [balance, setBalance] = useState("0");
  const [paused, setPaused] = useState(false);
  const [owner, setOwner] = useState("");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentInfo[]>([]);
  const [ledger, setLedger] = useState<LedgerEntryInfo[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [wallet, setWallet] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [agentInput, setAgentInput] = useState("0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb");
  const [depositAmt, setDepositAmt] = useState("0.1");
  const [withdrawAmt, setWithdrawAmt] = useState("0.1");
  const [newAgentAddr, setNewAgentAddr] = useState("0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb");
  const [newAgentDaily, setNewAgentDaily] = useState("0.05");
  const [newAgentSingle, setNewAgentSingle] = useState("0.02");
  const [newAgentExpiry, setNewAgentExpiry] = useState("24");
  const [newAgentApproval, setNewAgentApproval] = useState(false);
  const [newAgentWhitelist, setNewAgentWhitelist] = useState(false);
  const [wlAgent, setWlAgent] = useState("0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb");
  const [wlRecipient, setWlRecipient] = useState("0x2C7c26E395A5861380451CcCFf303F58Feb190D9");
  const [expiryAgent, setExpiryAgent] = useState("0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb");
  const [expiryHours, setExpiryHours] = useState("24");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txType, setTxType] = useState<"success" | "error" | "pending">("pending");
  const [opHistory, setOpHistory] = useState<{time: string; label: string; status: string; detail: string}[]>([]);
  const [ownerBalance, setOwnerBalance] = useState("");
  const [agent1Balance, setAgent1Balance] = useState("");
  const [agent2Balance, setAgent2Balance] = useState("");
  const [agent1Active, setAgent1Active] = useState(false);
  const [agent2Active, setAgent2Active] = useState(false);
  const [agent2Config, setAgent2Config] = useState<any>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);
  const [agent2GasAmt, setAgent2GasAmt] = useState("0.01");
  const [gasAgentAddr, setGasAgentAddr] = useState("");

  const contract = getReadContract();
  const provider = getProvider();

  const connectWallet = async () => {
    const signer = await getSigner();
    if (signer) setWallet(await signer.getAddress());
  };

  const AGENT1 = "0x9c108bbE0333d978e582Ba32980Cf2d3F3f6d684";
  const AGENT2 = "0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb";

  const refresh = useCallback(async () => {
    try {
      const [bal, p, own, a1Active, a2Active, a2Cfg, ownBal, a1Bal, a2Bal] = await Promise.all([
        contract.getBalance(),
        contract.paused(),
        contract.owner(),
        contract.isAgentActive(AGENT1).catch(() => false),
        contract.isAgentActive(AGENT2).catch(() => false),
        contract.getAgentConfig(AGENT2).catch(() => null),
        provider.getBalance("0x2C7c26E395A5861380451CcCFf303F58Feb190D9"),
        provider.getBalance(AGENT1),
        provider.getBalance(AGENT2),
      ]);
      setBalance(ethers.formatEther(bal));
      setPaused(p);
      setOwner(own);
      setAgent1Active(a1Active as boolean);
      setAgent2Active(a2Active as boolean);
      setAgent2Config(a2Cfg ? {
        singleLimit: ethers.formatEther(a2Cfg.singleLimit),
        dailySpendLimit: ethers.formatEther(a2Cfg.dailySpendLimit),
        spentToday: ethers.formatEther(a2Cfg.spentToday),
        requireApproval: a2Cfg.requireApproval,
        whitelistEnabled: a2Cfg.whitelistEnabled,
      } : null);
      setOwnerBalance(ethers.formatEther(ownBal));
      setAgent1Balance(ethers.formatEther(a1Bal));
      setAgent2Balance(ethers.formatEther(a2Bal));
      setInitialLoading(false);
    } catch (e) {
      console.error("Failed to fetch overview", e);
      setInitialLoading(false);
    }
  }, [contract]);

  // Auto-refresh + auto-load all data
  useEffect(() => {
    refresh();
    loadPending();
    loadLedger();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Load agents
  const loadAgents = async () => {
    if (!agentInput) return;
    try {
      const addresses = agentInput.split(",").map((a) => a.trim()).filter(Boolean);
      const results: AgentInfo[] = [];
      for (const addr of addresses) {
        const [config, dailyOps, isActive] = await Promise.all([
          contract.getAgentConfig(addr),
          contract.getAgentDailyOps(addr),
          contract.isAgentActive(addr),
        ]);
        results.push({
          address: addr,
          singleLimit: ethers.formatEther(config.singleLimit),
          dailySpendLimit: ethers.formatEther(config.dailySpendLimit),
          spentToday: ethers.formatEther(config.spentToday),
          expiry: Number(config.expiry),
          active: isActive,
          requireApproval: config.requireApproval,
          whitelistEnabled: config.whitelistEnabled,
          paysLeft: Number(dailyOps.paysLeft),
          spendLeft: ethers.formatEther(dailyOps.spendLeft),
        });
      }
      setAgents(results);
    } catch (e) {
      console.error("Failed to load agents", e);
    }
  };

  // Load pending payments
  const loadPending = async () => {
    try {
      const count = Number(await contract.pendingPaymentCount());
      const pending: PendingPaymentInfo[] = [];
      for (let i = 0; i < count; i++) {
        const p = await contract.pendingPayments(i);
        if (p.exists && !p.approved) {
          pending.push({
            id: i,
            agent: p.agent,
            recipient: p.recipient,
            amount: ethers.formatEther(p.amount),
            reason: p.reason,
            taskId: p.taskId,
            agentId: p.agentId,
          });
        }
      }
      setPendingPayments(pending);
    } catch (e) {
      console.error("Failed to load pending", e);
    }
  };

  // Load ledger
  const loadLedger = async (start = 0, count = 20) => {
    try {
      const total = Number(await contract.getLedgerCount());
      setLedgerTotal(total);
      const entries: LedgerEntryInfo[] = [];
      const end = Math.min(start + count, total);
      for (let i = start; i < end; i++) {
        const e = await contract.getLedgerEntry(i);
        entries.push({
          index: i,
          operator: e.operator,
          opType: e.opType,
          amount: ethers.formatEther(e.amount),
          counterparty: e.counterparty,
          reason: e.reason,
          timestamp: Number(e.timestamp),
        });
      }
      setLedger(entries);
    } catch (e) {
      console.error("Failed to load ledger", e);
    }
  };

  // Approve / Reject
  const approvePayment = async (id: number) => {
    const signer = await getSigner();
    if (!signer) return alert("Connect wallet first");
    const wc = getWriteContract(signer);
    const tx = await wc.approvePayment(id);
    await tx.wait();
    loadPending();
    refresh();
  };

  const rejectPayment = async (id: number) => {
    const signer = await getSigner();
    if (!signer) return alert("Connect wallet first");
    const wc = getWriteContract(signer);
    const tx = await wc.rejectPayment(id);
    await tx.wait();
    loadPending();
  };

  const doTx = async (label: string, fn: (wc: ethers.Contract) => Promise<any>) => {
    const signer = await getSigner();
    if (!signer) return alert("请先连接钱包");
    setTxStatus(`${label}: 等待钱包确认...`);
    setTxType("pending");
    try {
      const wc = getWriteContract(signer);
      const tx = await fn(wc);
      setTxStatus(`${label}: 交易已发送，等待链上确认...`);
      setTxType("pending");
      const receipt = await tx.wait();
      setTxStatus(`${label}: 成功! tx=${tx.hash.slice(0, 10)}...`);
      setTxType("success");
      setOpHistory(prev => [{
        time: new Date().toLocaleTimeString(),
        label,
        status: "成功",
        detail: `tx: ${tx.hash.slice(0, 16)}... block: ${receipt.blockNumber}`
      }, ...prev].slice(0, 20));
      refresh();
      loadPending();
      loadLedger();
    } catch (e: any) {
      const msg = e.reason || e.message?.slice(0, 100) || "未知错误";
      setTxStatus(`${label}: 失败 — ${msg}`);
      setTxType("error");
      setOpHistory(prev => [{
        time: new Date().toLocaleTimeString(),
        label,
        status: "失败",
        detail: msg
      }, ...prev].slice(0, 20));
    }
    setTimeout(() => setTxStatus(null), 6000);
  };

  const short = (addr: string) => addr.slice(0, 6) + "..." + addr.slice(-4);

  const opTypeLabel: Record<string, string> = {
    pay: "支付",
    deposit: "存入",
    withdraw: "取出",
    approve: "审批",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-sm">AV</div>
            <h1 className="text-lg font-semibold">AgentVault 金库管理面板</h1>
            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">Monad 测试网</span>
          </div>
          <div className="flex items-center gap-3">
            {wallet ? (
              <span className="text-xs bg-purple-900/50 px-3 py-1 rounded border border-purple-700">已连接: {short(wallet)}</span>
            ) : (
              <button onClick={connectWallet} className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded font-medium transition">
                连接钱包
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content — 所有区块在同一页面 */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        {initialLoading && <p className="text-gray-500 text-sm">正在加载链上数据...</p>}

        {/* ── 概览 ── */}
        <section>
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-800/30 p-5 mb-6">
            <h2 className="text-lg font-bold text-white mb-2">AgentVault — AI Agent 安全支付金库</h2>
            <p className="text-sm text-gray-300 mb-3">你存钱进合约金库，AI Agent 按你设的规则帮你花钱。Agent 只能花限额内的钱，你随时可以一键撤销。</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span className="text-gray-400">你 = Owner（管钱的人）</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-gray-400">AI = Agent（帮你花钱的）</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-gray-400">Vault = 金库（链上合约，按规则执行）</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span><span className="text-gray-400">Session Key = Agent 的临时钥匙（有额度+过期时间）</span></div>
            </div>
          </div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">概览</h2>
          <p className="text-xs text-gray-600 mb-4">金库合约的核心状态：余额、运行状态、所有者地址</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <StatCard label="金库余额" desc="合约中可用于 Agent 支付的 MON 总额" value={`${Number(balance).toFixed(4)} MON`} color="green" />
            <StatCard label="合约状态" desc="紧急暂停开关，暂停后所有操作将被冻结" value={paused ? "已暂停" : "正常运行"} color={paused ? "red" : "green"} />
            <StatCard label="所有者" desc="合约管理员地址，拥有授权/审批/暂停等最高权限" value={short(owner)} color="purple" />
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">合约地址</h3>
            <p className="text-xs text-gray-600 mb-2">AgentVault 智能合约在 Monad 测试网上的部署地址</p>
            <p className="font-mono text-sm text-purple-400 break-all">{VAULT_ADDRESS}</p>
          </div>

          {/* 钱包架构 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="text-sm font-medium text-purple-400 mb-3">钱包架构设计</h3>
            <div className="bg-gray-800/40 rounded-lg p-3 mb-3 text-xs text-gray-300 space-y-2">
              <div>1. <span className="text-purple-400 font-medium">你</span>有一个钱包（MetaMask），这是你的主私钥，能干所有事</div>
              <div>2. <span className="text-blue-400 font-medium">Agent</span>也有一个钱包，这是它的私钥，<span className="text-yellow-400">本来啥也干不了</span></div>
              <div>3. <span className="text-purple-400 font-medium">你在合约里登记</span>：允许这个 Agent 钱包地址帮你花钱，但只能花这么多、只能花到什么时候</div>
              <div>4. Agent 用它的私钥签名 ⇒ 合约看到"这个地址我认识，有授权" ⇒ 按你设的规则放行</div>
              <div className="text-gray-500 mt-1 pt-1 border-t border-gray-700">比方：你的主私钥 = 身份证，Agent 的私钥 = 你给保姆办的临时门卡，门卡本来开不了门，但你在门禁里录入了"这张卡可以开门，但只能开到周五、每天最多进出3次"</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded font-bold">Owner</span>
                  <span className="text-sm font-medium text-purple-300">Vault Owner</span>
                </div>
                <p className="font-mono text-xs text-purple-400 break-all">0x2C7c...190D9</p>
                <p className="text-xs text-gray-500 mt-1">MetaMask ⇒ deposit ⇒ Vault · withdraw ⇒ Owner · revokeAgent ⇒ Agent 失效</p>
                <p className="text-sm font-bold text-purple-300 mt-1">{Number(ownerBalance).toFixed(4)} MON</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded font-bold">Session Key</span>
                  <span className={`text-sm font-medium ${agent2Active ? "text-blue-300" : "text-gray-500"}`}>Agent 2 {agent2Active ? "(Active)" : "(Inactive)"}</span>
                </div>
                <p className="font-mono text-xs text-blue-400 break-all">0xFEA6...f9bb</p>
                <p className="text-xs text-gray-500 mt-1">OpenClaw MCP ⇒ agentPay ⇒ Vault ⇒ 收款人{agent2Config ? ` · 单笔${agent2Config.singleLimit}/日${agent2Config.dailySpendLimit} MON` : ""}</p>
                <p className="text-sm font-bold text-blue-300 mt-1">{Number(agent2Balance).toFixed(4)} MON (gas)</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded font-bold">Session Key</span>
                  <span className={`text-sm font-medium ${agent1Active ? "text-gray-300" : "text-gray-500"}`}>Agent 1 {agent1Active ? "(Standby)" : "(Inactive)"}</span>
                </div>
                <p className="font-mono text-xs text-gray-500 break-all">0x9c10...d684</p>
                <p className="text-xs text-gray-600 mt-1">Standby ⇒ 可随时 revokeAgent 撤销</p>
                <p className="text-sm font-bold text-gray-400 mt-1">{Number(agent1Balance).toFixed(4)} MON (gas)</p>
              </div>
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-600 px-1.5 py-0.5 rounded font-bold">Vault</span>
                  <span className="text-sm font-medium text-green-300">Smart Contract</span>
                </div>
                <p className="font-mono text-xs text-green-400 break-all">{short(VAULT_ADDRESS)}</p>
                <p className="text-xs text-gray-500 mt-1">Owner ⇒ deposit ⇒ Vault ⇒ agentPay ⇒ 收款人 · 非第三方托管</p>
                <p className="text-sm font-bold text-green-300 mt-1">{Number(balance).toFixed(4)} MON</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-400">
                <span className="text-gray-500 font-medium">资金流：</span>
                <span className="text-purple-400">Owner</span>（你的主钱包）⇒ deposit ⇒ <span className="text-green-400">Vault</span>（链上合约金库）⇒ agentPay ⇒ <span className="text-blue-400">收款人</span>
              </div>
              <div className="text-xs text-gray-400">
                <span className="text-gray-500 font-medium">支付流：</span>
                <span className="text-blue-400">Session Key</span>（Agent 受限私钥）⇒ 签名 agentPay ⇒ <span className="text-green-400">Vault</span> 检查限额/白名单/审批 ⇒ 合约转钱给 <span className="text-blue-400">收款人</span>
              </div>
              <div className="text-xs text-gray-400">
                <span className="text-gray-500 font-medium">安全模型：</span>
                <span className="text-blue-400">Session Key</span> 泄露 ⇒ 攻击者只能花限额内（日5 MON）⇒ <span className="text-purple-400">Owner</span> 调用 revokeAgent ⇒ Agent 立即失效止血 ⇒ <span className="text-green-400">Vault</span> 剩余资金安全
              </div>
              <div className="text-xs text-gray-400">
                <span className="text-gray-500 font-medium">关键区别：</span>
                Agent 只出 <span className="text-yellow-400">gas 费</span>（签名手续费），支付金额从 <span className="text-green-400">Vault</span> 出 ⇒ Agent 钱包里没有大额资金
              </div>
            </div>
          </div>
          {/* 术语表 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowGlossary(!showGlossary)}>
              <h3 className="text-sm font-medium text-cyan-400">术语表</h3>
              <span className="text-xs text-gray-600">{showGlossary ? "▲ 收起" : "▼ 展开"}</span>
            </div>
            {showGlossary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs mt-3">
              <div>
                <span className="text-purple-400 font-medium">Owner</span>
                <span className="text-gray-600 ml-1">Vault Owner</span>
                <p className="text-gray-500 mt-0.5">合约所有者，拥有最高权限。你的 MetaMask 钱包地址，能存钱、取钱、授权/撤销 Agent、紧急暂停</p>
              </div>
              <div>
                <span className="text-green-400 font-medium">Vault</span>
                <span className="text-gray-600 ml-1">Smart Contract</span>
                <p className="text-gray-500 mt-0.5">链上智能合约，资金托管的地方。不是人，是一段代码，按规则自动执行，没有第三方</p>
              </div>
              <div>
                <span className="text-blue-400 font-medium">Session Key</span>
                <span className="text-gray-600 ml-1">Agent Session Key</span>
                <p className="text-gray-500 mt-0.5">给 Agent 用的受限临时私钥。有额度限制（单笔/日限额）、有时间限制（过期自动失效）、可随时撤销</p>
              </div>
              <div>
                <span className="text-blue-400 font-medium">agentPay</span>
                <span className="text-gray-600 ml-1">Agent Payment</span>
                <p className="text-gray-500 mt-0.5">Agent 调用的支付函数。只有被授权的 Agent 能调用，Owner 不能直接调用</p>
              </div>
              <div>
                <span className="text-green-400 font-medium">deposit</span>
                <span className="text-gray-600 ml-1">Deposit</span>
                <p className="text-gray-500 mt-0.5">存入操作。Owner 把 MON 从自己的钱包转入 Vault 合约</p>
              </div>
              <div>
                <span className="text-purple-400 font-medium">revokeAgent</span>
                <span className="text-gray-600 ml-1">Revoke Agent</span>
                <p className="text-gray-500 mt-0.5">撤销操作。Owner 一键让 Agent 失效，Agent 立刻不能花任何钱</p>
              </div>
              <div>
                <span className="text-blue-400 font-medium">收款人</span>
                <span className="text-gray-600 ml-1">Recipient</span>
                <p className="text-gray-500 mt-0.5">支付的目标地址。Agent 支付时指定的收款方</p>
              </div>
              <div>
                <span className="text-yellow-400 font-medium">gas 费</span>
                <span className="text-gray-600 ml-1">Transaction Fee</span>
                <p className="text-gray-500 mt-0.5">交易手续费。每笔链上交易都要付给网络，Agent 钱包出这个钱</p>
              </div>
              <div>
                <span className="text-orange-400 font-medium">限额</span>
                <span className="text-gray-600 ml-1">Limit</span>
                <p className="text-gray-500 mt-0.5">合约强制执行的上限。单笔限额（singleLimit）限制每笔最多花多少，日限额（dailySpendLimit）限制每天最多花多少。合约代码强制执行，无法绕过</p>
              </div>
              <div>
                <span className="text-cyan-400 font-medium">白名单</span>
                <span className="text-gray-600 ml-1">Whitelist</span>
                <p className="text-gray-500 mt-0.5">Agent 只能向白名单内的地址支付。开启后，即使限额内也不能付给白名单外的地址</p>
              </div>
              <div>
                <span className="text-yellow-400 font-medium">审批</span>
                <span className="text-gray-600 ml-1">Approval</span>
                <p className="text-gray-500 mt-0.5">Agent 发起支付后不立即执行，挂起等 Owner 批准。Owner 批准后才真正转钱</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">一句话总结</span>
                <p className="text-gray-500 mt-0.5">Owner 管 Vault（存钱+管人），Session Key 管 Agent（受限花钱），Vault 管 钱（按规则执行）</p>
              </div>
            </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={refresh} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition">刷新全部</button>
            <button onClick={loadPending} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition">刷新审批</button>
            <button onClick={() => loadLedger()} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition">刷新账本</button>
          </div>
          {/* 操作反馈通知 */}
          {txStatus && (
            <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all max-w-md ${
              txType === "success" ? "bg-green-900/90 border-green-600 text-green-300" :
              txType === "error" ? "bg-red-900/90 border-red-600 text-red-300" :
              "bg-yellow-900/90 border-yellow-600 text-yellow-300"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{txType === "success" ? "✅" : txType === "error" ? "❌" : "⏳"}</span>
                <span>{txStatus}</span>
              </div>
            </div>
          )}

          {/* 操作历史 */}
          {opHistory.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">操作历史</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {opHistory.map((op, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-600 shrink-0">{op.time}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded ${op.status === "成功" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>{op.status}</span>
                    <span className="text-gray-300">{op.label}</span>
                    <span className="text-gray-600 truncate">{op.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Owner 操作 ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Owner 操作</h2>
          <p className="text-xs text-gray-600 mb-4">仅合约 Owner 可执行的管理操作：存取款、Agent 授权/撤销、白名单管理、紧急暂停等</p>

          {/* 存取款 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-900 rounded-xl border border-green-800/50 p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">存入 Vault 合约</h3>
              <p className="text-xs text-gray-600 mb-2">你的钱包 → Vault 合约，供 Agent 从合约里花钱</p>
              <div className="flex gap-2">
                <input value={depositAmt} onChange={e => setDepositAmt(e.target.value)} placeholder="金额 (MON)" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-green-500" />
                <button onClick={() => doTx("存入Vault", wc => wc.deposit({ value: ethers.parseEther(depositAmt || "0") }))} className="px-4 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition">存入</button>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-yellow-800/50 p-4">
              <h3 className="text-sm font-medium text-yellow-400 mb-1">提取到 Owner 钱包</h3>
              <p className="text-xs text-gray-600 mb-2">Vault 合约 → 你的钱包，把钱从合约拿回来</p>
              <div className="flex gap-2">
                <input value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} placeholder="金额 (MON)" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-500" />
                <button onClick={() => doTx("提取到钱包", wc => wc.withdraw(ethers.parseEther(withdrawAmt || "0")))} className="px-4 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded text-sm font-medium transition">提取</button>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-blue-800/50 p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-1">给 Agent 转 gas 费</h3>
              <p className="text-xs text-gray-600 mb-2">你的钱包 → Agent 钱包，给 Agent 充 gas 费让它能签名交易</p>
              <div className="flex gap-2 mb-2">
                <input value={gasAgentAddr} onChange={e => setGasAgentAddr(e.target.value)} placeholder="Agent 钱包地址" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500" />
                <input value={agent2GasAmt} onChange={e => setAgent2GasAmt(e.target.value)} placeholder="金额 (MON)" className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500" />
                <button onClick={async () => {
                  try {
                    const signer = await getSigner();
                    if (!signer) return;
                    if (!gasAgentAddr || gasAgentAddr.length < 10) { setTxStatus("请填写 Agent 钱包地址"); setTxType("error"); setTimeout(() => setTxStatus(null), 3000); return; }
                    setTxStatus("正在给 Agent 转 gas 费..."); setTxType("pending");
                    const tx = await signer.sendTransaction({ to: gasAgentAddr, value: ethers.parseEther(agent2GasAmt || "0") });
                    setTxStatus(`已发送！txHash: ${tx.hash}`); setTxType("success");
                    setTimeout(() => { setTxStatus(null); refresh(); }, 4000);
                  } catch (err: any) { setTxStatus(`失败: ${err.message?.slice(0, 100)}`); setTxType("error"); setTimeout(() => setTxStatus(null), 5000); }
                }} className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-sm font-medium transition">转入</button>
              </div>
            </div>
          </div>

          {/* Agent 授权/撤销 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <h3 className="text-sm font-medium text-purple-400 mb-2">授权新 Agent</h3>
            <div className="bg-gray-800/40 rounded-lg p-2.5 mb-3 text-xs text-gray-300 space-y-1">
              <div>"授权"就是在合约里登记一条规则：允许这个 Agent 钱包地址帮你花钱，但受以下限制</div>
              <div className="text-gray-500">日限额 = 每天最多花多少 · 单笔限额 = 每笔最多花多少 · 过期时间 = 授权到什么时候失效</div>
              <div className="text-gray-500">需审批 = Agent 花钱前要你先点"批准" · 白名单 = Agent 只能付给你指定的地址</div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs text-gray-500 leading-7">预设模板：</span>
              <button onClick={() => { setNewAgentDaily("0.05"); setNewAgentSingle("0.02"); setNewAgentExpiry("24"); setNewAgentApproval(false); setNewAgentWhitelist(false); }} className="px-2.5 py-1 text-xs bg-blue-900/50 hover:bg-blue-800/50 border border-blue-700/50 rounded transition">自由支付</button>
              <button onClick={() => { setNewAgentDaily("0.05"); setNewAgentSingle("0.02"); setNewAgentExpiry("24"); setNewAgentApproval(true); setNewAgentWhitelist(false); }} className="px-2.5 py-1 text-xs bg-yellow-900/50 hover:bg-yellow-800/50 border border-yellow-700/50 rounded transition">需审批</button>
              <button onClick={() => { setNewAgentDaily("0.05"); setNewAgentSingle("0.02"); setNewAgentExpiry("24"); setNewAgentApproval(false); setNewAgentWhitelist(true); }} className="px-2.5 py-1 text-xs bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-700/50 rounded transition">白名单</button>
              <button onClick={() => { setNewAgentDaily("0.05"); setNewAgentSingle("0.02"); setNewAgentExpiry("24"); setNewAgentApproval(true); setNewAgentWhitelist(true); }} className="px-2.5 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 border border-red-700/50 rounded transition">最严格</button>
              <button onClick={() => { setNewAgentDaily("0.5"); setNewAgentSingle("0.1"); setNewAgentExpiry("1"); setNewAgentApproval(false); setNewAgentWhitelist(false); }} className="px-2.5 py-1 text-xs bg-green-900/50 hover:bg-green-800/50 border border-green-700/50 rounded transition">短期高额</button>
              <button onClick={() => { setNewAgentDaily("0.01"); setNewAgentSingle("0.005"); setNewAgentExpiry("72"); setNewAgentApproval(true); setNewAgentWhitelist(true); }} className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition">长期微额</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Agent 钱包地址 <span className="text-gray-600">— 谁被授权</span></label>
                <input value={newAgentAddr} onChange={e => setNewAgentAddr(e.target.value)} placeholder="0x..." className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">日限额 <span className="text-gray-600">— 每天最多花多少 MON</span></label>
                <input value={newAgentDaily} onChange={e => setNewAgentDaily(e.target.value)} placeholder="0.05" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">单笔限额 <span className="text-gray-600">— 每笔最多花多少 MON</span></label>
                <input value={newAgentSingle} onChange={e => setNewAgentSingle(e.target.value)} placeholder="0.02" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">过期时间 <span className="text-gray-600">— 多少小时后失效</span></label>
                <input value={newAgentExpiry} onChange={e => setNewAgentExpiry(e.target.value)} placeholder="24" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">需审批 <span className="text-gray-600">— Agent花钱前要你批准</span></label>
                <label className="flex items-center gap-2 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 cursor-pointer w-full">
                  <input type="checkbox" checked={newAgentApproval} onChange={e => setNewAgentApproval(e.target.checked)} className="accent-purple-500" />
                  {newAgentApproval ? "是，每笔都要批准" : "否，自动放行"}
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">白名单 <span className="text-gray-600">— 只能付给指定地址</span></label>
                <label className="flex items-center gap-2 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 cursor-pointer w-full">
                  <input type="checkbox" checked={newAgentWhitelist} onChange={e => setNewAgentWhitelist(e.target.checked)} className="accent-purple-500" />
                  {newAgentWhitelist ? "是，只能付白名单地址" : "否，可付任意地址"}
                </label>
              </div>
            </div>
            <button onClick={() => {
              const expiry = Math.floor(Date.now() / 1000) + Number(newAgentExpiry) * 3600;
              doTx("授权Agent", wc => wc.authorizeAgent(newAgentAddr, ethers.parseEther(newAgentSingle), ethers.parseEther(newAgentDaily), expiry, newAgentApproval, newAgentWhitelist));
            }} className="px-4 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-sm font-medium transition">授权</button>
          </div>

          {/* 撤销 Agent */}
          {agents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {agents.filter(a => a.active).map(a => (
                <button key={a.address} onClick={() => doTx(`撤销 ${short(a.address)}`, wc => wc.revokeAgent(a.address))} className="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-800 rounded border border-red-700 transition">
                  撤销 {short(a.address)}
                </button>
              ))}
            </div>
          )}

          {/* 白名单 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <h3 className="text-sm font-medium text-cyan-400 mb-2">白名单管理</h3>
            <p className="text-xs text-gray-600 mb-2">为指定 Agent 添加/移除白名单收款地址。启用白名单后，Agent 只能向白名单内的地址支付</p>
            <div className="flex gap-2 mb-2">
              <input value={wlAgent} onChange={e => setWlAgent(e.target.value)} placeholder="Agent 钱包地址" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              <input value={wlRecipient} onChange={e => setWlRecipient(e.target.value)} placeholder="收款方地址" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              <button onClick={() => doTx("添加白名单", wc => wc.addWhitelist(wlAgent, wlRecipient))} className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded text-sm font-medium transition">添加</button>
              <button onClick={() => doTx("移除白名单", wc => wc.removeWhitelist(wlAgent, wlRecipient))} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition">移除</button>
            </div>
          </div>

          {/* Session Key 过期控制 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <h3 className="text-sm font-medium text-orange-400 mb-2">Session Key 过期控制</h3>
            <div className="bg-gray-800/40 rounded-lg p-2.5 mb-3 text-xs text-gray-300 space-y-1">
              <div>控制的是"Agent 的授权什么时候到期作废"。合约里记录了过期时间，过了这个时间 Agent 就不能花钱了</div>
              <div className="text-gray-500">延长 = 把过期时间往后推 N 小时 · 立即失效 = 把过期时间设为过去，Agent 立刻不能花钱</div>
              <div className="text-gray-500">比方：保姆门卡的有效期，到期自动刷不开，你也可以提前作废</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2 mb-2 text-xs text-gray-500 space-y-1">
              <div><span className="text-gray-400">左框</span>：填 Agent 钱包地址（如 <code className="text-orange-400">0xFEA649D09E16e20e8f715fA845C962BaB1ACf9bb</code>）</div>
              <div><span className="text-gray-400">右框</span>：填延长的小时数（如 <code className="text-orange-400">24</code> = 延长 24 小时）</div>
              <div><span className="text-orange-400">延长</span>：在当前时间基础上加 N 小时</div>
              <div><span className="text-red-400">立即失效</span>：把过期时间设为过去，Agent 立刻失去权限（无需填小时数）</div>
            </div>
            <div className="flex gap-2 mb-2">
              <input value={expiryAgent} onChange={e => setExpiryAgent(e.target.value)} placeholder="Agent 钱包地址" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              <input value={expiryHours} onChange={e => setExpiryHours(e.target.value)} placeholder="延长小时数" className="w-36 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none" />
              <button onClick={() => {
                const expiry = Math.floor(Date.now() / 1000) + Number(expiryHours) * 3600;
                doTx("更新过期时间", wc => wc.updateAgentExpiry(expiryAgent, expiry));
              }} className="px-4 py-1.5 bg-orange-700 hover:bg-orange-600 rounded text-sm font-medium transition">延长</button>
              <button onClick={() => {
                doTx("强制失效", wc => wc.updateAgentExpiry(expiryAgent, Math.floor(Date.now() / 1000) - 1));
              }} className="px-4 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition">立即失效</button>
            </div>
          </div>

          {/* 紧急操作 */}
          <div className="flex gap-2">
            <button onClick={() => doTx("紧急暂停", wc => wc.emergencyPause())} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-sm font-medium transition border border-red-600">
              紧急暂停
            </button>
            <button onClick={() => doTx("恢复运行", wc => wc.unpause())} className="px-4 py-2 bg-green-800 hover:bg-green-700 rounded text-sm font-medium transition border border-green-600">
              恢复运行
            </button>
          </div>
        </section>

        {/* ── Agent 管理 ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Agent 管理</h2>
          <p className="text-xs text-gray-600 mb-4">查询已授权 Agent 的配置信息：限额、白名单、审批要求、Session Key 过期时间等。每个 Agent 拥有独立差异化配置的受限 Session Key</p>
          <div className="flex gap-2 mb-4">
            <input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              placeholder="输入 Agent 钱包地址（多个用逗号分隔）"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <button onClick={loadAgents} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium transition">查询</button>
          </div>
          {agents.length === 0 && <p className="text-gray-500 text-sm">在上方输入 Agent 钱包地址查看其配置</p>}
          {agents.map((a) => (
            <div key={a.address} className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-purple-400">{short(a.address)}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${a.active ? "bg-green-900/50 text-green-400 border border-green-700" : "bg-red-900/50 text-red-400 border border-red-700"}`}>
                  {a.active ? "活跃" : "已失效"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">单笔限额</span>
                  <p className="text-xs text-gray-600">该 Agent 单次支付的最大金额</p>
                  {a.singleLimit} MON
                </div>
                <div>
                  <span className="text-gray-500">日消费上限</span>
                  <p className="text-xs text-gray-600">该 Agent 每天可花费的总额度</p>
                  {a.dailySpendLimit} MON
                </div>
                <div>
                  <span className="text-gray-500">今日已消费</span>
                  <p className="text-xs text-gray-600">今天该 Agent 已使用的消费金额</p>
                  {a.spentToday} MON
                </div>
                <div>
                  <span className="text-gray-500">今日剩余额度</span>
                  <p className="text-xs text-gray-600">日消费上限 - 今日已消费</p>
                  {a.spendLeft} MON
                </div>
                <div>
                  <span className="text-gray-500">今日剩余支付次数</span>
                  <p className="text-xs text-gray-600">每天最多 10 次支付操作</p>
                  {a.paysLeft} 次
                </div>
                <div>
                  <span className="text-gray-500">Session Key 过期时间</span>
                  <p className="text-xs text-gray-600">过期后 Agent 自动失去操作权限</p>
                  {new Date(a.expiry * 1000).toLocaleString()}
                </div>
                <div>
                  <span className="text-gray-500">审批要求</span>
                  <p className="text-xs text-gray-600">开启后每笔支付需 Owner 人工批准</p>
                  {a.requireApproval ? "需审批" : "自动通过"}
                </div>
                <div>
                  <span className="text-gray-500">白名单模式</span>
                  <p className="text-xs text-gray-600">开启后只能向白名单地址支付</p>
                  {a.whitelistEnabled ? "已启用" : "未启用"}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── 待审批支付 ── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">待审批支付</h2>
            <span className="text-xs text-yellow-400">{pendingPayments.length} 笔待审批</span>
          </div>
          <p className="text-xs text-gray-600 mb-4">开启了"需审批"的 Agent 发起支付后，资金不会立即转出，而是挂起等待 Owner 批准。批准后才会执行转账。</p>
          {pendingPayments.length === 0 && <p className="text-gray-500 text-sm">当前没有待审批的支付请求</p>}
          {pendingPayments.map((p) => (
            <div key={p.id} className="bg-gray-900 rounded-xl border border-yellow-800/50 p-5 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 font-medium text-sm">支付请求 #{p.id}</span>
                <span className="text-lg font-bold">{p.amount} MON</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">发起 Agent</span>
                  <p className="text-xs text-gray-600">请求支付的 Agent 钱包地址</p>
                  <span className="font-mono text-xs">{short(p.agent)}</span>
                </div>
                <div>
                  <span className="text-gray-500">收款方</span>
                  <p className="text-xs text-gray-600">资金将转入的目标地址</p>
                  <span className="font-mono text-xs">{short(p.recipient)}</span>
                </div>
                <div>
                  <span className="text-gray-500">支付原因</span>
                  <p className="text-xs text-gray-600">Agent 说明的支付用途</p>
                  {p.reason}
                </div>
                <div>
                  <span className="text-gray-500">任务 ID</span>
                  <p className="text-xs text-gray-600">关联的任务标识，用于审计追踪</p>
                  {p.taskId}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => approvePayment(p.id)} className="flex-1 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition">批准并执行</button>
                <button onClick={() => rejectPayment(p.id)} className="flex-1 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition">拒绝</button>
              </div>
            </div>
          ))}
        </section>

        {/* ── 链上审计账本 ── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">链上审计账本</h2>
            <span className="text-xs text-gray-500">共 {ledgerTotal} 条记录</span>
          </div>
          <p className="text-xs text-gray-600 mb-4">所有操作（存入、取出、支付、审批）都记录在链上账本中，不可篡改，可追溯审计。每条记录包含操作者、金额、对手方、原因和时间戳。</p>
          {ledger.length === 0 && <p className="text-gray-500 text-sm">正在加载账本记录...</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-left">
                  <th className="py-2 px-3">序号</th>
                  <th className="py-2 px-3">操作类型</th>
                  <th className="py-2 px-3">操作者</th>
                  <th className="py-2 px-3">金额</th>
                  <th className="py-2 px-3">对手方</th>
                  <th className="py-2 px-3">原因</th>
                  <th className="py-2 px-3">时间</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.index} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-2 px-3 text-gray-500">{e.index}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        e.opType === "pay" ? "bg-purple-900/50 text-purple-400" :
                        e.opType === "deposit" ? "bg-green-900/50 text-green-400" :
                        e.opType === "withdraw" ? "bg-yellow-900/50 text-yellow-400" :
                        "bg-blue-900/50 text-blue-400"
                      }`}>{opTypeLabel[e.opType] || e.opType}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{short(e.operator)}</td>
                    <td className="py-2 px-3 font-mono">{e.amount} MON</td>
                    <td className="py-2 px-3 font-mono text-xs">{e.counterparty === ethers.ZeroAddress ? "—" : short(e.counterparty)}</td>
                    <td className="py-2 px-3 text-gray-400 max-w-[200px] truncate">{e.reason || "—"}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{new Date(e.timestamp * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 系统架构设计 ── */}
        <section>
          <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setShowArchitecture(!showArchitecture)}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">系统架构设计</h2>
            <span className="text-xs text-gray-600">{showArchitecture ? "▲ 收起" : "▼ 展开"}</span>
          </div>
          {showArchitecture && (
          <>

          {/* 1. 整体架构 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="text-sm font-medium text-purple-400 mb-3">整体架构</h3>
            <p className="text-xs text-gray-500 mb-3">AgentVault 全系统组件关系和数据流</p>
            <div className="grid grid-cols-1 gap-3">
              {/* Owner 层 */}
              <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-purple-600 px-2 py-0.5 rounded font-bold">Layer 1</span>
                  <span className="text-sm font-medium text-purple-300">Owner（你）</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-purple-900/30 rounded p-2">
                    <span className="text-purple-400 font-medium">MetaMask</span>
                    <p className="text-gray-500 mt-0.5">主私钥签名，执行所有 Owner 操作</p>
                  </div>
                  <div className="bg-purple-900/30 rounded p-2">
                    <span className="text-purple-400 font-medium">前端 Dashboard</span>
                    <p className="text-gray-500 mt-0.5">存款/提款/授权/撤销/审批/白名单/暂停</p>
                  </div>
                </div>
              </div>
              {/* 箭头 */}
              <div className="text-center text-xs text-gray-600">▼ Owner 私钥签名 ▼</div>
              {/* 合约层 */}
              <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-green-600 px-2 py-0.5 rounded font-bold">Layer 2</span>
                  <span className="text-sm font-medium text-green-300">AgentVault 合约（Monad 链上）</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-green-900/30 rounded p-2">
                    <span className="text-orange-400 font-medium">Policy Engine</span>
                    <p className="text-gray-500 mt-0.5">单笔限额 / 日限额 / 白名单 / 策略命中</p>
                  </div>
                  <div className="bg-green-900/30 rounded p-2">
                    <span className="text-blue-400 font-medium">Session Key</span>
                    <p className="text-gray-500 mt-0.5">过期时间 / 差异化配置 / 自动失效</p>
                  </div>
                  <div className="bg-green-900/30 rounded p-2">
                    <span className="text-yellow-400 font-medium">审批队列</span>
                    <p className="text-gray-500 mt-0.5">待审批 / 批准 / 拒绝</p>
                  </div>
                  <div className="bg-green-900/30 rounded p-2">
                    <span className="text-cyan-400 font-medium">链上账本</span>
                    <p className="text-gray-500 mt-0.5">操作者 / 金额 / 原因 / policyHit</p>
                  </div>
                </div>
              </div>
              {/* 箭头 */}
              <div className="text-center text-xs text-gray-600">▼ Agent Session Key 签名 ▼</div>
              {/* Agent 层 */}
              <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-blue-600 px-2 py-0.5 rounded font-bold">Layer 3</span>
                  <span className="text-sm font-medium text-blue-300">AI Agent（OpenClaw）</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-900/30 rounded p-2">
                    <span className="text-blue-400 font-medium">MCP Server</span>
                    <p className="text-gray-500 mt-0.5">11 个工具，Agent 用自然语言即可调用合约</p>
                  </div>
                  <div className="bg-blue-900/30 rounded p-2">
                    <span className="text-blue-400 font-medium">SDK</span>
                    <p className="text-gray-500 mt-0.5">checkBudget / payWithRetry / 错误翻译</p>
                  </div>
                </div>
              </div>
              {/* 箭头 */}
              <div className="text-center text-xs text-gray-600">▼ x402 协议（HTTP 402）▼</div>
              {/* x402 层 */}
              <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-orange-600 px-2 py-0.5 rounded font-bold">Layer 4</span>
                  <span className="text-sm font-medium text-orange-300">x402 付费 API</span>
                </div>
                <div className="text-xs text-gray-400">请求 → 402 + 支付信息 → 签名支付 → 重试 → 200 + 资源（GPT-4 / GPU / 数据集 / 存储）</div>
              </div>
            </div>
          </div>

          {/* 2. Agent 架构 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="text-sm font-medium text-blue-400 mb-3">Agent 架构</h3>
            <p className="text-xs text-gray-500 mb-3">从你说话到链上执行的完整流程</p>
            <div className="space-y-2">
              <div className="bg-purple-900/15 border border-purple-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-purple-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 1</span>
                <div className="text-xs"><span className="text-purple-400 font-medium">你说话</span><span className="text-gray-400 ml-2">在 OpenClaw 输入自然语言，如「帮我支付 0.001 MON」</span></div>
              </div>
              <div className="bg-blue-900/15 border border-blue-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 2</span>
                <div className="text-xs"><span className="text-blue-400 font-medium">OpenClaw 识别意图</span><span className="text-gray-400 ml-2">AI 模型理解你的话，选择调用哪个 MCP 工具</span></div>
              </div>
              <div className="bg-blue-900/15 border border-blue-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 3</span>
                <div className="text-xs"><span className="text-blue-400 font-medium">MCP Server 执行</span><span className="text-gray-400 ml-2">MCP 服务器收到工具调用请求，用 SDK 与合约交互</span><p className="text-gray-500 mt-1">check_budget（预检）→ pay_with_retry（支付+重试）→ 返回结果</p></div>
              </div>
              <div className="bg-green-900/15 border border-green-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-green-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 4</span>
                <div className="text-xs"><span className="text-green-400 font-medium">合约检查策略</span><span className="text-gray-400 ml-2">合约逐层检查安全策略，全部通过才执行</span><p className="text-gray-500 mt-1">单笔限额 → 日限额 → 白名单 → 审批要求 → 过期时间</p></div>
              </div>
              <div className="bg-green-900/15 border border-green-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-green-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 5</span>
                <div className="text-xs"><span className="text-green-400 font-medium">链上执行</span><span className="text-gray-400 ml-2">从 Vault 转钱给收款人，写入账本，发出事件</span><p className="text-gray-500 mt-1">policyHit 记录命中了哪个策略 / autoApproved 标记是否自动通过</p></div>
              </div>
              <div className="bg-purple-900/15 border border-purple-700/30 rounded-lg p-3 flex gap-3">
                <span className="text-xs bg-purple-600 px-2 py-0.5 rounded font-bold h-fit shrink-0">Step 6</span>
                <div className="text-xs"><span className="text-purple-400 font-medium">返回结果</span><span className="text-gray-400 ml-2">OpenClaw 把 txHash 或错误信息返回给你</span><p className="text-gray-500 mt-1">成功：txHash / 失败：PaymentError（code + suggestion）</p></div>
              </div>
            </div>
            <div className="mt-3 bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium mb-2">11 个 MCP 工具：</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-blue-400">check_budget</span> <span className="text-gray-600">— 预检</span></div>
                <div><span className="text-blue-400">pay</span> <span className="text-gray-600">— 支付</span></div>
                <div><span className="text-blue-400">pay_with_retry</span> <span className="text-gray-600">— 支付+重试</span></div>
                <div><span className="text-green-400">get_balance</span> <span className="text-gray-600">— 余额</span></div>
                <div><span className="text-green-400">get_agent_config</span> <span className="text-gray-600">— 配置</span></div>
                <div><span className="text-green-400">get_daily_ops</span> <span className="text-gray-600">— 额度</span></div>
                <div><span className="text-purple-400">get_ledger</span> <span className="text-gray-600">— 账本</span></div>
                <div><span className="text-purple-400">get_payment_logs</span> <span className="text-gray-600">— 审计</span></div>
                <div><span className="text-yellow-400">request_limit_increase</span> <span className="text-gray-600">— 提额</span></div>
                <div><span className="text-yellow-400">pending_approvals</span> <span className="text-gray-600">— 待审批</span></div>
                <div><span className="text-orange-400">x402_pay_api</span> <span className="text-gray-600">— 付费API</span></div>
              </div>
            </div>
          </div>

          {/* 3. 钱包架构 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <h3 className="text-sm font-medium text-cyan-400 mb-3">钱包架构</h3>
            <p className="text-xs text-gray-500 mb-3">4 个钱包地址的角色和关系</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-purple-900/15 border border-purple-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-purple-600 px-2 py-0.5 rounded font-bold">Owner</span>
                  <span className="text-sm font-medium text-purple-300">你的主钱包</span>
                </div>
                <p className="font-mono text-xs text-purple-400">0x2C7c...190D9</p>
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <div>• 持有主私钥，拥有合约最高权限</div>
                  <div>• 能做所有事：存款/提款/授权/撤销/审批/暂停</div>
                  <div>• 出资方：MON 从这里 deposit 进 Vault</div>
                </div>
              </div>
              <div className="bg-green-900/15 border border-green-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-600 px-2 py-0.5 rounded font-bold">Vault</span>
                  <span className="text-sm font-medium text-green-300">合约金库</span>
                </div>
                <p className="font-mono text-xs text-green-400">{short(VAULT_ADDRESS)}</p>
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <div>• 不是人，是链上智能合约，按规则自动执行</div>
                  <div>• 资金池：Owner 存钱进来，Agent 从这里花钱</div>
                  <div>• 非托管：没有第三方，代码即规则</div>
                </div>
              </div>
              <div className="bg-blue-900/15 border border-blue-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-600 px-2 py-0.5 rounded font-bold">Agent 2</span>
                  <span className="text-sm font-medium text-blue-300">活跃 Agent</span>
                </div>
                <p className="font-mono text-xs text-blue-400">0xFEA6...f9bb</p>
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <div>• 持有 Session Key（受限私钥），只能 agentPay</div>
                  <div>• 只出 gas 费，支付金额从 Vault 出</div>
                  <div>• 受限：单笔/日限额/过期/白名单/审批</div>
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-600 px-2 py-0.5 rounded font-bold">Agent 1</span>
                  <span className="text-sm font-medium text-gray-400">备用 Agent</span>
                </div>
                <p className="font-mono text-xs text-gray-500">0x9c10...d684</p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>• 同样持有 Session Key，但当前未授权</div>
                  <div>• 可随时 authorizeAgent 启用 / revokeAgent 撤销</div>
                  <div>• 演示差异化配置：与 Agent 2 不同的限额</div>
                </div>
              </div>
            </div>
            <div className="mt-3 bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
              <div><span className="text-purple-400 font-medium">资金流</span>：Owner（主钱包）⇒ deposit ⇒ Vault（合约）⇒ agentPay ⇒ 收款人</div>
              <div><span className="text-blue-400 font-medium">支付流</span>：Agent（Session Key 签名）⇒ agentPay ⇒ Vault 检查策略 ⇒ 转钱给收款人</div>
              <div><span className="text-red-400 font-medium">安全模型</span>：Session Key 泄露 ⇒ 攻击者只能花限额内 ⇒ Owner revokeAgent ⇒ Agent 立即失效 ⇒ Vault 剩余资金安全</div>
            </div>
          </div>

          {/* 赛题要求对照 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowRequirements(!showRequirements)}>
              <h3 className="text-sm font-medium text-green-400">赛题 5 项要求对照</h3>
              <span className="text-xs text-gray-600">{showRequirements ? "▲ 收起" : "▼ 展开"}</span>
            </div>
            {showRequirements && (
            <>
            <p className="text-xs text-gray-600 mb-4 mt-3">每项要求 ⇒ 我们怎么实现 ⇒ 怎么验证达标</p>
            <div className="space-y-4">
              {/* 要求1 */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-bold">✅ 1. 去中心化（Decentralization）</span>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div><span className="text-purple-400 font-medium">非托管</span>（Non-custodial）：资金存在 Vault 合约中，不是交易所或第三方钱包。Owner ⇒ deposit ⇒ Vault ⇒ agentPay ⇒ 收款人，全程链上，无人可挪用</div>
                  <div><span className="text-blue-400 font-medium">Agent 受限</span>（Agent Isolation）：Agent 只有 Session Key（受限私钥），不持有 Owner 私钥。Agent ⇒ agentPay ⇒ Vault 检查限额 ⇒ 转钱。Agent 无法 withdraw / authorizeAgent / emergencyPause</div>
                  <div><span className="text-orange-400 font-medium">随时撤销</span>（Instant Revocation）：Owner ⇒ revokeAgent ⇒ Agent 立即失效。或 Owner ⇒ updateAgentExpiry(过去时间) ⇒ Agent 立即失效。1 笔交易止血</div>
                  <div><span className="text-cyan-400 font-medium">达标验证</span>：前端连接 MetaMask 直接与合约交互，不经过任何中间服务器。OpenClaw Agent 通过 MCP 调用合约，也是直接链上。无后端、无数据库、无第三方</div>
                </div>
              </div>
              {/* 要求2 */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-bold">✅ 2. 安全配置（Security Configuration）</span>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div><span className="text-orange-400 font-medium">singleLimit</span>（单笔限额）：合约强制限制每笔最多花多少。Agent 请求支付 ⇒ Vault 检查 amount {'>'} singleLimit ⇒ 拒绝。当前设置：1 MON/笔</div>
                  <div><span className="text-orange-400 font-medium">dailySpendLimit</span>（日消费限额）：每天最多花多少，每日自动重置。Agent 请求支付 ⇒ Vault 检查 spentToday + amount {'>'} dailySpendLimit ⇒ 拒绝。当前设置：5 MON/天</div>
                  <div><span className="text-cyan-400 font-medium">whitelistEnabled</span>（白名单模式）：Agent 只能向白名单地址支付。Agent 请求支付 ⇒ Vault 检查 recipient ∉ whitelist ⇒ 拒绝。即使限额内也不能付给白名单外地址</div>
                  <div><span className="text-yellow-400 font-medium">requireApproval</span>（超额审批）：Agent 支付不立即执行，挂起等 Owner 批准。Agent ⇒ agentPay ⇒ Vault 创建 PendingPayment ⇒ Owner 前端点击批准/拒绝 ⇒ 执行/取消</div>
                  <div><span className="text-red-400 font-medium">emergencyPause</span>（紧急暂停）：Owner 一键冻结所有操作。Owner ⇒ emergencyPause ⇒ 全部 deposit/withdraw/agentPay 被拦截 ⇒ unpause 恢复</div>
                  <div><span className="text-gray-400 font-medium">maxDailyOps</span>（操作次数限制）：每日存/取/付各最多 10 次，防止 Agent 被滥用后高频刷交易</div>
                  <div><span className="text-cyan-400 font-medium">达标验证</span>：在前端授权 Agent 时设置 requireApproval=true ⇒ Agent 支付被挂起 ⇒ 前端审批队列出现请求 ⇒ 批准后支付成功。演示限额超限被拒绝</div>
                </div>
              </div>
              {/* 要求3 */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-bold">✅ 3. Agent 原生（Agent-Native）</span>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div><span className="text-blue-400 font-medium">checkBudget</span>（预检）：Agent 支付前先检查能不能付。Agent ⇒ checkBudget(amount, recipient) ⇒ 返回 canPay / reason（余额不足/超限额/不在白名单/已过期）</div>
                  <div><span className="text-blue-400 font-medium">payWithRetry</span>（自动重试）：支付失败自动重试。Agent ⇒ payWithRetry() ⇒ 失败(nonce冲突/gas不足) ⇒ 自动调整重试 ⇒ 最多3次 ⇒ 返回最终结果</div>
                  <div><span className="text-blue-400 font-medium">PaymentError</span>（错误翻译）：合约错误翻译成 Agent 可理解的格式。合约 revert ⇒ SDK 翻译为 {'{'} code: SINGLE_LIMIT, canRetry: false, suggestion: "请求提额或减少金额" {'}'}</div>
                  <div><span className="text-blue-400 font-medium">任务上下文</span>（Task Context）：每笔支付带 reason（支付原因）/ taskId（任务ID）/ agentId（Agent标识），用于审计追踪</div>
                  <div><span className="text-blue-400 font-medium">requestLimitIncrease</span>（请求提额）：Agent 额度不够时主动请求提额。Agent ⇒ requestLimitIncrease(newLimit, reason) ⇒ Owner 在前端看到请求 ⇒ 决定是否执行 updateAgentConfig</div>
                  <div><span className="text-blue-400 font-medium">MCP 集成</span>：11 个工具注册到 OpenClaw，Agent 用自然语言即可调用。用户说话 ⇒ OpenClaw 识别意图 ⇒ 调用对应 MCP 工具 ⇒ 返回结果</div>
                  <div><span className="text-cyan-400 font-medium">达标验证</span>：在 OpenClaw 输入"帮我支付 0.001 MON" ⇒ Agent 自动调用 check_budget 预检 ⇒ pay_with_retry 支付 ⇒ 返回 txHash。输入"我要付 5 MON" ⇒ 返回错误翻译 SINGLE_LIMIT</div>
                </div>
              </div>
              {/* 要求4 */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-bold">✅ 4. 可审计（Auditability）</span>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div><span className="text-green-400 font-medium">Ledger</span>（链上账本）：每笔操作写入合约存储。deposit/withdraw/agentPay/approve ⇒ 写入 Ledger(operator, opType, amount, counterparty, reason, timestamp) ⇒ 不可篡改</div>
                  <div><span className="text-green-400 font-medium">policyHit</span>（策略命中）：记录支付通过了哪个安全策略。agentPay ⇒ Vault 检查策略 ⇒ 记录 policyHit: "auto_approved" / "whitelist_checked" / "human_approved" ⇒ 可追溯决策路径</div>
                  <div><span className="text-green-400 font-medium">autoApproved</span>（审批标记）：区分自动通过和人工审批。autoApproved=true ⇒ 限额内自动放行。autoApproved=false ⇒ Owner 手动批准</div>
                  <div><span className="text-green-400 font-medium">多端查询</span>：前端 Dashboard 账本表格 + SDK getLedger/getPaymentLogs + MCP get_ledger/get_payment_logs + 链上 AgentPayment 事件。任一端可查全量审计数据</div>
                  <div><span className="text-cyan-400 font-medium">达标验证</span>：前端"链上审计账本"表格显示所有操作记录。OpenClaw 输入"查看支付审计日志" ⇒ Agent 调用 get_payment_logs ⇒ 返回含 policyHit 的审计数据</div>
                </div>
              </div>
              {/* 要求5 */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-bold">✅ 5. 恢复与权限管理（Recovery & Permission Management）</span>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div><span className="text-purple-400 font-medium">withdraw</span>（资金恢复）：Owner 随时提取 Vault 全部资金。Owner ⇒ withdraw(amount) ⇒ Vault 转钱回 Owner 钱包。即使 Agent 被盗，Owner 也能先把钱全取走</div>
                  <div><span className="text-purple-400 font-medium">updateAgentConfig</span>（权限调整）：Owner 实时修改 Agent 限额/审批/白名单。Owner ⇒ updateAgentConfig(agent, newSingleLimit, newDailyLimit, newExpiry, requireApproval, whitelistEnabled) ⇒ 立即生效</div>
                  <div><span className="text-orange-400 font-medium">updateAgentExpiry</span>（Session 轮换）：延长或强制失效 Session Key。Owner ⇒ updateAgentExpiry(agent, 未来时间) ⇒ 延长。Owner ⇒ updateAgentExpiry(agent, 过去时间) ⇒ 立即失效</div>
                  <div><span className="text-orange-400 font-medium">自动失效</span>（Auto Expiry）：block.timestamp {'>'} expiry ⇒ Agent 自动失去权限，无需 Owner 操作。Session Key 天然有时间限制</div>
                  <div><span className="text-blue-400 font-medium">差异化配置</span>（Per-Agent Config）：每个 Agent 独立 AgentConfig，互不影响。Agent A 日限额 5 MON，Agent B 日限额 0.5 MON，各自独立计算</div>
                  <div><span className="text-cyan-400 font-medium">达标验证</span>：前端"Session Key 过期控制"点"立即失效" ⇒ Agent 立刻不能支付。前端"授权新 Agent"设置不同限额 ⇒ 查询显示差异化配置。Owner withdraw 提取资金成功</div>
                </div>
              </div>
            </div>
            </>
            )}
          </div>

          {/* 加分项 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowBonus(!showBonus)}>
              <h3 className="text-sm font-medium text-yellow-400">加分特性</h3>
              <span className="text-xs text-gray-600">{showBonus ? "▲ 收起" : "▼ 展开"}</span>
            </div>
            {showBonus && (
            <>
            <p className="text-xs text-gray-600 mb-4 mt-3">超出赛题基本要求的创新特性</p>
            <div className="space-y-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">🔴 A</span>
                  <span className="text-sm font-medium text-gray-300">Session Key 机制</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>Agent 使用受限临时私钥（Session Key），非 Owner 主私钥。Session Key 有三重限制：额度限制（singleLimit + dailySpendLimit）+ 时间限制（expiry 过期自动失效）+ 操作限制（只能 agentPay，不能 withdraw/authorize）</div>
                  <div><span className="text-red-400">流程</span>：Owner ⇒ authorizeAgent(agentAddr, limits, expiry) ⇒ Agent 获得 Session Key ⇒ Agent 使用中 ⇒ 过期/撤销 ⇒ Agent 失效</div>
                  <div><span className="text-cyan-400">验证</span>：前端"Session Key 过期控制"可延长/立即失效。OpenClaw Agent 支付时自动受限于 Session Key 配置</div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">🔴 B</span>
                  <span className="text-sm font-medium text-gray-300">Policy Engine 策略引擎</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>合约内置多层安全策略，每笔支付自动检查并记录命中结果。策略链：单笔限额 ⇒ 日限额 ⇒ 白名单 ⇒ 审批要求 ⇒ 操作次数 ⇒ 过期时间。全部通过才执行支付</div>
                  <div><span className="text-red-400">流程</span>：Agent ⇒ agentPay ⇒ Policy Engine 逐层检查 ⇒ 命中策略记录到 policyHit ⇒ 通过则执行 / 命中拒绝策略则 revert</div>
                  <div><span className="text-cyan-400">验证</span>：支付审计日志中显示 policyHit 字段："auto_approved"（限额内自动通过）/ "whitelist_checked"（白名单校验通过）/ "human_approved"（人工审批通过）</div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">🟡 D</span>
                  <span className="text-sm font-medium text-gray-300">x402 机器支付协议</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>HTTP 402 Payment Required 协议实现。Agent 调用付费 API 时，服务端返回 402 + 支付信息，Agent 自动签名支付后重试获取资源</div>
                  <div><span className="text-yellow-400">流程</span>：Agent ⇒ HTTP GET API ⇒ 服务端返回 402 + paymentRequired(金额/地址) ⇒ Agent 调用 x402_pay_api ⇒ 签名支付 ⇒ HTTP GET 重试 ⇒ 200 + 资源</div>
                  <div><span className="text-cyan-400">验证</span>：OpenClaw 输入"调用付费 API http://localhost:3001/api/gpt4，最多付 0.005 MON" ⇒ Agent 自动完成 402 支付流程</div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">🟡 E</span>
                  <span className="text-sm font-medium text-gray-300">人机协同审批</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>Agent 发起支付后不立即执行，挂起等待 Owner 批准。支持 Telegram Bot 推送 + 前端审批按钮 + MCP 查询待审批列表</div>
                  <div><span className="text-yellow-400">流程</span>：Agent ⇒ agentPay(requireApproval=true) ⇒ Vault 创建 PendingPayment ⇒ Telegram 推送 + 前端显示待审批 ⇒ Owner 批准/拒绝 ⇒ 执行/取消</div>
                  <div><span className="text-cyan-400">验证</span>：前端授权 Agent 时勾选"需审批" ⇒ Agent 支付被挂起 ⇒ 前端"待审批支付"出现请求 ⇒ 点击"批准并执行" ⇒ 支付成功</div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">🟢 F</span>
                  <span className="text-sm font-medium text-gray-300">全链路审计日志</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>链上账本 + 链上事件 + policyHit 策略命中 + 前端 Dashboard + SDK + MCP，6 种方式均可查询审计数据</div>
                  <div><span className="text-green-400">流程</span>：任何操作 ⇒ Vault 写入 Ledger(操作者/类型/金额/对手方/原因/时间) + 发出 AgentPayment 事件(含 policyHit/agentId/taskId) ⇒ 多端可查</div>
                  <div><span className="text-cyan-400">验证</span>：前端"链上审计账本"表格 / OpenClaw "查看支付审计日志" / SDK getPaymentLogs / MonadScan 链上事件，4 种方式均可查到相同数据</div>
                </div>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Agent 对话演示指南 */}
          <div className="bg-gray-900 rounded-xl border border-orange-800/50 p-5 mb-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDemoGuide(!showDemoGuide)}>
              <h3 className="text-sm font-medium text-orange-400">Agent 对话演示指南（OpenClaw 输入）</h3>
              <span className="text-xs text-gray-600">{showDemoGuide ? "▲ 收起" : "▼ 展开"}</span>
            </div>
            {showDemoGuide && (
            <>
            <p className="text-xs text-gray-600 mb-3 mt-3">按赛题要求分类，直接复制到 OpenClaw 聊天框即可演示</p>

            <div className="space-y-4">
              <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-orange-400 mb-2">🔥 核心场景：让 Agent 花钱</h4>
                <p className="text-xs text-gray-500 mb-2">你只需要告诉 Agent 付给谁、付多少、为什么，Agent 会自动预检→签名→支付→返回结果</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-orange-500 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我给 0x2C7c26E395A5861380451CcCFf303F58Feb190D9 支付 0.001 MON，原因是购买 GPT-4 API</code></div>
                  <div className="flex items-start gap-2"><span className="text-orange-500 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我支付 0.01 MON 给 0x2C7c26E395A5861380451CcCFf303F58Feb190D9，租用 GPU 训练模型</code></div>
                  <div className="flex items-start gap-2"><span className="text-orange-500 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">调用付费 API http://localhost:3001/api/gpt4，最多付 0.005 MON</code></div>
                  <div className="text-xs text-gray-600 mt-2 ml-4">流程: 你说话 ⇒ Agent 预检(check_budget) ⇒ Agent 签名支付(pay_with_retry) ⇒ 链上执行 ⇒ 返回 txHash</div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-400 mb-2">要求1: 去中心化 — Agent 只有受限 Session Key</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">查一下金库余额</code></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">查看我的 Agent 配置</code></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">我今天的剩余操作次数和额度是多少</code></div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-400 mb-2">要求2: 安全配置 — 限额/白名单/审批保护</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我检查能不能支付 0.001 MON 给 0x2C7c26E395A5861380451CcCFf303F58Feb190D9</code></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我支付 0.001 MON 给 0x2C7c26E395A5861380451CcCFf303F58Feb190D9，原因是购买 GPT-4 API</code></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">我要支付 0.03 MON 给 0x2C7c26E395A5861380451CcCFf303F58Feb190D9</code><span className="text-xs text-red-400 ml-2">→ 应被拒绝（超单笔限额）</span></div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-400 mb-2">要求3: Agent 原生 — 预检/重试/错误翻译/请求提额</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">支付前帮我预检一下 0.001 MON 能不能付</code><span className="text-xs text-gray-500 ml-2">checkBudget</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我支付 0.001 MON，如果失败自动重试</code><span className="text-xs text-gray-500 ml-2">payWithRetry</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">我要付 0.05 MON</code><span className="text-xs text-red-400 ml-2">→ 错误翻译: SINGLE_LIMIT, suggestion: 请求提额</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">我的额度不够，请求把单笔限额提高到 0.04 MON</code><span className="text-xs text-gray-500 ml-2">requestLimitIncrease</span></div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-400 mb-2">要求4: 可审计 — 策略命中/任务上下文</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">查看支付审计日志</code><span className="text-xs text-gray-500 ml-2">含 policyHit 策略命中</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">查看链上账本记录</code><span className="text-xs text-gray-500 ml-2">含操作者/金额/原因</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">有没有待审批的支付</code><span className="text-xs text-gray-500 ml-2">pending_approvals</span></div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-400 mb-2">要求5: 恢复与权限管理 — Session Key 生命周期</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">我的 Session Key 什么时候过期</code><span className="text-xs text-gray-500 ml-2">get_agent_config</span></div>
                  <div className="text-xs text-gray-500 ml-4">（过期后 Agent 自动失效，需 Owner 在前端重新授权/延长）</div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-yellow-400 mb-2">加分项: x402 机器支付</h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我调用付费 API http://localhost:3001/api/gpt4，最多付 0.005 MON</code><span className="text-xs text-gray-500 ml-2">x402_pay_api</span></div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 shrink-0">▸</span><code className="text-xs text-green-400 bg-gray-900 px-2 py-0.5 rounded break-all">帮我调用付费 API http://localhost:3001/api/weather，最多付 0.002 MON</code><span className="text-xs text-gray-500 ml-2">x402_pay_api</span></div>
                </div>
              </div>
            </div>

            <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-400">
              演示技巧：先在前端开启「需审批」模式 → Agent 支付被挂起 → 前端审批 → Agent 支付成功。展示人机协同闭环。
            </div>
            </>
            )}
          </div>

          {/* 技术栈 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="text-sm font-medium text-cyan-400 mb-3">技术栈</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">Solidity 0.8.28</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">Monad Testnet</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">ethers.js v6</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">TypeScript</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">React + Vite</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">TailwindCSS v4</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">MCP Protocol</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">x402 (HTTP 402)</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">OpenClaw Agent</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">MetaMask</span>
            </div>
          </div>
          </>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-600">
          AgentVault — Monad Blitz @ 杭州 V2 黑客松 · Agent 原生安全支付系统
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, desc, value, color }: { label: string; desc?: string; value: string; color: "green" | "red" | "purple" }) {
  const colors = {
    green: "border-green-800/50 text-green-400",
    red: "border-red-800/50 text-red-400",
    purple: "border-purple-800/50 text-purple-400",
  };
  return (
    <div className={`bg-gray-900 rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {desc && <p className="text-xs text-gray-600 mb-1">{desc}</p>}
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

export default App;
