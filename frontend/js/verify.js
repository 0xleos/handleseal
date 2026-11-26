(function () {
  const HS = window.HS;
  const form = document.getElementById("verify-form");
  const idInput = document.getElementById("seal-id");
  const hashInput = document.getElementById("content-lookup");
  const out = document.getElementById("verify-out");
  const localText = document.getElementById("preimage-text");
  const localFile = document.getElementById("preimage-file");
  const localOut = document.getElementById("preimage-out");
  let currentHash = "";
  let lookupGen = 0;

  function params() {
    return new URLSearchParams(location.search);
  }

  function appendWitnesses(card, list) {
    if (!list.length) return;
    const ul = document.createElement("ul");
    list.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = HS.formatHandle(item.handle) + " · " + item.witness + " · " + HS.formatTime(item.witnessedAt);
      ul.append(li);
    });
    const actions = card.querySelector(".btn-row");
    card.insertBefore(ul, actions);
  }

  async function showSeal(id, gen) {
    const info = await HS.read("getSeal", [id]);
    if (gen !== lookupGen) return;
    const seal = info.info || info[0];
    currentHash = seal.contentHash;
    const card = HS.el("article", "card stack");
    card.append(HS.el("h2", "", "#" + id));
    const dl = document.createElement("dl");
    dl.className = "pair";
    const rows = [
      ["Handle", HS.formatHandle(seal.handle)],
      ["Sealer", seal.sealer],
      ["Token", HS.asString(seal.tokenId)],
      ["Hash", seal.contentHash],
      ["Label", seal.label || "—"],
      ["Time", HS.formatTime(seal.sealedAt)],
      ["Witnesses", HS.asString(seal.witnessCount)]
    ];
    rows.forEach(function (row) {
      dl.append(HS.el("dt", "", row[0]), HS.el("dd", row[0] === "Label" ? "" : "mono", row[1]));
    });
    card.append(dl);
    const actions = HS.el("div", "btn-row");
    const witnessBtn = HS.el("button", "btn", "");
    witnessBtn.type = "button";
    witnessBtn.append(HS.el("span", "en", "Review witness"));
    witnessBtn.append(HS.el("span", "zh", "核对见证"));
    witnessBtn.addEventListener("click", function () { reviewWitness(id, card); });
    actions.append(witnessBtn);
    card.append(actions);
    out.append(card);
    Array.from(out.children).forEach(function (child) {
      if (child !== card && child.classList.contains("notice")) child.remove();
    });
    compareLocal();
    try {
      const witnesses = await HS.read("witnessesOf", [id]);
      if (gen !== lookupGen) return;
      appendWitnesses(card, witnesses[0] || []);
    } catch (error) {
      if (gen !== lookupGen) return;
      card.insertBefore(HS.el("p", "muted", HS.t("witnessUnread")), actions);
    }
  }

  function reviewWitness(id, card) {
    const existing = card.querySelector(".witness-review");
    if (existing) existing.remove();
    const panel = HS.el("div", "notice witness-review stack");
    panel.append(HS.el("p", "", "#" + id));
    const line = document.createElement("p");
    line.append(HS.el("span", "en", "Witnessing is permanent, once per address, and you cannot witness your own seal. Value is 0."));
    line.append(HS.el("span", "zh", "见证不可更改，每个地址只能见证一次，也不能见证自己的印。金额为 0。"));
    panel.append(line);
    panel.append(HS.el("p", "muted", HS.t("valueZero")));
    const confirm = HS.el("button", "btn", "");
    confirm.type = "button";
    confirm.append(HS.el("span", "en", "Confirm and witness"));
    confirm.append(HS.el("span", "zh", "确认并见证"));
    confirm.addEventListener("click", async function () {
      confirm.disabled = true;
      try {
        const sent = await HS.send("witness", [id]);
        panel.append(HS.el("p", "", HS.t("witnessOk")));
        panel.append(HS.el("p", "mono", sent.hash));
      } catch (error) {
        panel.append(HS.el("p", "", error && error.code === "WRONG_CHAIN" ? HS.t("switch") : HS.explain(error)));
        confirm.disabled = false;
      }
    });
    panel.append(confirm);
    card.append(panel);
  }

  function showNotice(text) {
    out.replaceChildren(HS.el("p", "notice", text));
  }

  async function lookup() {
    const gen = ++lookupGen;
    out.replaceChildren();
    currentHash = "";
    localOut.textContent = "";
    const id = idInput.value.trim();
    const hash = hashInput.value.trim();
    if (!id && !hash) return;
    showNotice(HS.t("lookingUp"));
    try {
      const present = await HS.hasCode();
      if (gen !== lookupGen) return;
      if (!present) {
        showNotice(HS.t("notDeployed"));
        return;
      }
      if (id) {
        if (!/^\d+$/.test(id) || id === "0") {
          showNotice(HS.t("unknown"));
          return;
        }
        await showSeal(id, gen);
        return;
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        showNotice(HS.t("genericFail"));
        return;
      }
      const found = await HS.read("sealsByHash", [hash]);
      if (gen !== lookupGen) return;
      const ids = Array.from(found[0] || []);
      if (!ids.length) {
        showNotice(HS.t("unknown"));
        return;
      }
      out.replaceChildren();
      for (const item of ids) {
        if (gen !== lookupGen) return;
        await showSeal(HS.asString(item), gen);
      }
    } catch (error) {
      if (gen !== lookupGen) return;
      showNotice(HS.explain(error));
    }
  }

  async function compareLocal() {
    if (!currentHash) {
      localOut.textContent = "";
      return;
    }
    const file = localFile.files && localFile.files[0];
    if (!file && localText.value.length === 0) {
      localOut.textContent = "";
      return;
    }
    let hash = "";
    if (file) {
      hash = HS.keccakBytes(new Uint8Array(await file.arrayBuffer()));
    } else {
      hash = HS.keccakText(localText.value);
    }
    const match = hash.toLowerCase() === currentHash.toLowerCase();
    const note = file ? file.name + " — " + HS.t("fileLocal") + " " : "";
    localOut.textContent = note + (match ? HS.t("preimageYes") : HS.t("preimageNo")) + " " + hash;
    localOut.className = match ? "hash-box status good" : "hash-box";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (idInput.value.trim()) query.set("id", idInput.value.trim());
    else if (hashInput.value.trim()) query.set("hash", hashInput.value.trim());
    history.replaceState(null, "", query.toString() ? "?" + query.toString() : "verify.html");
    lookup();
  });
  localText.addEventListener("input", function () {
    if (localFile.value) localFile.value = "";
    compareLocal();
  });
  localFile.addEventListener("change", function () {
    compareLocal();
  });
  document.addEventListener("handleseal:lang", function () {
    if (out.childElementCount) lookup();
  });

  const initial = params();
  if (initial.get("id")) idInput.value = initial.get("id");
  if (initial.get("hash")) hashInput.value = initial.get("hash");
  if (initial.get("id") || initial.get("hash")) lookup();
})();
