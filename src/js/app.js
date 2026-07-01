// ── Main Application ──────────────────────────────────────────

const App = {
  personalFulls: [],
  businessFulls: [],
  emails: [],
  readyFulls: [],

  /* ── Init ──────────────────────────────────────────────── */

  async init() {
    // Load persisted data
    this.personalFulls = await DataStorage.loadPersonalFulls();
    this.businessFulls = await DataStorage.loadBusinessFulls();
    this.emails        = await DataStorage.loadEmails();
    this.readyFulls    = await DataStorage.loadReadyFulls();

    // Render lists
    this.renderList('personal');
    this.renderList('business');
    this.renderList('email');
    this.renderReadyFulls();

    // Setup event listeners
    this.setupTabs();
    this.setupAddButtons();
    this.setupCreateButton();

    // Init dashboard
    await DashboardManager.init();
  },

  /* ── Tab Navigation ────────────────────────────────────── */

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`page-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'dashboard') DashboardManager.refresh();
      });
    });
  },

  /* ── Add Buttons ───────────────────────────────────────── */

  setupAddButtons() {
    document.getElementById('btn-add-personal').addEventListener('click', () => this.addData('personal'));
    document.getElementById('btn-add-business').addEventListener('click', () => this.addData('business'));
    document.getElementById('btn-add-email').addEventListener('click',    () => this.addData('email'));
  },

  async addData(type) {
    const textarea = document.getElementById(`${type}-input`);
    const raw = textarea.value.trim();
    if (!raw) { DataUtils.showToast('Вставьте данные!'); return; }

    const lines  = raw.split('\n').filter(l => l.trim());
    const parsed = [];

    for (const line of lines) {
      let item = null;
      if (type === 'personal') item = DataParser.parsePersonalFull(line);
      if (type === 'business') item = DataParser.parseBusinessFull(line);
      if (type === 'email')    item = DataParser.parseEmail(line);

      if (item) {
        item.id   = Date.now() + Math.random();
        item.used = false;
        parsed.push(item);
      }
    }

    if (!parsed.length) {
      DataUtils.showToast('Не удалось распознать данные');
      return;
    }

    // Append & save
    if (type === 'personal') { this.personalFulls.push(...parsed); await DataStorage.savePersonalFulls(this.personalFulls); }
    if (type === 'business') { this.businessFulls.push(...parsed); await DataStorage.saveBusinessFulls(this.businessFulls); }
    if (type === 'email')    { this.emails.push(...parsed);        await DataStorage.saveEmails(this.emails); }

    textarea.value = '';
    this.renderList(type);
    DataUtils.showToast(`Добавлено: ${parsed.length} ✓`);
  },

  /* ── Render Column List ────────────────────────────────── */

  renderList(type) {
    const map = {
      personal: { items: this.personalFulls, list: 'personal-list', count: 'personal-count' },
      business: { items: this.businessFulls, list: 'business-list', count: 'business-count' },
      email:    { items: this.emails,        list: 'email-list',    count: 'email-count' }
    };

    const { items, list: listId, count: countId } = map[type];
    const listEl  = document.getElementById(listId);
    const countEl = document.getElementById(countId);
    const unused  = items.filter(i => !i.used).length;

    countEl.textContent = `${unused} / ${items.length}`;
    listEl.innerHTML = '';

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `item-row${item.used ? ' used' : ''}`;
      row.style.animationDelay = `${idx * 0.03}s`;

      let label = '';
      if (type === 'personal') label = `${item.firstName} ${item.lastName} — ${item.state}`;
      if (type === 'business') label = item.companyName || item.raw;
      if (type === 'email')    label = item.email;

      row.innerHTML = `
        <span class="item-number">${idx + 1}</span>
        <span class="item-label" title="${this._esc(item.raw || label)}">${this._esc(label)}</span>
        <span class="item-status">${item.used ? '✓' : ''}</span>
        <button class="btn-remove" title="Удалить">×</button>
      `;

      row.querySelector('.btn-remove').addEventListener('click', e => {
        e.stopPropagation();
        this.removeItem(type, idx);
      });

      listEl.appendChild(row);
    });
  },

  async removeItem(type, index) {
    if (type === 'personal') { this.personalFulls.splice(index, 1); await DataStorage.savePersonalFulls(this.personalFulls); }
    if (type === 'business') { this.businessFulls.splice(index, 1); await DataStorage.saveBusinessFulls(this.businessFulls); }
    if (type === 'email')    { this.emails.splice(index, 1);        await DataStorage.saveEmails(this.emails); }
    this.renderList(type);
  },

  /* ── Create Full ───────────────────────────────────────── */

  setupCreateButton() {
    document.getElementById('btn-create-full').addEventListener('click', () => this.createFull());
  },

  /**
   * Check if an email address matches a person's name.
   * e.g. sonceriatucker@... matches Sonceria Tucker
   */
  _emailMatchesName(emailStr, firstName, lastName) {
    const local = emailStr.split('@')[0].toLowerCase();
    const first = (firstName || '').toLowerCase().replace(/[^a-z]/g, '');
    const last  = (lastName  || '').toLowerCase().replace(/[^a-z]/g, '');
    // Email local part must contain both first name and last name (in any order)
    return local.includes(first) && local.includes(last);
  },

  async createFull() {
    const personal = this.personalFulls.find(p => !p.used);
    const business = this.businessFulls.find(b => !b.used);

    if (!personal) { DataUtils.showToast('Нет свободных персональных фулок!'); return; }
    if (!business) { DataUtils.showToast('Нет свободных бизнес фулок!');       return; }

    // Find a matching email (name must appear in email address)
    const email = this.emails.find(e =>
      !e.used && this._emailMatchesName(e.email, personal.firstName, personal.lastName)
    );

    if (!email) {
      DataUtils.showToast(`Нет почты для ${personal.firstName} ${personal.lastName}! Загрузи именную почту.`);
      return;
    }

    // Mark used
    personal.used = true;
    business.used = true;
    email.used    = true;

    // Generate proxies
    const stateCode  = personal.state;
    const coreProxy  = ProxyGenerator.generateCoreProxy(stateCode);
    const flashProxy = ProxyGenerator.generateFlashProxy(stateCode);

    const readyFull = {
      id:         Date.now(),
      createdAt:  new Date().toISOString(),
      personal:   { ...personal },
      business:   { ...business },
      emailData:  { ...email },
      coreProxy,
      flashProxy,
      status:     null,
      statusDate: null
    };

    this.readyFulls.unshift(readyFull);

    // Persist everything
    await Promise.all([
      DataStorage.savePersonalFulls(this.personalFulls),
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveEmails(this.emails),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    // Re-render
    this.renderList('personal');
    this.renderList('business');
    this.renderList('email');
    this.renderReadyFulls();

    DataUtils.showToast('Фулка создана! ✨');
  },

  /* ── Render Ready Fulls ────────────────────────────────── */

  renderReadyFulls() {
    const container = document.getElementById('ready-fulls-container');
    container.innerHTML = '';

    if (!this.readyFulls.length) {
      container.innerHTML = '<div class="empty-state">Нет готовых фулок. Загрузите данные и нажмите «Создать фулку».</div>';
      return;
    }

    this.readyFulls.forEach((full, i) => {
      container.appendChild(this._buildCard(full, i));
    });
  },

  _buildCard(full, index) {
    const p = full.personal;
    const b = full.business;
    const e = full.emailData;

    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.05}s`;

    // Status badge
    let badgeClass = '', badgeText = 'Новая';
    if (full.status === 'done')     { badgeClass = 'status-done';     badgeText = 'Сделано'; }
    if (full.status === 'pending')  { badgeClass = 'status-pending';  badgeText = 'Пендинг'; }
    if (full.status === 'rejected') { badgeClass = 'status-rejected'; badgeText = 'Отказ'; }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="card-number">#${this.readyFulls.length - index}</span>
          <span class="card-name">${this._esc(p.firstName)} ${this._esc(p.lastName)}</span>
        </div>
        <span class="card-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="card-body">
        <div class="card-data-section">
          <div class="data-line"><span class="data-icon">📅</span> ${this._esc(p.dob)}</div>
          <div class="data-line"><span class="data-icon">🔑</span> ${this._esc(p.ssn)}</div>
          <div class="data-line"><span class="data-icon">👤</span> ${this._esc(p.firstName)} ${this._esc(p.lastName)}</div>
          <div class="data-line"><span class="data-icon">📍</span> ${this._esc(p.address)}, ${this._esc(p.city)}, ${this._esc(p.zip)}, ${this._esc(p.state)}</div>
          <div class="data-line"><span class="data-icon">📧</span> ${this._esc(p.email)}</div>
          <div class="data-line"><span class="data-icon">📞</span> ${this._esc(p.phone)}${p.extra ? ', ' + this._esc(p.extra) : ''}</div>
        </div>
        <div class="card-data-section business-section">
          <div class="data-line"><span class="data-icon">🏢</span> ${this._esc(b.raw)}</div>
          <div class="data-line"><span class="data-icon">📧</span> ${this._esc(e.email)}:${this._esc(e.password)}</div>
        </div>

        <div class="card-proxy-section">
          <div class="proxy-block">
            <div class="proxy-header">
              <span>🌐 Прокси почты</span>
              <div class="proxy-actions">
                <button class="btn-refresh" data-refresh-type="core" title="Обновить прокси">🔄</button>
                <button class="btn-copy" data-proxy-type="core">📋 COPY</button>
              </div>
            </div>
            <div class="proxy-text" data-proxy-value="core">${this._esc(full.coreProxy)}</div>
          </div>
          <div class="proxy-block">
            <div class="proxy-header">
              <span>🌐 Прокси BOA</span>
              <div class="proxy-actions">
                <button class="btn-refresh" data-refresh-type="flash" title="Обновить прокси">🔄</button>
                <button class="btn-copy" data-proxy-type="flash">📋 COPY</button>
              </div>
            </div>
            <div class="proxy-text" data-proxy-value="flash">${this._esc(full.flashProxy)}</div>
          </div>
        </div>

        ${full.status === null ? `
        <div class="card-actions">
          <button class="btn-status btn-done"     data-status="done">✅ Сделано</button>
          <button class="btn-status btn-pending"  data-status="pending">⏳ Пендинг</button>
          <button class="btn-status btn-rejected" data-status="rejected">❌ Отказ</button>
        </div>` : ''}
      </div>
    `;

    // ── Copy button handlers
    card.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const block = btn.closest('.proxy-block');
        const text  = block.querySelector('.proxy-text').textContent;
        DataUtils.copyToClipboard(text);

        // Visual feedback
        btn.classList.add('copied');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = orig; }, 1200);
      });
    });

    // ── Refresh proxy button handlers
    card.querySelectorAll('.btn-refresh').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type  = btn.dataset.refreshType; // 'core' or 'flash'
        const stateCode = full.personal.state;

        // Spin animation
        btn.classList.add('spinning');

        // Generate fresh proxy
        const newProxy = type === 'core'
          ? ProxyGenerator.generateCoreProxy(stateCode)
          : ProxyGenerator.generateFlashProxy(stateCode);

        // Update data model
        if (type === 'core')  full.coreProxy  = newProxy;
        if (type === 'flash') full.flashProxy = newProxy;

        // Update the text in the DOM directly (no full re-render)
        const textEl = btn.closest('.proxy-block').querySelector('.proxy-text');
        textEl.textContent = newProxy;

        // Persist
        await DataStorage.saveReadyFulls(this.readyFulls);

        setTimeout(() => btn.classList.remove('spinning'), 600);
        DataUtils.showToast('Прокси обновлён 🔄');
      });
    });

    // ── Status button handlers
    card.querySelectorAll('.btn-status').forEach(btn => {
      btn.addEventListener('click', () => this.setStatus(full.id, btn.dataset.status));
    });

    return card;
  },

  /* ── Set Status ────────────────────────────────────────── */

  async setStatus(fullId, status) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full || full.status !== null) return;

    full.status     = status;
    full.statusDate = DataUtils.getTodayDate();

    // Update statistics
    const stats = await DataStorage.loadStatistics();
    const today = DataUtils.getTodayDate();

    if (!stats[today]) stats[today] = { total: 0, done: 0, pending: 0, rejected: 0 };
    stats[today].total++;
    if (status === 'done')     stats[today].done++;
    if (status === 'pending')  stats[today].pending++;
    if (status === 'rejected') stats[today].rejected++;

    await Promise.all([
      DataStorage.saveStatistics(stats),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderReadyFulls();

    const labels = { done: 'Сделано ✅', pending: 'Пендинг ⏳', rejected: 'Отказ ❌' };
    DataUtils.showToast(labels[status]);
  },

  /* ── Helpers ───────────────────────────────────────────── */

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
