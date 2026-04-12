// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * AgentVault — Monad 链上 Agent 原生安全支付系统
 * 
 * 核心理念：用户通过私钥控制资金，Agent 通过受限的 Session Key 操作支付
 * 
 * 规则：
 * - 每个 Agent 差异化配置：单笔上限、日消费上限、是否需审批、是否启用白名单
 * - 全局单笔上限 1 MON
 * - 每人每天操作次数限制（存/取/花各10次）
 * - 白名单：启用后只能向白名单地址支付
 * - 审批：需审批的 Agent 支付时先挂起，Owner 批准后才执行
 * - 所有操作记入账本，链上可查
 */
contract AgentVault {
    // ============ 数据结构 ============

    /// @notice Agent 的配置信息——差异化受限副卡
    struct AgentConfig {
        uint256 singleLimit;        // 个人单笔上限（wei）
        uint256 dailySpendLimit;    // 个人每日消费上限（wei）
        uint256 spentToday;         // 今日已消费金额（wei）
        uint256 expiry;             // Session Key 过期时间戳
        bool active;                // Agent 是否已被授权
        bool requireApproval;       // 是否每笔支付都需要人工审批
        bool whitelistEnabled;      // 是否启用白名单
        uint256 lastResetDay;       // 上次重置日期
        uint256 depositCountToday;  // 今日存入次数
        uint256 withdrawCountToday; // 今日取出次数
        uint256 payCountToday;      // 今日支付次数
    }

    /// @notice 账本条目——记录每一笔操作
    struct LedgerEntry {
        address operator;     // 操作者地址
        string opType;        // 操作类型："deposit" / "withdraw" / "pay" / "approve"
        uint256 amount;       // 金额
        address counterparty; // 对手方
        string reason;        // 原因
        uint256 timestamp;    // 时间戳
    }

    /// @notice 待审批的支付请求
    struct PendingPayment {
        address agent;        // 发起支付的 Agent
        address recipient;    // 收款方
        uint256 amount;       // 支付金额
        string reason;        // 支付原因
        string taskId;        // 任务 ID
        string agentId;       // Agent 标识
        bool approved;        // 是否已批准
        bool exists;          // 记录是否存在
    }

    // ============ 状态变量 ============

    address public owner;              // 合约拥有者（管理员）
    bool public paused;                // 紧急暂停开关
    uint256 public maxSingleLimit;     // 全局单笔上限（1 MON）
    uint256 public maxDailyOps;        // 每人每天每种操作最大次数

    mapping(address => AgentConfig) public agents;                          // agent → 配置
    mapping(address => mapping(address => bool)) public whitelist;          // agent → 收款方 → 是否允许
    LedgerEntry[] public ledger;                                            // 账本
    uint256 public ledgerCount;                                             // 账本条目总数
    mapping(uint256 => PendingPayment) public pendingPayments;              // 支付ID → 待审批支付
    uint256 public pendingPaymentCount;                                     // 待审批计数器

    // ============ 事件 ============

    event Deposited(address indexed user, uint256 amount);
    event AgentAuthorized(address indexed agent, uint256 singleLimit, uint256 dailySpendLimit, uint256 expiry, bool requireApproval, bool whitelistEnabled);
    event AgentRevoked(address indexed agent);
    event AgentConfigUpdated(address indexed agent, uint256 singleLimit, uint256 dailySpendLimit, uint256 expiry);
    event AgentPayment(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        string reason,
        string taskId,
        string agentId,
        uint256 timestamp,
        bool autoApproved,
        string policyHit
    );
    event PaymentPendingApproval(uint256 indexed paymentId, address agent, address recipient, uint256 amount);
    event PaymentApproved(uint256 indexed paymentId, address approvedBy);
    event PaymentRejectedByHuman(uint256 indexed paymentId, address rejectedBy);
    event Withdrawn(address indexed user, uint256 amount);
    event EmergencyPaused(address by);
    event EmergencyUnpaused(address by);
    event WhitelistAdded(address indexed agent, address recipient);
    event WhitelistRemoved(address indexed agent, address recipient);
    event LedgerEntryAdded(uint256 indexed index, address operator, string opType, uint256 amount);

    // ============ 修饰符 ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier onlyActiveAgent() {
        AgentConfig storage config = agents[msg.sender];
        require(config.active, "Agent not authorized");
        require(block.timestamp <= config.expiry, "Session key expired");
        _;
    }

    // ============ 构造函数 ============

    constructor() {
        owner = msg.sender;
        paused = false;
        maxSingleLimit = 1 * 10 ** 18;   // 1 MON
        maxDailyOps = 10;                 // 每天10次
    }

    // ============ 接收 MON ============

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
        _addLedger(msg.sender, "deposit", msg.value, address(0), "");
    }

    // ============ 存取款函数 ============

    /// @notice 任何人都可以存钱进合约
    function deposit() external payable notPaused {
        require(msg.value > 0, "Must deposit something");
        require(msg.value <= maxSingleLimit, "Exceeds single limit");

        if (agents[msg.sender].active) {
            _resetDailyIfNeeded(msg.sender);
            require(agents[msg.sender].depositCountToday < maxDailyOps, "Daily deposit limit reached");
            agents[msg.sender].depositCountToday++;
        }

        emit Deposited(msg.sender, msg.value);
        _addLedger(msg.sender, "deposit", msg.value, address(0), "");
    }

    /// @notice 管理员可以提取任意金额
    function withdraw(uint256 amount) external onlyOwner notPaused {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(owner, amount);
        _addLedger(owner, "withdraw", amount, owner, "");
    }

    /// @notice Agent 从合约取钱到自己的钱包
    function agentWithdraw(uint256 amount) external onlyActiveAgent notPaused {
        AgentConfig storage config = agents[msg.sender];
        require(amount <= config.singleLimit, "Exceeds personal single limit");
        require(amount <= maxSingleLimit, "Exceeds global single limit");
        require(amount <= address(this).balance, "Insufficient balance");

        _resetDailyIfNeeded(msg.sender);
        require(config.withdrawCountToday < maxDailyOps, "Daily withdraw limit reached");
        config.withdrawCountToday++;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
        _addLedger(msg.sender, "withdraw", amount, msg.sender, "");
    }

    // ============ Agent 管理函数 ============

    /// @notice 管理员授权一个 Agent（差异化配置）
    function authorizeAgent(
        address agent,
        uint256 _singleLimit,
        uint256 _dailySpendLimit,
        uint256 _expiry,
        bool _requireApproval,
        bool _whitelistEnabled
    ) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        require(_expiry > block.timestamp, "Expiry must be in the future");
        require(_singleLimit <= maxSingleLimit, "Single limit exceeds global max");
        require(_singleLimit <= _dailySpendLimit, "Single limit cannot exceed daily spend limit");

        agents[agent] = AgentConfig({
            singleLimit: _singleLimit,
            dailySpendLimit: _dailySpendLimit,
            spentToday: 0,
            expiry: _expiry,
            active: true,
            requireApproval: _requireApproval,
            whitelistEnabled: _whitelistEnabled,
            lastResetDay: block.timestamp / 1 days,
            depositCountToday: 0,
            withdrawCountToday: 0,
            payCountToday: 0
        });

        emit AgentAuthorized(agent, _singleLimit, _dailySpendLimit, _expiry, _requireApproval, _whitelistEnabled);
    }

    /// @notice 管理员撤销 Agent
    function revokeAgent(address agent) external onlyOwner {
        require(agents[agent].active, "Agent not active");
        agents[agent].active = false;
        emit AgentRevoked(agent);
    }

    /// @notice 管理员更新 Agent 配置
    function updateAgentConfig(
        address agent,
        uint256 _singleLimit,
        uint256 _dailySpendLimit,
        uint256 _expiry,
        bool _requireApproval,
        bool _whitelistEnabled
    ) external onlyOwner {
        require(agents[agent].active, "Agent not active");
        require(_expiry > block.timestamp, "Expiry must be in the future");
        require(_singleLimit <= maxSingleLimit, "Single limit exceeds global max");
        require(_singleLimit <= _dailySpendLimit, "Single limit cannot exceed daily spend limit");

        AgentConfig storage config = agents[agent];
        config.singleLimit = _singleLimit;
        config.dailySpendLimit = _dailySpendLimit;
        // Cap spentToday to prevent underflow in getAgentDailyOps when reducing limits
        if (config.spentToday > _dailySpendLimit) {
            config.spentToday = _dailySpendLimit;
        }
        config.expiry = _expiry;
        config.requireApproval = _requireApproval;
        config.whitelistEnabled = _whitelistEnabled;

        emit AgentConfigUpdated(agent, _singleLimit, _dailySpendLimit, _expiry);
    }

    /// @notice 管理员更新 Agent 过期时间（简化版）
    function updateAgentExpiry(address agent, uint256 _expiry) external onlyOwner {
        require(agents[agent].active, "Agent not active");
        require(_expiry > block.timestamp, "Expiry must be in the future");
        agents[agent].expiry = _expiry;
    }

    // ============ 白名单管理 ============

    /// @notice 管理员添加白名单地址
    function addWhitelist(address agent, address recipient) external onlyOwner {
        whitelist[agent][recipient] = true;
        emit WhitelistAdded(agent, recipient);
    }

    /// @notice 管理员移除白名单地址
    function removeWhitelist(address agent, address recipient) external onlyOwner {
        whitelist[agent][recipient] = false;
        emit WhitelistRemoved(agent, recipient);
    }

    // ============ Agent 支付函数 ============

    /// @notice Agent 发起支付——核心函数
    function agentPay(
        address recipient,
        uint256 amount,
        string calldata reason,
        string calldata taskId,
        string calldata agentId
    ) external onlyActiveAgent notPaused {
        AgentConfig storage config = agents[msg.sender];

        require(amount <= config.singleLimit, "Exceeds personal single limit");
        require(amount <= maxSingleLimit, "Exceeds global single limit");
        require(amount <= address(this).balance, "Insufficient balance");

        _resetDailyIfNeeded(msg.sender);
        require(config.payCountToday < maxDailyOps, "Daily pay limit reached");
        require(config.spentToday + amount <= config.dailySpendLimit, "Exceeds daily spend limit");

        // 白名单检查
        string memory policy = "auto_approved";
        if (config.whitelistEnabled) {
            require(whitelist[msg.sender][recipient], "Recipient not in whitelist");
            policy = "whitelist_checked";
        }

        // 审批检查
        if (config.requireApproval) {
            uint256 paymentId = pendingPaymentCount++;
            pendingPayments[paymentId] = PendingPayment({
                agent: msg.sender,
                recipient: recipient,
                amount: amount,
                reason: reason,
                taskId: taskId,
                agentId: agentId,
                approved: false,
                exists: true
            });
            emit PaymentPendingApproval(paymentId, msg.sender, recipient, amount);
            return;
        }

        // 直接执行支付
        config.payCountToday++;
        config.spentToday += amount;

        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Transfer failed");

        emit AgentPayment(msg.sender, recipient, amount, reason, taskId, agentId, block.timestamp, true, policy);
        _addLedger(msg.sender, "pay", amount, recipient, reason);
    }

    /// @notice 管理员批准一笔待审批支付
    function approvePayment(uint256 paymentId) external onlyOwner notPaused {
        PendingPayment storage payment = pendingPayments[paymentId];
        require(payment.exists, "Payment does not exist");
        require(!payment.approved, "Already approved");

        payment.approved = true;

        AgentConfig storage config = agents[payment.agent];
        _resetDailyIfNeeded(payment.agent);
        config.payCountToday++;
        config.spentToday += payment.amount;

        require(payment.amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = payable(payment.recipient).call{value: payment.amount}("");
        require(success, "Transfer failed");

        emit AgentPayment(payment.agent, payment.recipient, payment.amount, payment.reason, payment.taskId, payment.agentId, block.timestamp, false, "human_approved");
        emit PaymentApproved(paymentId, msg.sender);
        _addLedger(payment.agent, "approve", payment.amount, payment.recipient, payment.reason);

        delete pendingPayments[paymentId];
    }

    /// @notice 管理员拒绝一笔待审批支付
    function rejectPayment(uint256 paymentId) external onlyOwner {
        PendingPayment storage payment = pendingPayments[paymentId];
        require(payment.exists, "Payment does not exist");
        require(!payment.approved, "Already approved");

        emit PaymentRejectedByHuman(paymentId, msg.sender);
        delete pendingPayments[paymentId];
    }

    // ============ 紧急操作 ============

    function emergencyPause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }

    // ============ 管理员设置 ============

    function setMaxSingleLimit(uint256 _maxSingleLimit) external onlyOwner {
        maxSingleLimit = _maxSingleLimit;
    }

    function setMaxDailyOps(uint256 _maxDailyOps) external onlyOwner {
        maxDailyOps = _maxDailyOps;
    }

    // ============ 查询函数 ============

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isAgentActive(address agent) external view returns (bool) {
        AgentConfig storage config = agents[agent];
        return config.active && block.timestamp <= config.expiry;
    }

    /// @notice 查询 Agent 完整配置
    function getAgentConfig(address agent) external view returns (
        uint256 singleLimit,
        uint256 dailySpendLimit,
        uint256 spentToday,
        uint256 expiry,
        bool active,
        bool requireApproval,
        bool whitelistEnabled
    ) {
        AgentConfig storage config = agents[agent];
        return (config.singleLimit, config.dailySpendLimit, config.spentToday, config.expiry, config.active, config.requireApproval, config.whitelistEnabled);
    }

    /// @notice 查询 Agent 今日剩余操作次数和消费额度
    function getAgentDailyOps(address agent) external view returns (
        uint256 depositsLeft,
        uint256 withdrawsLeft,
        uint256 paysLeft,
        uint256 spendLeft
    ) {
        AgentConfig storage config = agents[agent];
        uint256 today = block.timestamp / 1 days;
        uint256 dep = config.lastResetDay < today ? 0 : config.depositCountToday;
        uint256 wit = config.lastResetDay < today ? 0 : config.withdrawCountToday;
        uint256 pay = config.lastResetDay < today ? 0 : config.payCountToday;
        uint256 spent = config.lastResetDay < today ? 0 : config.spentToday;
        uint256 _spendLeft = spent > config.dailySpendLimit ? 0 : config.dailySpendLimit - spent;
        return (maxDailyOps - dep, maxDailyOps - wit, maxDailyOps - pay, _spendLeft);
    }

    /// @notice 查询账本条目
    function getLedgerEntry(uint256 index) external view returns (
        address operator,
        string memory opType,
        uint256 amount,
        address counterparty,
        string memory reason,
        uint256 timestamp
    ) {
        require(index < ledger.length, "Index out of bounds");
        LedgerEntry storage entry = ledger[index];
        return (entry.operator, entry.opType, entry.amount, entry.counterparty, entry.reason, entry.timestamp);
    }

    /// @notice 查询账本总条数
    function getLedgerCount() external view returns (uint256) {
        return ledger.length;
    }

    // ============ 内部函数 ============

    /// @notice 如果跨天了，重置今日操作计数和消费金额
    function _resetDailyIfNeeded(address agent) internal {
        uint256 today = block.timestamp / 1 days;
        if (agents[agent].lastResetDay < today) {
            agents[agent].depositCountToday = 0;
            agents[agent].withdrawCountToday = 0;
            agents[agent].payCountToday = 0;
            agents[agent].spentToday = 0;
            agents[agent].lastResetDay = today;
        }
    }

    /// @notice 添加账本条目
    function _addLedger(address operator, string memory opType, uint256 amount, address counterparty, string memory reason) internal {
        ledger.push(LedgerEntry({
            operator: operator,
            opType: opType,
            amount: amount,
            counterparty: counterparty,
            reason: reason,
            timestamp: block.timestamp
        }));
        ledgerCount++;
        emit LedgerEntryAdded(ledger.length - 1, operator, opType, amount);
    }
}
