(function () {
  const HS = window.HS;
  const out = document.getElementById("recent-out");
  const again = document.getElementById("recent-again");

  function hex(n) {
    return "0x" + n.toString(16);
  }

  async function getLogs(fromBlock, toBlock) {
    const topic = HS.iface().getEventTopic("Sealed");
    return HS.rpc("eth_getLogs", [{
      address: HS.config.contractAddress,
      fromBlock: hex(fromBlock),
      toBlock: hex(toBlock),
      topics: [topic]
    }]);
  }

  async function load() {
    out.replaceChildren();
    out.append(HS.el("p", "muted", "…"));
    try {
      const present = await HS.hasCode();
      if (!present) {
        out.replaceChildren(HS.el("p", "notice", HS.t("notDeployed")));
        return;
      }
      const latest = parseInt(await HS.rpc("eth_blockNumber", []), 16);
      const found = [];
      let cursor = latest;
      const windowSize = 4000;
      for (let step = 0; step < 6 && found.length < 24 && cursor > 0; step++) {
        const from = Math.max(0, cursor - windowSize + 1);
        const logs = await getLogs(from, cursor);
        (logs || []).forEach(function (log) {
          try {
            const parsed = HS.iface().parseLog(log);
            if (!parsed || parsed.name !== "Sealed") return;
            if (!parsed.args.label) return;
            found.push(parsed);
          } catch (err) { /* skip undecodable */ }
        });
        cursor = from - 1;
      }
      found.sort(function (a, b) {
        return Number(HS.asString(b.args.sealId)) - Number(HS.asString(a.args.sealId));
      });
      out.replaceChildren();
      if (!found.length) {
        out.append(HS.el("p", "notice", HS.t("noLabeled")));
        return;
      }
      const list = HS.el("div", "card");
      found.slice(0, 24).forEach(function (parsed) {
        const id = HS.asString(parsed.args.sealId);
        const card = HS.el("article", "list-card");
        const title = document.createElement("h3");
        const link = document.createElement("a");
        link.href = "verify.html?id=" + encodeURIComponent(id);
        link.textContent = parsed.args.label;
        title.append(link);
        card.append(title);
        card.append(HS.el("p", "", HS.formatHandle(parsed.args.handle) + " · " + HS.shortAddr(parsed.args.sealer)));
        card.append(HS.el("p", "mono muted", parsed.args.contentHash));
        card.append(HS.el("p", "muted", "#" + id + " · " + HS.formatTime(parsed.args.sealedAt)));
        list.append(card);
      });
      out.append(list);
    } catch (error) {
      out.replaceChildren(HS.el("p", "notice", HS.explain(error)));
    }
  }

  again.addEventListener("click", load);
  document.addEventListener("handleseal:lang", load);
  load();
})();
