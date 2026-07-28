// __ Truist Module __

const TruistApp = {

  cards: [],
  stats: {},

  async init() {
    [this.cards, this.stats] = await Promise.all([
      DataStorage.loadTruistCards(),
      DataStorage.loadTruistStats(),
    ]);
    this._bindInput();
    this.renderCards();
    this.renderStats();
  },

  _bindInput() {
    const btn = document.getElementById("btn-add-truist");
    const ta  = document.getElementById("truist-input");
    if (!btn || !ta) return;
    btn.addEventListener("click", () => {
      const text = ta.value.trim();
      if (!text) return;
      this.addBlocks(text);
      ta.value = "";
    });
  },

  addBlocks(rawText) {
    const blocks = rawText.split(/\n?===+\n?/).map(b => b.trim()).filter(Boolean);
    let added = 0;
    for (const block of blocks) {
      const parsed = DataParser.parseMultilinePersonalBlock(block);
      const state  = parsed ? (parsed.state || "NY") : "NY";
      const card = {
        id:        Date.now() + Math.random(),
        createdAt: new Date().toISOString(),
        raw:       block,
        parsed:    parsed || null,
        proxy:     TruistProxy.generate(state),
        status:    null,
      };
      this.cards.unshift(card);
      added++;
    }
    if (added > 0) {
      DataStorage.saveTruistCards(this.cards);
      this.renderCards();
      DataUtils.showToast("Добавлено " + added + " Truist фулок");
    }
  },

  async setStatus(cardId, status) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.status) this._adjustStat(card.status, -1);
    card.status = status;
    if (status) this._adjustStat(status, +1);
    await Promise.all([
      DataStorage.saveTruistCards(this.cards),
      DataStorage.saveTruistStats(this.stats),
    ]);
    this._updateCardEl(cardId);
    this.renderStats();
  },

  _adjustStat(status, delta) {
    const day = DataUtils.getTodayDate();
    if (!this.stats[day]) this.stats[day] = { done: 0, rejected: 0, verif: 0 };
    const s = this.stats[day];
    if (status === "done")     s.done     = Math.max(0, (s.done     || 0) + delta);
    if (status === "rejected") s.rejected = Math.max(0, (s.rejected || 0) + delta);
    if (status === "verif")    s.verif    = Math.max(0, (s.verif    || 0) + delta);
  },

  async refreshProxy(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    card.proxy = TruistProxy.generate(card.parsed ? (card.parsed.state || "NY") : "NY");
    await DataStorage.saveTruistCards(this.cards);
    this._updateCardEl(cardId);
  },

  async deleteCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card && card.status) this._adjustStat(card.status, -1);
    this.cards = this.cards.filter(c => c.id !== cardId);
    await Promise.all([DataStorage.saveTruistCards(this.cards), DataStorage.saveTruistStats(this.stats)]);
    const el = document.querySelector(".truist-card[data-id='" + cardId + "']");
    if (el) el.remove();
    this.renderStats();
  },

  copyCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.parsed) { DataUtils.showToast("Нет данных для копирования"); return; }
    const p = card.parsed;
    let dob = p.dob || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const [y, m, d] = dob.split("-");
      dob = m + "/" + d + "/" + y;
    }
    const text = (p.firstName + " " + p.lastName).trim() + "|" +
                 (p.address || "") + "|" + (p.city || "") + "|" +
                 (p.state || "") + "|" + (p.zip || "") + "|" +
                 (p.ssn || "") + "|" + dob;
    navigator.clipboard.writeText(text).then(() => DataUtils.showToast("Скопировано"));
  },

  renderStats() {
    const today = DataUtils.getTodayDate();
    const s = this.stats[today] || { done: 0, rejected: 0, verif: 0 };
    const doneEl  = document.getElementById("truist-kpi-done");
    const rejEl   = document.getElementById("truist-kpi-rejected");
    const verifEl = document.getElementById("truist-kpi-verif");
    if (doneEl)  doneEl.textContent  = s.done || 0;
    if (rejEl)   rejEl.textContent   = (s.rejected || 0) + (s.verif || 0);
    if (verifEl) verifEl.textContent = s.verif || 0;
  },

  renderCards() {
    const container = document.getElementById("truist-cards-container");
    if (!container) return;
    container.innerHTML = "";
    if (!this.cards.length) {
      container.innerHTML = "<div class=\"truist-empty\">Нет Truist фулок. Добавьте блоки выше.</div>";
      return;
    }
    const frag = document.createDocumentFragment();
    this.cards.forEach(card => frag.appendChild(this._buildCard(card)));
    container.appendChild(frag);
  },

  _updateCardEl(cardId) {
    const container = document.getElementById("truist-cards-container");
    if (!container) return;
    const oldEl = container.querySelector(".truist-card[data-id='" + cardId + "']");
    const card  = this.cards.find(c => c.id === cardId);
    if (!card || !oldEl) return;
    container.replaceChild(this._buildCard(card), oldEl);
  },

  _buildCard(card) {
    const el = document.createElement("div");
    el.className = "truist-card" + (card.status ? " truist-card-" + card.status : "");
    el.dataset.id = card.id;

    let badgeText = "", badgeClass = "";
    if (card.status === "done")     { badgeClass = "truist-badge-done";     badgeText = "Зарег"; }
    if (card.status === "rejected") { badgeClass = "truist-badge-rejected"; badgeText = "Дек"; }
    if (card.status === "verif")    { badgeClass = "truist-badge-verif";    badgeText = "Вериф (Дек)"; }

    const rawLines = card.raw.split("\n").map(l => l.trim()).filter(Boolean);
    const linesHTML = rawLines.map(l =>
      "<div class=\"truist-line\"><span class=\"truist-line-emoji\">" + this._lineEmoji(l) + "</span> " + this._esc(l) + "</div>"
    ).join("");

    let actionsHTML = "";
    if (!card.status) {
      actionsHTML =
        "<div class=\"truist-actions\">" +
          "<button class=\"truist-btn-status truist-btn-s-done\"     data-action=\"done\"     data-id=\"" + card.id + "\">Зарег</button>" +
          "<button class=\"truist-btn-status truist-btn-s-rejected\" data-action=\"rejected\" data-id=\"" + card.id + "\">Дек</button>" +
          "<button class=\"truist-btn-status truist-btn-s-verif\"    data-action=\"verif\"    data-id=\"" + card.id + "\">Вериф</button>" +
        "</div>";
    } else {
      const copyBtn = card.status === "done"
        ? "<button class=\"truist-btn-copy\" data-action=\"copy\" data-id=\"" + card.id + "\">Скопировать</button>"
        : "";
      actionsHTML =
        "<div class=\"truist-actions truist-actions-settled\">" +
          copyBtn +
          "<button class=\"truist-btn-reset\" data-action=\"reset\" data-id=\"" + card.id + "\">Сбросить</button>" +
        "</div>";
    }

    el.innerHTML =
      "<div class=\"truist-card-header\">" +
        "<div class=\"truist-card-title\">" +
          "🏦 Truist" +
          (badgeText ? " <span class=\"truist-badge " + badgeClass + "\">" + badgeText + "</span>" : "") +
        "</div>" +
        "<button class=\"truist-btn-delete\" data-action=\"delete\" data-id=\"" + card.id + "\" title=\"Удалить\">🗑️</button>" +
      "</div>" +
      "<div class=\"truist-proxy-row\">" +
        "<span class=\"truist-proxy-label\">🌐 Прокси</span>" +
        "<span class=\"truist-proxy-value\">" + this._esc(card.proxy) + "</span>" +
        "<button class=\"truist-proxy-btn\" data-action=\"copy-proxy\"    data-id=\"" + card.id + "\" title=\"Скопировать\">📋</button>" +
        "<button class=\"truist-proxy-btn\" data-action=\"refresh-proxy\" data-id=\"" + card.id + "\" title=\"Обновить\">🔄</button>" +
      "</div>" +
      "<div class=\"truist-lines-block\">" + linesHTML + "</div>" +
      actionsHTML;

    el.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = parseFloat(btn.dataset.id);
      if      (action === "done" || action === "rejected" || action === "verif") { await this.setStatus(id, action); }
      else if (action === "reset")         { await this.setStatus(id, null); }
      else if (action === "copy")          { this.copyCard(id); }
      else if (action === "delete")        { await this.deleteCard(id); }
      else if (action === "refresh-proxy") { await this.refreshProxy(id); }
      else if (action === "copy-proxy")    {
        const c = this.cards.find(x => x.id === id);
        if (c) navigator.clipboard.writeText(c.proxy).then(() => DataUtils.showToast("Прокси скопирован"));
      }
    });

    return el;
  },

  _lineEmoji(line) {
    if (/^SSN[:\s]/i.test(line))                return "🔑";
    if (/^DOB[:\s]/i.test(line))                return "📅";
    if (line.includes("@"))                      return "📧";
    if (/county/i.test(line))                    return "📍";
    if (/^\(/.test(line))                        return "🕐";
    if (/^[A-Za-z]+ \d{4}$/.test(line))         return "📅";
    if (/^\d+[\w\-]*\s+\S/.test(line))          return "🏠";
    if (/,[A-Z]{2}\s\d{5}/.test(line))          return "🏙️";
    if (/^[A-Z][a-z]+ [A-Z][a-z]/.test(line))  return "👤";
    if (/^\d{7,}$/.test(line.replace(/\D/g,""))) return "📞";
    return "📋";
  },

  _esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
};

// __ Truist Proxy Generator __

const TruistProxy = {
  STATE_MAP: {
    "AK":"alaska","AL":"alabama","AR":"arkansas","AZ":"arizona","CA":"california",
    "CO":"colorado","CT":"connecticut","DC":"washingtondc","DE":"delaware","FL":"florida",
    "GA":"georgia","HI":"hawaii","ID":"idaho","IL":"illinois","IN":"indiana","IA":"iowa",
    "KS":"kansas","KY":"kentucky","LA":"louisiana","MA":"massachusetts","MD":"maryland",
    "ME":"maine","MI":"michigan","MN":"minnesota","MO":"missouri","MS":"mississippi",
    "MT":"montana","NC":"northcarolina","ND":"northdakota","NE":"nebraska","NH":"newhampshire",
    "NJ":"newjersey","NM":"newmexico","NV":"nevada","NY":"newyork","OH":"ohio",
    "OK":"oklahoma","OR":"oregon","PA":"pennsylvania","RI":"rhodeisland","SC":"southcarolina",
    "SD":"southdakota","TN":"tennessee","TX":"texas","UT":"utah","VA":"virginia",
    "VT":"vermont","WA":"washington","WI":"wisconsin","WV":"westvirginia","WY":"wyoming"
  },
  _sid(len) {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  },
  generate(stateCode) {
    const state = this.STATE_MAP[(stateCode || "NY").toUpperCase()] || "newyork";
    return "proxy.psbproxy.io:12321:d848096630c24e71811fe26e7257cc:Opad42F6YHGJVmRU_country-us_state-" + state + "_session-" + this._sid(10) + "_lifetime-30m";
  },
};
