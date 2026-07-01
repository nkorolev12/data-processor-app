// ── Main Application ──────────────────────────────────────────

const App = {
  personalFulls: [],
  businessFulls: [],
  readyFulls: [],

  /* ── Init ──────────────────────────────────────────────── */

  async init() {
    this._bindEvents();
    
    // Set version
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionEl = document.getElementById('app-version');
      if (versionEl && version) {
        versionEl.textContent = `v${version}`;
      }
    } catch (e) { console.error('Failed to load version'); }

    // Load data
    this.personalFulls = await DataStorage.loadPersonalFulls();
    this.businessFulls = await DataStorage.loadBusinessFulls();
    this.readyFulls    = await DataStorage.loadReadyFulls();

    this.renderList('personal');
    this.renderList('business');
    this.renderReadyFulls();

    this.setupTabs();
    this.setupAddButtons();
    this.setupCreateButton();
    this.setupManualCreate();

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

    if (type === 'personal') { this.personalFulls.push(...parsed); await DataStorage.savePersonalFulls(this.personalFulls); }
    if (type === 'business') { this.businessFulls.push(...parsed); await DataStorage.saveBusinessFulls(this.businessFulls); }

    textarea.value = '';
    this.renderList(type);
    DataUtils.showToast(`Добавлено: ${parsed.length} ✓`);
  },

  /* ── Render Column List ────────────────────────────────── */

  renderList(type) {
    const map = {
      personal: { items: this.personalFulls, list: 'personal-list', count: 'personal-count' },
      business: { items: this.businessFulls, list: 'business-list', count: 'business-count' },
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
      if (type === 'business') label = (item.companyName || item.raw).replace(/,/g, '');

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
    this.renderList(type);
  },

  /* ── Create Personal Card ──────────────────────────────── */

  setupCreateButton() {
    document.getElementById('btn-create-full').addEventListener('click', () => this.createPersonalCard());
  },

  /* ── Manual Create (Modal) ────────────────────────────── */

  setupManualCreate() {
    const modal   = document.getElementById('modal-manual');
    const openBtn = document.getElementById('btn-create-manual');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('modal-cancel');
    const submitBtn = document.getElementById('modal-submit');

    const open  = () => { modal.style.display = 'flex'; document.getElementById('mf-firstname').focus(); };
    const close = () => { modal.style.display = 'none'; this._clearModal(); };

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    submitBtn.addEventListener('click', () => this.createManualCard());

    // Submit on Ctrl+Enter inside modal
    modal.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) this.createManualCard();
      if (e.key === 'Escape') close();
    });
  },

  _clearModal() {
    ['mf-firstname','mf-lastname','mf-dob','mf-ssn','mf-address','mf-city','mf-zip','mf-state','mf-email','mf-phone']
      .forEach(id => { document.getElementById(id).value = ''; });
  },

  async createManualCard() {
    const get = id => document.getElementById(id).value.trim();
    const firstName = get('mf-firstname');
    const lastName  = get('mf-lastname');
    if (!firstName || !lastName) { DataUtils.showToast('Введите имя и фамилию!'); return; }

    const state = get('mf-state').toUpperCase() || 'TX';

    const personal = {
      id:        Date.now() + Math.random(),
      raw:       '',
      dob:       get('mf-dob'),
      ssn:       get('mf-ssn'),
      firstName,
      lastName,
      address:   get('mf-address'),
      city:      get('mf-city'),
      zip:       get('mf-zip'),
      state,
      email:     get('mf-email'),
      phone:     get('mf-phone'),
      extra:     '',
      used:      true
    };

    const coreProxy  = ProxyGenerator.generateCoreProxy(state);
    const flashProxy = ProxyGenerator.generateFlashProxy(state);

    const readyFull = {
      id:                  Date.now(),
      createdAt:           new Date().toISOString(),
      personal,
      business:            null,
      manualEmail:         '',
      manualEmailPassword: '',
      pendingCode:         '',
      coreProxy,
      flashProxy,
      status:              null,
      statusDate:          null,
      isManual:            true
    };

    this.readyFulls.unshift(readyFull);
    await DataStorage.saveReadyFulls(this.readyFulls);

    document.getElementById('modal-manual').style.display = 'none';
    this._clearModal();
    this.renderReadyFulls();
    DataUtils.showToast('Карточка создана вручную ✨');
  },

  /* ── Delete Card ───────────────────────────────────── */

  async deleteCard(fullId) {
    const idx = this.readyFulls.findIndex(f => f.id === fullId);
    if (idx === -1) return;

    // Un-mark the personal and business as used so they become available again
    const full = this.readyFulls[idx];
    if (!full.isManual) {
      const p = this.personalFulls.find(x => x.id === full.personal.id);
      if (p) p.used = false;
    }
    if (full.business) {
      const b = this.businessFulls.find(x => x.id === full.business.id);
      if (b) b.used = false;
    }

    this.readyFulls.splice(idx, 1);

    await Promise.all([
      DataStorage.savePersonalFulls(this.personalFulls),
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderList('personal');
    this.renderList('business');
    this.renderReadyFulls();
    DataUtils.showToast('Карточка удалена 🗑️');
  },

  async createPersonalCard() {
    const personal = this.personalFulls.find(p => !p.used);
    if (!personal) { DataUtils.showToast('Нет свободных персональных фулок!'); return; }

    personal.used = true;

    // Generate proxies based on state
    const stateCode  = personal.state;
    const coreProxy  = ProxyGenerator.generateCoreProxy(stateCode);
    const flashProxy = ProxyGenerator.generateFlashProxy(stateCode);

    const readyFull = {
      id:         Date.now(),
      createdAt:  new Date().toISOString(),
      personal:   { ...personal },
      business:   null,
      manualEmail: '',
      manualEmailPassword: '',
      pendingCode: '',
      coreProxy,
      flashProxy,
      status:     null,
      statusDate: null
    };

    this.readyFulls.unshift(readyFull);

    await Promise.all([
      DataStorage.savePersonalFulls(this.personalFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderList('personal');
    this.renderReadyFulls();
    DataUtils.showToast('Карточка создана! ✨');
  },

  /* ── Attach Business to Card ───────────────────────────── */

  async attachBusiness(fullId) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;
    if (full.business) { DataUtils.showToast('Бизнес уже прикреплён!'); return; }

    const business = this.businessFulls.find(b => !b.used);
    if (!business) { DataUtils.showToast('Нет свободных бизнес фулок!'); return; }

    business.used  = true;
    full.business  = { ...business };

    await Promise.all([
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderList('business');
    this.renderReadyFulls();
    DataUtils.showToast('Бизнес прикреплён ✅');
  },

  /* ── Save Manual Email ─────────────────────────────────── */

  async saveManualEmail(fullId, emailVal, passVal) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;

    full.manualEmail         = emailVal.trim();
    full.manualEmailPassword = passVal.trim();

    await DataStorage.saveReadyFulls(this.readyFulls);
    DataUtils.showToast('Почта сохранена ✅');
  },

  /* ── Render Ready Fulls ────────────────────────────────── */

  renderReadyFulls() {
    const container = document.getElementById('ready-fulls-container');
    container.innerHTML = '';

    if (!this.readyFulls.length) {
      container.innerHTML = '<div class="empty-state">Нет карточек. Загрузите персональные данные и нажмите «Создать карточку».</div>';
      return;
    }

    this.readyFulls.forEach((full, i) => {
      container.appendChild(this._buildCard(full, i));
    });
  },

  _buildCard(full, index) {
    const p = full.personal;
    const b = full.business;

    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.05}s`;

    // Status badge
    let badgeClass = '', badgeText = 'Новая';
    if (full.status === 'done')     { badgeClass = 'status-done';     badgeText = 'Сделано'; }
    if (full.status === 'pending')  { badgeClass = 'status-pending';  badgeText = 'Пендинг'; }
    if (full.status === 'rejected') { badgeClass = 'status-rejected'; badgeText = 'Отказ'; }

    // Business section HTML
    const businessHTML = b
      ? `<div class="card-data-section business-section">
           <div class="section-label">🏢 Бизнес</div>
           <div class="data-line"><span class="data-icon">🏢</span> ${this._esc(b.companyName.replace(/,/g, ''))}</div>
           <div class="data-line"><span class="data-icon">🔢</span> ${this._esc(b.ein)}</div>
           <div class="data-line"><span class="data-icon">📅</span> ${this._esc(b.date)}</div>
         </div>`
      : `<div class="card-data-section business-empty">
           <button class="btn-attach-business" data-full-id="${full.id}">
             <span>🏢</span> Прикрепить бизнес фулку
           </button>
         </div>`;

    // Email section HTML
    const emailInputId   = `email-input-${full.id}`;
    const emailPassId    = `email-pass-${full.id}`;
    const hasEmail       = full.manualEmail;
    const emailSectionHTML = `
      <div class="card-data-section email-section">
        <div class="section-label">📧 Почта</div>
        ${hasEmail
          ? `<div class="data-line email-display">
               <span class="data-icon">📧</span>
               <span class="email-value">${this._esc(full.manualEmail)}${full.manualEmailPassword ? ':' + this._esc(full.manualEmailPassword) : ''}</span>
               <button class="btn-edit-email" data-full-id="${full.id}">✏️</button>
             </div>`
          : `<div class="email-input-group">
               <input type="text" id="${emailInputId}" class="email-inline-input" placeholder="email@example.com" value="${this._esc(full.manualEmail || '')}">
               <input type="text" id="${emailPassId}"  class="email-inline-input" placeholder="пароль" value="${this._esc(full.manualEmailPassword || '')}">
               <button class="btn-save-email" data-full-id="${full.id}">Сохранить</button>
             </div>`
        }
      </div>`;

    // Reference number section (shown only when status is pending)
    const refInputId = `ref-input-${full.id}`;
    const referenceHTML = full.status === 'pending'
      ? `<div class="card-data-section reference-section">
           <div class="section-label">📑 Reference number</div>
           ${full.pendingCode
             ? `<div class="data-line reference-display">
                  <span class="data-icon">📑</span>
                  <span class="reference-value">Reference number: ${this._esc(full.pendingCode)}</span>
                  <button class="btn-edit-reference" data-full-id="${full.id}">✏️</button>
                </div>`
             : `<div class="reference-input-group">
                  <input type="text" id="${refInputId}" class="email-inline-input" placeholder="0159884397" value="">
                  <button class="btn-save-reference" data-full-id="${full.id}">Сохранить</button>
                </div>`
           }
         </div>`
      : '';

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
          <div class="section-label">👤 Персональные данные</div>
          <div class="data-line"><span class="data-icon">📅</span> ${this._esc(p.dob)}</div>
          <div class="data-line"><span class="data-icon">🔑</span> ${this._esc(p.ssn)}</div>
          <div class="data-line"><span class="data-icon">👤</span> ${this._esc(p.firstName)} ${this._esc(p.lastName)}</div>
          <div class="data-line"><span class="data-icon">📍</span> ${this._esc(p.address)}, ${this._esc(p.city)}, ${this._esc(p.zip)}, ${this._esc(p.state)}</div>
          <div class="data-line"><span class="data-icon">📧</span> ${this._esc(p.email)}</div>
          <div class="data-line"><span class="data-icon">📞</span> ${this._esc(p.phone)}${p.extra ? ', ' + this._esc(p.extra) : ''}</div>
        </div>

        ${businessHTML}
        ${emailSectionHTML}
        ${referenceHTML}

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

        <div class="card-footer">
          <div class="footer-tg-actions">
            ${full.status === 'pending' ? `<button class="btn-copy btn-copy-tg btn-tg-pending">📨 ТГ (Пендинг)</button>` : ''}
            ${full.status === 'done'    ? `<button class="btn-copy btn-copy-tg btn-tg-done">📋 ТГ (Сделано)</button>` : ''}
          </div>
          <button class="btn-copy btn-delete-card">🗑️ Удалить</button>
        </div>
      </div>
    `;

    // ── Attach business button
    const attachBtn = card.querySelector('.btn-attach-business');
    if (attachBtn) {
      attachBtn.addEventListener('click', () => this.attachBusiness(full.id));
    }

    // ── Save email button
    const saveEmailBtn = card.querySelector('.btn-save-email');
    if (saveEmailBtn) {
      saveEmailBtn.addEventListener('click', () => {
        const emailVal = card.querySelector(`#${emailInputId}`).value;
        const passVal  = card.querySelector(`#${emailPassId}`).value;
        this.saveManualEmail(full.id, emailVal, passVal).then(() => this.renderReadyFulls());
      });
    }

    // ── Edit email button
    const editEmailBtn = card.querySelector('.btn-edit-email');
    if (editEmailBtn) {
      editEmailBtn.addEventListener('click', () => {
        full.manualEmail         = '';
        full.manualEmailPassword = '';
        this.renderReadyFulls();
      });
    }

    // ── Save reference button
    const saveRefBtn = card.querySelector('.btn-save-reference');
    if (saveRefBtn) {
      saveRefBtn.addEventListener('click', () => {
        const code = card.querySelector(`#${refInputId}`).value;
        this.savePendingCode(full.id, code);
      });
    }

    // ── Edit reference button
    const editRefBtn = card.querySelector('.btn-edit-reference');
    if (editRefBtn) {
      editRefBtn.addEventListener('click', () => {
        full.pendingCode = '';
        this.renderReadyFulls();
      });
    }

    // ── Copy button handlers
    card.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const block = btn.closest('.proxy-block');
        const text  = block.querySelector('.proxy-text').textContent;
        DataUtils.copyToClipboard(text);
        btn.classList.add('copied');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = orig; }, 1200);
      });
    });

    // ── Refresh proxy button handlers
    card.querySelectorAll('.btn-refresh').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.refreshType;
        const stateCode = full.personal.state;
        btn.classList.add('spinning');
        const newProxy = type === 'core'
          ? ProxyGenerator.generateCoreProxy(stateCode)
          : ProxyGenerator.generateFlashProxy(stateCode);
        if (type === 'core')  full.coreProxy  = newProxy;
        if (type === 'flash') full.flashProxy = newProxy;
        const textEl = btn.closest('.proxy-block').querySelector('.proxy-text');
        textEl.textContent = newProxy;
        await DataStorage.saveReadyFulls(this.readyFulls);
        setTimeout(() => btn.classList.remove('spinning'), 600);
        DataUtils.showToast('Прокси обновлён 🔄');
      });
    });

    // ── Status button handlers
    card.querySelectorAll('.btn-status').forEach(btn => {
      btn.addEventListener('click', () => this.setStatus(full.id, btn.dataset.status));
    });

    // ── Copy for TG button (pending or done)
    const tgBtn = card.querySelector('.btn-copy-tg');
    if (tgBtn) {
      tgBtn.addEventListener('click', () => {
        const text = full.status === 'done'
          ? this._formatForTelegramDone(full)
          : this._formatForTelegramPending(full);
        DataUtils.copyToClipboard(text);
        const orig = tgBtn.textContent;
        tgBtn.textContent = '✅ Скопировано!';
        tgBtn.classList.add('copied');
        setTimeout(() => { tgBtn.textContent = orig; tgBtn.classList.remove('copied'); }, 1500);
      });
    }

    // ── Delete card button
    card.querySelector('.btn-delete-card').addEventListener('click', () => {
      if (confirm(`Удалить карточку ${full.personal.firstName} ${full.personal.lastName}?`)) {
        this.deleteCard(full.id);
      }
    });

    return card;
  },

  /* ── Clean Phone ──────────────────────────────────────── */

  /**
   * Strips extra numbers/bank codes after the phone number.
   * "(205) 903-1614, 8384586" → "(205) 903-1614"
   * "(817) 630-6868" → "(817) 630-6868"
   */
  _cleanPhone(phone) {
    if (!phone) return '';
    // Strip anything after a comma (bank codes, extra numbers)
    const noComma = phone.split(',')[0].trim();
    // Also strip a trailing block of digits separated by space (e.g. "8384586")
    return noComma.replace(/\s+\d{5,}$/, '').trim();
  },

  /* ── Format for Telegram (Pending) ────────────────────── */

  _formatForTelegramPending(full) {
    const p = full.personal;
    const b = full.business;
    const phone = this._cleanPhone(p.phone);
    const lines = [];

    lines.push(`${p.dob},`);
    lines.push(`${p.ssn},`);
    lines.push(`${p.firstName} ,,${p.lastName},`);
    lines.push(`${p.address},${p.city},${p.zip},${p.state},${p.state},`);
    lines.push(`${p.email},`);
    lines.push(phone ? `${phone},` : '');
    lines.push('');
    lines.push('');

    // Business: remove commas from company name (TAIT ENTERPRISE, LLC → TAIT ENTERPRISE LLC)
    if (b) lines.push(b.raw.replace(/,/g, ''));

    if (full.manualEmail) {
      lines.push(full.manualEmailPassword
        ? `${full.manualEmail}:${full.manualEmailPassword}`
        : full.manualEmail);
    }

    if (full.pendingCode) lines.push(`Reference number:${full.pendingCode}`);

    return lines.join('\n');
  },

  /* ── Format for Telegram (Done) ──────────────────────── */

  _formatForTelegramDone(full) {
    const p = full.personal;
    const b = full.business;
    const phone = this._cleanPhone(p.phone);
    const lines = [];

    lines.push(p.dob);
    lines.push(p.ssn);
    lines.push(`${p.firstName} ${p.lastName} `);
    lines.push(`${p.address} ${p.city} ${p.zip} ${p.state}`);
    lines.push(`${p.email} `);
    // Only the clean phone number — no extra bank codes
    lines.push(phone);
    lines.push('');

    // Business: remove commas from company name (TAIT ENTERPRISE, LLC → TAIT ENTERPRISE LLC)
    if (b) lines.push(b.raw.replace(/,/g, ''));

    if (full.manualEmail) {
      lines.push(full.manualEmailPassword
        ? `${full.manualEmail}:${full.manualEmailPassword}`
        : full.manualEmail);
    }

    lines.push('saving+checking');

    return lines.join('\n');
  },


  /* ── Set Status ────────────────────────────────────── */

  async setStatus(fullId, status) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full || full.status !== null) return;

    // For pending — just mark as pending and re-render (pending code entered inline)
    full.status     = status;
    full.statusDate = DataUtils.getTodayDate();

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

  /* ── Save Pending Code ────────────────────────────────── */

  async savePendingCode(fullId, code) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;
    full.pendingCode = code.trim();
    await DataStorage.saveReadyFulls(this.readyFulls);
    this.renderReadyFulls();
    DataUtils.showToast('Pending сохранён ✅');
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
