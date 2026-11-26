(function () {
  const HS = window.HS;
  const textInput = document.getElementById("text-input");
  const fileInput = document.getElementById("file-input");
  const hashOut = document.getElementById("content-hash");
  const labelInput = document.getElementById("label-input");
  const meter = document.getElementById("label-bytes");
  const reviewBtn = document.getElementById("review-btn");
  const reviewPanel = document.getElementById("review-panel");
  const confirmBtn = document.getElementById("confirm-btn");
  const result = document.getElementById("seal-result");
  const fileNote = document.getElementById("file-note");
  const walletStatus = document.getElementById("wallet-status");
  const agentStatus = document.getElementById("agent-status");
  const yours = document.getElementById("your-seals");
  let mode = "text";
  let fileHash = "";
  let fileLabel = "";
  let reviewed = null;

  function activeHash() {
    if (mode === "file") return fileHash;
    if (!textInput) return "";
    return HS.keccakText(textInput.value);
  }

  function activePreimageNote() {
    if (mode === "file") return fileLabel;
    return textInput && textInput.value.length === 0 ? HS.t("emptyText") : "";
  }

  function paintHash() {
    try {
      if (!HS.selfTest()) {
        hashOut.textContent = HS.t("hasherBad");
        return;
      }
      hashOut.textContent = mode === "file" && !fileHash ? "—" : activeHash();
    } catch (err) {
      hashOut.textContent = HS.t("hasherBad");
    }
  }

  function paintMeter() {
    const n = HS.utf8Length(labelInput.value);
    const max = HS.config.maxLabelBytes;
    meter.textContent = n + " / " + max;
    meter.className = "meter" + (n > max ? " warn" : "");
  }

  function invalidate() {
    reviewed = null;
    reviewPanel.classList.add("hidden");
    confirmBtn.classList.add("hidden");
    result.replaceChildren();
  }

  function setTab(next) {
    mode = next;
    document.getElementById("tab-text").setAttribute("aria-selected", String(next === "text"));
    document.getElementById("tab-file").setAttribute("aria-selected", String(next === "file"));
    document.getElementById("pane-text").classList.toggle("hidden", next !== "text");
    document.getElementById("pane-file").classList.toggle("hidden", next !== "file");
    invalidate();
    paintHash();
  }

  async function onFile(event) {
    const file = event.target.files && event.target.files[0];
    fileHash = "";
    fileLabel = "";
    fileNote.textContent = "";
    if (!file) {
      paintHash();
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    fileHash = HS.keccakBytes(bytes);
    fileLabel = file.name + " · " + file.size + " bytes";
    fileNote.textContent = fileLabel + " — " + HS.t("fileLocal");
    invalidate();
    paintHash();
  }

  function showReview() {
    result.replaceChildren();
    if (!HS.selfTest()) {
      result.append(HS.el("p", "notice", HS.t("hasherBad")));
      return;
    }
    const hash = activeHash();
    const label = labelInput.value;
    const bytes = HS.utf8Length(label);
    if (mode === "file" && !fileHash) {
      result.append(HS.el("p", "notice", HS.t("needHash")));
      return;
    }
    if (bytes > HS.config.maxLabelBytes) {
      result.append(HS.el("p", "notice", HS.t("labelLong")));
      return;
    }
    reviewed = { hash: hash, label: label };
    reviewPanel.classList.remove("hidden");
    reviewPanel.replaceChildren();
    const dl = document.createElement("dl");
    dl.className = "pair";
    const rows = [
      ["Hash", hash],
      ["Label", label || "—"],
      ["Bytes", String(bytes) + " / 80"],
      ["Value", "0"],
      ["To", HS.config.contractAddress]
    ];
    rows.forEach(function (row) {
      dl.append(HS.el("dt", "", row[0]), HS.el("dd", "mono", row[1]));
    });
    reviewPanel.append(dl);
    const note = activePreimageNote();
    if (note) reviewPanel.append(HS.el("p", "muted", note));
    reviewPanel.append(HS.el("p", "", HS.t("valueZero")));
    const permanent = document.createElement("p");
    permanent.append(HS.el("span", "en", "The seal is permanent. The label, if you set one, is public. The preimage is not stored."));
    permanent.append(HS.el("span", "zh", "印记不可更改。标签若填写就会公开。原文不会被存上链。"));
    reviewPanel.append(permanent);
    reviewPanel.append(HS.el("p", "muted", HS.t("reviewFirst")));
    confirmBtn.classList.remove("hidden");
  }

  async function confirmSeal() {
    result.replaceChildren();
    if (!reviewed || reviewed.hash !== activeHash() || reviewed.label !== labelInput.value) {
      showReview();
      return;
    }
    confirmBtn.disabled = true;
    try {
      const sent = await HS.send("seal", [reviewed.hash, reviewed.label]);
      const parsed = HS.findEvent(sent.receipt, "Sealed");
      const box = HS.el("div", "card stack");
      box.append(HS.el("p", "", HS.t("sealOk")));
      if (parsed) {
        const id = HS.asString(parsed.args.sealId);
        const link = document.createElement("a");
        link.href = "verify.html?id=" + encodeURIComponent(id);
        link.textContent = "#" + id;
        box.append(link);
        box.append(HS.el("p", "", HS.formatHandle(parsed.args.handle)));
      }
      box.append(HS.el("p", "mono", sent.hash));
      result.append(box);
      await loadYours();
    } catch (error) {
      if (error && error.code === "WRONG_CHAIN") result.append(HS.el("p", "notice", HS.t("switch")));
      else result.append(HS.el("p", "notice", HS.explain(error)));
    } finally {
      confirmBtn.disabled = false;
    }
  }

  async function loadIdentity() {
    walletStatus.textContent = "";
    agentStatus.textContent = "";
    yours.replaceChildren();
    if (!window.ethereum) {
      walletStatus.textContent = HS.t("noWallet");
      walletStatus.className = "notice";
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts || !accounts[0]) {
        walletStatus.textContent = "";
        walletStatus.className = "";
        return;
      }
      walletStatus.className = "status good";
      walletStatus.textContent = HS.t("connected") + " " + HS.shortAddr(accounts[0]);
      const present = await HS.hasCode();
      if (!present) {
        agentStatus.className = "notice";
        agentStatus.textContent = HS.t("notDeployed");
        return;
      }
      const agent = await HS.read("isAgent", [accounts[0]]);
      const handle = await HS.read("agentHandle", [accounts[0]]);
      const yes = Boolean(agent[0]);
      agentStatus.className = "status " + (yes ? "good" : "bad");
      agentStatus.textContent = (yes ? HS.t("agentYes") : HS.t("agentNo")) + (yes ? " · " + HS.formatHandle(handle[0]) : "");
      if (yes) await loadYours(accounts[0]);
    } catch (error) {
      agentStatus.className = "notice";
      agentStatus.textContent = HS.explain(error);
    }
  }

  async function loadYours(account) {
    yours.replaceChildren();
    if (!account) {
      const accounts = window.ethereum ? await window.ethereum.request({ method: "eth_accounts" }) : [];
      account = accounts && accounts[0];
    }
    if (!account) return;
    try {
      const ids = await HS.read("sealsOf", [account]);
      const list = ids[0] || [];
      if (!list.length) {
        yours.append(HS.el("p", "muted", HS.t("yourNone")));
        return;
      }
      for (let i = list.length - 1; i >= 0 && i >= list.length - 8; i--) {
        const id = HS.asString(list[i]);
        const info = await HS.read("getSeal", [id]);
        const seal = info.info || info[0];
        const card = HS.el("article", "list-card");
        const link = document.createElement("a");
        link.href = "verify.html?id=" + encodeURIComponent(id);
        link.textContent = "#" + id + " · " + (seal.label || HS.shortAddr(seal.contentHash));
        card.append(link);
        card.append(HS.el("p", "mono muted", seal.contentHash));
        yours.append(card);
      }
    } catch (error) {
      yours.append(HS.el("p", "notice", HS.explain(error)));
    }
  }

  document.getElementById("tab-text").addEventListener("click", function () { setTab("text"); });
  document.getElementById("tab-file").addEventListener("click", function () { setTab("file"); });
  textInput.addEventListener("input", function () { invalidate(); paintHash(); });
  labelInput.addEventListener("input", function () { invalidate(); paintMeter(); });
  fileInput.addEventListener("change", onFile);
  reviewBtn.addEventListener("click", showReview);
  confirmBtn.addEventListener("click", confirmSeal);
  document.getElementById("connect-btn").addEventListener("click", async function () {
    try {
      await HS.connect();
      await loadIdentity();
    } catch (error) {
      walletStatus.className = "notice";
      walletStatus.textContent = error && error.code === "WRONG_CHAIN" ? HS.t("switch") : HS.explain(error);
    }
  });
  document.getElementById("copy-hash").addEventListener("click", function () {
    const value = hashOut.textContent || "";
    if (value.startsWith("0x")) HS.copyText(value);
  });
  document.addEventListener("handleseal:lang", function () {
    paintMeter();
    if (fileLabel) fileNote.textContent = fileLabel + " — " + HS.t("fileLocal");
    if (reviewed) showReview();
    loadIdentity();
  });

  paintHash();
  paintMeter();
  loadIdentity();
  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("accountsChanged", function () { loadIdentity(); });
    window.ethereum.on("chainChanged", function () { loadIdentity(); });
  }
})();
