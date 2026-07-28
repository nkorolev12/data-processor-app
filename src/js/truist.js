// __ Truist Module (v2) __

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
      this.cards.unshift({
        id:        Date.now() + Math.floor(Math.random() * 99999),
        createdAt: new Date().toISOString(),
        raw:       block,
        parsed:    parsed || null,
        proxy:     TruistProxy.generate(state),
        status:    null,
        creds:     null,
      });
      added++;
    }
    if (added > 0) {
      DataStorage.saveTruistCards(this.cards);
      this.renderCards();
      DataUtils.showToast("Добавлено " + added + " Truist фулок");
    }
  },

  /* -- Credential Generation -------------------------------- */

  _genLogin(firstName) {
    const name = (firstName || "user").toLowerCase().replace(/[^a-z]/g, "").slice(0, 6);
    const digits = String(Math.floor(Math.random() * 900) + 100);
    const letter = "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    return name + digits + letter;
  },

  _genPass() {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums  = "0123456789";
    const all   = lower + upper + nums;
    const len   = 8 + Math.floor(Math.random() * 3);
    let p = upper[Math.floor(Math.random() * 26)]
          + lower[Math.floor(Math.random() * 26)]
          + nums[Math.floor(Math.random() * 10)];
    while (p.length < len) p += all[Math.floor(Math.random() * all.length)];
    return p.split("").sort(() => Math.random() - 0.5).join("");
  },

  _ensureCreds(card) {
    if (card.creds) return;
    const fn = card.parsed ? (card.parsed.firstName || "") : "";
    const phone = card.parsed ? (card.parsed.phone || "").replace(/\D/g, "") : "";
    card.creds = {
      api:  { login: this._genLogin(fn), pass: this._genPass(), phone: phone, locked: false },
      log:  { login: this._genLogin(fn), pass: this._genPass(), locked: false },
      an: "",
      rn: "",
    };
  },

  async refreshSection(cardId, section) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.creds || card.creds[section].locked) return;
    const fn = card.parsed ? (card.parsed.firstName || "") : "";
    card.creds[section].login = this._genLogin(fn);
    card.creds[section].pass  = this._genPass();
    await DataStorage.saveTruistCards(this.cards);
    this._updateCardEl(cardId);
  },

  async toggleLock(cardId, section) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.creds) return;
    card.creds[section].locked = !card.creds[section].locked;
    await DataStorage.saveTruistCards(this.cards);
    this._updateCardEl(cardId);
  },

  async saveCredField(cardId, section, field, value) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.creds) return;
    if (section === "anrn") card.creds[field] = value;
    else card.creds[section][field] = value;
    await DataStorage.saveTruistCards(this.cards);
  },

  async savePersonalField(cardId, field, value) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.parsed) return;
    card.parsed[field] = value;
    await DataStorage.saveTruistCards(this.cards);
  },

  /* -- Status ----------------------------------------------- */

  async setStatus(cardId, status) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.status) this._adjustStat(card.status, -1);
    card.status = status;
    if (status) this._adjustStat(status, +1);
    if (status === "done") this._ensureCreds(card);
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
    if (status === "done")     s.done     = Math.max(0, (s.done || 0) + delta);
    if (status === "rejected") s.rejected = Math.max(0, (s.rejected || 0) + delta);
    if (status === "verif")    s.verif    = Math.max(0, (s.verif || 0) + delta);
  },

  /* -- Proxy ------------------------------------------------ */

  async refreshProxy(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    card.proxy = TruistProxy.generate(card.parsed ? (card.parsed.state || "NY") : "NY");
    await DataStorage.saveTruistCards(this.cards);
    this._updateCardEl(cardId);
  },

  /* -- Delete ----------------------------------------------- */

  async deleteCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card && card.status) this._adjustStat(card.status, -1);
    this.cards = this.cards.filter(c => c.id !== cardId);
    await Promise.all([DataStorage.saveTruistCards(this.cards), DataStorage.saveTruistStats(this.stats)]);
    const el = document.getElementById("tc_" + cardId);
    if (el) el.remove();
    this.renderStats();
  },

  /* -- Copy all --------------------------------------------- */

  copyCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card || !card.parsed) { DataUtils.showToast("Нет данных"); return; }
    const p = card.parsed;
    let dob = p.dob || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) { const parts = dob.split("-"); dob = parts[1] + "/" + parts[2] + "/" + parts[0]; }

    let text = [p.firstName || "", p.lastName || ""].join(" ").trim()
      + "|" + (p.address || "")
      + "|" + (p.city    || "")
      + "|" + (p.state   || "")
      + "|" + (p.zip     || "")
      + "|" + (p.ssn     || "")
      + "|" + dob;

    if (card.creds) {
      const c = card.creds;
      text += "\n383api.com|pass|number";
      text += "\n" + (c.api.login || "") + "|" + (c.api.pass || "") + "|" + (c.api.phone || "");
      text += "\n\nlog|pass";
      text += "\n" + (c.log.login || "") + "|" + (c.log.pass || "");
      text += "\n\nAN|RN";
      text += "\n" + (c.an || "") + "|" + (c.rn || "");
    }

    navigator.clipboard.writeText(text).then(() => DataUtils.showToast("Скопировано"));
  },

  /* -- Stats ------------------------------------------------ */

  renderStats() {
    const s = this.stats[DataUtils.getTodayDate()] || { done: 0, rejected: 0, verif: 0 };
    const byId = function(id) { return document.getElementById(id); };
    if (byId("truist-kpi-done"))     byId("truist-kpi-done").textContent     = s.done || 0;
    if (byId("truist-kpi-rejected")) byId("truist-kpi-rejected").textContent = (s.rejected || 0) + (s.verif || 0);
    if (byId("truist-kpi-verif"))    byId("truist-kpi-verif").textContent    = s.verif || 0;
  },

  /* -- Render ----------------------------------------------- */

  renderCards() {
    const container = document.getElementById("truist-cards-container");
    if (!container) return;
    container.innerHTML = "";
    if (!this.cards.length) {
      container.innerHTML = "<div class=\"truist-empty\">Нет Truist фулок. Добавьте блоки выше.</div>";
      return;
    }
    const frag = document.createDocumentFragment();
    this.cards.forEach(c => frag.appendChild(this._buildCard(c)));
    container.appendChild(frag);
  },

  _updateCardEl(cardId) {
    const old  = document.getElementById("tc_" + cardId);
    const card = this.cards.find(c => c.id === cardId);
    if (old && card) old.parentNode.replaceChild(this._buildCard(card), old);
  },

  /* -- Build Card ------------------------------------------- */

  _buildCard(card) {
    const el = document.createElement("div");
    el.className = "truist-card" + (card.status ? " truist-card-" + card.status : "");
    el.id = "tc_" + card.id;
    el.dataset.id = card.id;

    let badgeText = "", badgeClass = "";
    if (card.status === "done")     { badgeClass = "truist-badge-done";     badgeText = "Зарег"; }
    if (card.status === "rejected") { badgeClass = "truist-badge-rejected"; badgeText = "Дек"; }
    if (card.status === "verif")    { badgeClass = "truist-badge-verif";    badgeText = "Вериф (Дек)"; }

    const credsHTML = (card.status === "done" && card.creds) ? this._renderCreds(card) : "";

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
        ? "<button class=\"truist-btn-copy\" data-action=\"copy\" data-id=\"" + card.id + "\">Скопировать всё</button>"
        : "";
      actionsHTML =
        "<div class=\"truist-actions truist-actions-settled\">" +
          copyBtn +
          "<button class=\"truist-btn-reset\" data-action=\"reset\" data-id=\"" + card.id + "\">Сбросить</button>" +
        "</div>";
    }

    el.innerHTML =
      "<div class=\"truist-card-header\">" +
        "<div class=\"truist-card-title\">Truist" +
          (badgeText ? " <span class=\"truist-badge " + badgeClass + "\">" + badgeText + "</span>" : "") +
        "</div>" +
        "<button class=\"truist-btn-delete\" data-action=\"delete\" data-id=\"" + card.id + "\" title=\"Удалить\">Del</button>" +
      "</div>" +
      "<div class=\"truist-proxy-row\">" +
        "<span class=\"truist-proxy-label\">Прокси</span>" +
        "<span class=\"truist-proxy-value\">" + this._esc(card.proxy) + "</span>" +
        "<button class=\"truist-proxy-btn\" data-action=\"copy-proxy\"    data-id=\"" + card.id + "\">Копировать</button>" +
        "<button class=\"truist-proxy-btn\" data-action=\"refresh-proxy\" data-id=\"" + card.id + "\">Обновить</button>" +
      "</div>" +
      this._renderPersonalFields(card) +
      credsHTML +
      actionsHTML;

    this._bindCardEvents(el, card);
    return el;
  },

  _bindCardEvents(el, card) {
    el.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn || e.target.tagName === "INPUT") return;
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);

      if      (action === "done" || action === "rejected" || action === "verif") { await this.setStatus(id, action); }
      else if (action === "reset")               { await this.setStatus(id, null); }
      else if (action === "copy")                { this.copyCard(id); }
      else if (action === "delete")              { await this.deleteCard(id); }
      else if (action === "refresh-proxy")       { await this.refreshProxy(id); }
      else if (action === "copy-proxy") {
        const c = this.cards.find(x => x.id === id);
        if (c) navigator.clipboard.writeText(c.proxy).then(() => DataUtils.showToast("Прокси скопирован"));
      }
      else if (action === "refresh-api")         { await this.refreshSection(id, "api"); }
      else if (action === "refresh-log")         { await this.refreshSection(id, "log"); }
      else if (action === "toggle-api-lock")     { await this.toggleLock(id, "api"); }
      else if (action === "toggle-log-lock")     { await this.toggleLock(id, "log"); }
    });

    el.querySelectorAll(".tfield-input").forEach(inp => {
      inp.addEventListener("change", async () => {
        await this.savePersonalField(Number(inp.dataset.cid), inp.dataset.field, inp.value.trim());
      });
    });

    el.querySelectorAll(".tcred-input[data-cred]").forEach(inp => {
      inp.addEventListener("change", async () => {
        await this.saveCredField(Number(inp.dataset.id), inp.dataset.cred, inp.dataset.field, inp.value.trim());
      });
    });

    el.querySelectorAll(".tcred-input[data-anrn]").forEach(inp => {
      inp.addEventListener("change", async () => {
        await this.saveCredField(Number(inp.dataset.id), "anrn", inp.dataset.anrn, inp.value.trim());
      });
    });
  },

  /* -- Personal Fields -------------------------------------- */

  _renderPersonalFields(card) {
    const f = (key, icon, label, val, ph) => {
      return "<div class=\"tfield\">" +
        "<span class=\"tfield-icon\">" + icon + "</span>" +
        "<span class=\"tfield-label\">" + label + "</span>" +
        "<input class=\"tfield-input\" data-cid=\"" + card.id + "\" data-field=\"" + key + "\" value=\"" + this._esc(val || "") + "\" placeholder=\"" + ph + "\">" +
      "</div>";
    };

    if (!card.parsed) {
      const lines = card.raw.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
      return "<div class=\"truist-lines-block\">" +
        lines.map(l => "<div class=\"truist-line\"><span class=\"truist-line-emoji\">" + this._lineEmoji(l) + "</span> " + this._esc(l) + "</div>").join("") +
        "</div>";
    }

    const p = card.parsed;
    return "<div class=\"truist-fields\">" +
      f("firstName", "👤", "Имя",     p.firstName, "First") +
      f("lastName",  "👤", "Фамилия", p.lastName,  "Last")  +
      f("dob",       "📅", "DOB",     p.dob,       "MM/DD/YYYY") +
      f("ssn",       "🔑", "SSN",     p.ssn,       "XXX-XX-XXXX") +
      f("address",   "🏠", "Адрес",  p.address,   "123 Main St") +
      f("city",      "🏙️", "Город",  p.city,      "City") +
      f("state",     "📍", "Штат",   p.state,     "TX") +
      f("zip",       "📮", "ZIP",    p.zip,        "00000") +
      f("email",     "📧", "Email",  p.email,     "email@...") +
      f("phone",     "📞", "Телефон", p.phone,    "0000000000") +
    "</div>";
  },

  /* -- Credential Sections ---------------------------------- */

  _renderCreds(card) {
    const c   = card.id;
    const cr  = card.creds;
    const apiLocked = cr.api.locked;
    const logLocked = cr.log.locked;

    const inp = (cred, field, val, locked) =>
      "<input class=\"tcred-input" + (locked ? " tcred-locked" : "") + "\" " +
      "data-cred=\"" + cred + "\" data-field=\"" + field + "\" data-id=\"" + c + "\" " +
      "value=\"" + this._esc(val || "") + "\"" + (locked ? " readonly" : "") + ">";

    return (
      "<div class=\"tcred-section\">" +
        "<div class=\"tcred-header\">" +
          "<span class=\"tcred-hdr-label\">383api.com | pass | number</span>" +
          "<div class=\"tcred-ctrls\">" +
            (apiLocked ? "" : "<button class=\"tcred-ctrl-btn\" data-action=\"refresh-api\" data-id=\"" + c + "\">🔄</button>") +
            "<button class=\"tcred-ctrl-btn\" data-action=\"toggle-api-lock\" data-id=\"" + c + "\">" + (apiLocked ? "🔓" : "🔒") + "</button>" +
          "</div>" +
        "</div>" +
        "<div class=\"tcred-row\">" +
          inp("api", "login", cr.api.login, apiLocked) +
          "<span class=\"tcred-sep\">|</span>" +
          inp("api", "pass",  cr.api.pass,  apiLocked) +
          "<span class=\"tcred-sep\">|</span>" +
          inp("api", "phone", cr.api.phone, apiLocked) +
        "</div>" +
      "</div>" +

      "<div class=\"tcred-section\">" +
        "<div class=\"tcred-header\">" +
          "<span class=\"tcred-hdr-label\">log | pass</span>" +
          "<div class=\"tcred-ctrls\">" +
            (logLocked ? "" : "<button class=\"tcred-ctrl-btn\" data-action=\"refresh-log\" data-id=\"" + c + "\">🔄</button>") +
            "<button class=\"tcred-ctrl-btn\" data-action=\"toggle-log-lock\" data-id=\"" + c + "\">" + (logLocked ? "🔓" : "🔒") + "</button>" +
          "</div>" +
        "</div>" +
        "<div class=\"tcred-row\">" +
          inp("log", "login", cr.log.login, logLocked) +
          "<span class=\"tcred-sep\">|</span>" +
          inp("log", "pass",  cr.log.pass,  logLocked) +
        "</div>" +
      "</div>" +

      "<div class=\"tcred-section\">" +
        "<div class=\"tcred-header\"><span class=\"tcred-hdr-label\">AN | RN</span></div>" +
        "<div class=\"tcred-row\">" +
          "<input class=\"tcred-input\" data-anrn=\"an\" data-id=\"" + c + "\" value=\"" + this._esc(cr.an || "") + "\" placeholder=\"AN\">" +
          "<span class=\"tcred-sep\">|</span>" +
          "<input class=\"tcred-input\" data-anrn=\"rn\" data-id=\"" + c + "\" value=\"" + this._esc(cr.rn || "") + "\" placeholder=\"RN\">" +
        "</div>" +
      "</div>"
    );
  },

  /* -- Helpers --------------------------------------------- */

  _lineEmoji(line) {
    if (/^SSN[:\s]/i.test(line))               return "🔑";
    if (/^DOB[:\s]/i.test(line))               return "📅";
    if (line.includes("@"))                     return "📧";
    if (/county/i.test(line))                   return "📍";
    if (/^\(/.test(line))                       return "🕐";
    if (/^[A-Za-z]+ \d{4}$/.test(line))        return "📅";
    if (/^\d+[\w\-]*\s+\S/.test(line))         return "🏠";
    if (/,[A-Z]{2}\s\d{5}/.test(line))         return "🏙️";
    if (/^[A-Z][a-z]+ [A-Z][a-z]/.test(line)) return "👤";
    return "📋";
  },

  _esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  },
};

// __ Truist Proxy __

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
