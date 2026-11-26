(function () {
  const config = window.HANDLESEAL_CONFIG;
  const STR = {
    en: {
      notDeployed: "This predicted address has no code on chain 56 yet. Seals can be read and written after the contract is deployed.",
      rpcFail: "Could not reach a chain 56 node. Check the network and try again.",
      noWallet: "No injected wallet was found. Open this page in a wallet's in-app browser. This site does not show a pairing QR code and never asks for a seed phrase.",
      rejected: "The wallet dismissed the request. Nothing was sent.",
      notAgent: "This account does not currently pass the Agent ID gate, so it cannot seal or witness.",
      emptyHandle: "The registry returned an empty handle for this account.",
      mismatch: "The handle, token id, and owner do not line up. Handleseal will not bind this account.",
      zeroHash: "A content hash of zero is rejected.",
      labelLong: "The label is longer than 80 bytes.",
      unknown: "No seal exists with that id.",
      ownSeal: "You cannot witness your own seal.",
      already: "This account has already witnessed that seal.",
      genericFail: "The call did not complete.",
      timeout: "The transaction was submitted, but a receipt did not arrive in time. Check the hash in a block explorer.",
      hasherOk: "Local hasher matches keccak256.",
      hasherBad: "The local hasher failed its self-test. Sealing is disabled.",
      deployed: "Code is present",
      undeployed: "Not deployed",
      unread: "Chain unread",
      emptyText: "You are sealing the hash of empty text.",
      fileLocal: "This file was hashed in the browser. It was not uploaded.",
      reviewFirst: "Review the terms, then confirm. The wallet will ask again.",
      needHash: "Hash some text or a file first.",
      connected: "Connected",
      agentYes: "Agent ID gate passed",
      agentNo: "No Agent ID on this account",
      switch: "Switch this wallet to chain 56, then try again.",
      preimageYes: "The local hash matches this seal.",
      preimageNo: "The local hash does not match this seal.",
      noLabeled: "No labeled seals were found in the recent block window.",
      yourNone: "This account has not sealed anything yet.",
      sealOk: "Seal recorded.",
      witnessOk: "Witness recorded.",
      valueZero: "Value sent: 0. Handleseal charges no fee. The wallet may still charge a network fee."
    },
    zh: {
      notDeployed: "这个预测地址在链 56 上还没有代码。合约部署之后才能读取和写入印记。",
      rpcFail: "连不上链 56 的节点。请检查网络后再试。",
      noWallet: "没有发现注入的钱包。请在钱包的应用内浏览器中打开本页。本站不显示配对二维码，也绝不会索取助记词。",
      rejected: "钱包取消了请求。没有发送任何交易。",
      notAgent: "这个账户目前通不过 Agent ID 校验，不能盖印或见证。",
      emptyHandle: "注册表给这个账户返回了空名字。",
      mismatch: "名字、token id 和持有人没有对齐。Handleseal 不会绑定这个账户。",
      zeroHash: "内容哈希不能为 0。",
      labelLong: "标签超过 80 字节。",
      unknown: "没有这个编号的印记。",
      ownSeal: "不能见证自己盖的印。",
      already: "这个账户已经见证过这枚印。",
      genericFail: "调用没有完成。",
      timeout: "交易已提交，但还没有等到回执。请到区块浏览器查看这笔交易。",
      hasherOk: "本地哈希与 keccak256 一致。",
      hasherBad: "本地哈希自检失败。已禁止盖印。",
      deployed: "链上已有代码",
      undeployed: "尚未部署",
      unread: "未能读取链上状态",
      emptyText: "你正在给空文本的哈希盖印。",
      fileLocal: "文件只在浏览器里计算哈希，没有上传。",
      reviewFirst: "先核对条款，再确认。钱包还会再问一次。",
      needHash: "请先对文本或文件做哈希。",
      connected: "已连接",
      agentYes: "已通过 Agent ID 校验",
      agentNo: "此账户没有 Agent ID",
      switch: "请把钱包切到链 56 后再试。",
      preimageYes: "本地哈希与这枚印一致。",
      preimageNo: "本地哈希与这枚印不一致。",
      noLabeled: "最近的区块窗口里没有带公开标签的印记。",
      yourNone: "这个账户还没有盖过印。",
      sealOk: "印记已记下。",
      witnessOk: "见证已记下。",
      valueZero: "发送金额为 0。Handleseal 不收费。钱包仍可能收取网络费。"
    }
  };

  const KNOWN = {
    "": "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    abc: "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
  };

  function lang() {
    return document.documentElement.classList.contains("zh") ? "zh" : "en";
  }

  function t(key) {
    return (STR[lang()] && STR[lang()][key]) || STR.en[key] || key;
  }

  function setLang(next) {
    const use = next === "zh" ? "zh" : "en";
    document.documentElement.classList.toggle("zh", use === "zh");
    document.documentElement.lang = use === "zh" ? "zh-Hans" : "en";
    try { localStorage.setItem("handleseal.lang", use); } catch (err) { /* private mode */ }
    document.dispatchEvent(new CustomEvent("handleseal:lang"));
  }

  function initLang() {
    const button = document.getElementById("lang-btn");
    if (!button) return;
    button.addEventListener("click", function () {
      setLang(lang() === "zh" ? "en" : "zh");
    });
  }

  function ethersOk() {
    return Boolean(window.ethers && window.ethers.utils && window.HANDLESEAL_ABI);
  }

  function iface() {
    if (!ethersOk()) throw new Error("HASHER");
    if (!iface._cached) iface._cached = new ethers.utils.Interface(window.HANDLESEAL_ABI);
    return iface._cached;
  }

  function keccakText(value) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
  }

  function keccakBytes(bytes) {
    return ethers.utils.keccak256(bytes);
  }

  function selfTest() {
    if (!ethersOk()) return false;
    return keccakText("") === KNOWN[""] && keccakText("abc") === KNOWN.abc;
  }

  function utf8Length(value) {
    return new TextEncoder().encode(value).length;
  }

  function formatHandle(handle) {
    if (!handle) return "—";
    return handle.endsWith(".ai") ? handle : handle + ".ai";
  }

  function shortAddr(addr) {
    if (!addr || addr.length < 12) return addr || "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function formatTime(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n * 1000).toLocaleString(lang() === "zh" ? "zh-Hans" : "en");
  }

  function asString(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (value.toString) return value.toString();
    return String(value);
  }

  async function rpc(method, params) {
    let last = new Error("RPC");
    for (const url of config.rpcUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const body = await response.json();
        if (body.error) throw new Error(body.error.message || "RPC");
        return body.result;
      } catch (err) {
        last = err;
      }
    }
    throw last;
  }

  async function providerRequest(method, params) {
    if (!window.ethereum || !window.ethereum.request) throw new Error("NO_WALLET");
    return window.ethereum.request({ method: method, params: params });
  }

  async function hasCode() {
    const code = await rpc("eth_getCode", [config.contractAddress, "latest"]);
    return Boolean(code && code !== "0x" && code !== "0x0");
  }

  async function ethCall(data) {
    const tx = { to: config.contractAddress, data: data };
    if (window.ethereum && window.ethereum.request) {
      try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (parseInt(chainId, 16) === config.chainId) {
          return await window.ethereum.request({ method: "eth_call", params: [tx, "latest"] });
        }
      } catch (err) { /* fall through to public RPC */ }
    }
    return rpc("eth_call", [tx, "latest"]);
  }

  async function read(name, args) {
    const data = iface().encodeFunctionData(name, args || []);
    const raw = await ethCall(data);
    if (!raw || raw === "0x") {
      const error = new Error("NO_CODE");
      error.code = "NO_CODE";
      throw error;
    }
    return iface().decodeFunctionResult(name, raw);
  }

  function extractData(error) {
    if (!error) return "";
    if (typeof error.data === "string" && error.data.startsWith("0x")) return error.data;
    if (error.data && typeof error.data.data === "string") return error.data.data;
    if (error.error && typeof error.error.data === "string") return error.error.data;
    const message = String(error.message || "");
    const match = message.match(/0x[0-9a-fA-F]{8,}/);
    return match ? match[0] : "";
  }

  function explain(error) {
    const code = error && (error.code || (error.error && error.error.code));
    if (code === 4001 || code === "ACTION_REJECTED") return t("rejected");
    if (code === "NO_CODE" || (error && error.message === "NO_CODE")) return t("notDeployed");
    if (code === "NO_WALLET" || (error && error.message === "NO_WALLET")) return t("noWallet");
    if (code === "TIMEOUT" || (error && error.message === "TIMEOUT")) return t("timeout");
    if (code === "RPC" || (error && /RPC|Failed to fetch|NetworkError/i.test(String(error.message || "")))) {
      return t("rpcFail");
    }
    const data = extractData(error);
    if (data && ethersOk()) {
      try {
        const parsed = iface().parseError(data);
        const key = {
          NotAgent: "notAgent",
          EmptyHandle: "emptyHandle",
          HandleTokenMismatch: "mismatch",
          ZeroContentHash: "zeroHash",
          LabelTooLong: "labelLong",
          UnknownSeal: "unknown",
          WitnessOwnSeal: "ownSeal",
          AlreadyWitnessed: "already"
        }[parsed.name];
        if (key) return t(key);
      } catch (err) { /* not a known error */ }
    }
    return t("genericFail");
  }

  async function ensureChain() {
    const current = await providerRequest("eth_chainId");
    if (parseInt(current, 16) === config.chainId) return;
    try {
      await providerRequest("wallet_switchEthereumChain", [{ chainId: config.chainIdHex }]);
    } catch (error) {
      if (error && (error.code === 4902 || error.code === -32603)) {
        await providerRequest("wallet_addEthereumChain", [{
          chainId: config.chainIdHex,
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: [config.rpcUrls[0]],
          blockExplorerUrls: ["https://bscscan.com"]
        }]);
        return;
      }
      throw error;
    }
  }

  async function connect() {
    const accounts = await providerRequest("eth_requestAccounts", []);
    if (!accounts || !accounts[0]) throw new Error("NO_WALLET");
    await ensureChain();
    const chainId = await providerRequest("eth_chainId");
    if (parseInt(chainId, 16) !== config.chainId) {
      const error = new Error("WRONG_CHAIN");
      error.code = "WRONG_CHAIN";
      throw error;
    }
    return accounts[0];
  }

  async function send(name, args) {
    const from = await connect();
    const data = iface().encodeFunctionData(name, args);
    const txHash = await providerRequest("eth_sendTransaction", [{
      from: from,
      to: config.contractAddress,
      data: data,
      value: "0x0"
    }]);
    const receipt = await waitReceipt(txHash);
    if (receipt && (receipt.status === "0x0" || receipt.status === 0)) {
      const error = new Error("REVERTED");
      error.receipt = receipt;
      throw error;
    }
    return { hash: txHash, receipt: receipt };
  }

  async function waitReceipt(hash) {
    for (let i = 0; i < 45; i++) {
      const receipt = await providerRequest("eth_getTransactionReceipt", [hash]);
      if (receipt) return receipt;
      await new Promise(function (resolve) { setTimeout(resolve, 2000); });
    }
    const error = new Error("TIMEOUT");
    error.code = "TIMEOUT";
    error.hash = hash;
    throw error;
  }

  function findEvent(receipt, name) {
    if (!receipt || !receipt.logs) return null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface().parseLog(log);
        if (parsed && parsed.name === name) return parsed;
      } catch (err) { /* other contract */ }
    }
    return null;
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  async function paintDeployBadge() {
    const badge = document.getElementById("deploy-badge");
    const link = document.getElementById("contract-link");
    if (link) {
      link.href = "docs.html#bscscan";
      link.textContent = shortAddr(config.contractAddress);
      link.title = config.contractAddress;
    }
    if (!badge) return;
    try {
      const present = await hasCode();
      badge.textContent = present ? t("deployed") : t("undeployed");
      badge.className = "status " + (present ? "good" : "bad");
    } catch (err) {
      badge.textContent = t("unread");
      badge.className = "status";
    }
  }

  document.addEventListener("handleseal:lang", paintDeployBadge);
  initLang();
  paintDeployBadge();

  const status = document.getElementById("hasher-status");
  if (status) {
    const ok = selfTest();
    status.textContent = ok ? t("hasherOk") : t("hasherBad");
    status.className = "status " + (ok ? "good" : "bad");
    document.addEventListener("handleseal:lang", function () {
      status.textContent = selfTest() ? t("hasherOk") : t("hasherBad");
    });
  }

  window.HS = {
    config: config,
    t: t,
    lang: lang,
    setLang: setLang,
    keccakText: keccakText,
    keccakBytes: keccakBytes,
    selfTest: selfTest,
    utf8Length: utf8Length,
    formatHandle: formatHandle,
    shortAddr: shortAddr,
    formatTime: formatTime,
    asString: asString,
    rpc: rpc,
    hasCode: hasCode,
    read: read,
    explain: explain,
    connect: connect,
    send: send,
    findEvent: findEvent,
    copyText: copyText,
    el: el,
    iface: iface
  };
})();
