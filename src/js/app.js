// ── Main Application ──────────────────────────────────────────

const App = {
  personalFulls: [],
  businessFulls: [],
  readyFulls: [],

  // Track which cards are in inline-edit mode (email / phone)
  _emailEditIds: new Set(),
  _phoneEditIds: new Set(),

  /* ── Init ──────────────────────────────────────────────── */

  async init() {
    // Init themes/zoom first so there's no flash
    ThemeManager.init();

    // Set version
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionEl = document.getElementById('app-version');
      if (versionEl && version) versionEl.textContent = `v${version}`;
    } catch (e) { console.error('Failed to load version'); }

    // Load data
    [this.personalFulls, this.businessFulls, this.readyFulls] = await Promise.all([
      DataStorage.loadPersonalFulls(),
      DataStorage.loadBusinessFulls(),
      DataStorage.loadReadyFulls(),
    ]);

    this.renderList('personal');
    this.renderList('business');
    this.renderReadyFulls();

    this.setupTabs();
    this.setupAddButtons();
    this.setupCreateButton();
    this.setupManualCreate();

    await DashboardManager.init();

    this.setupUpdateBanner();
  },

  /* ── Update Banner ─────────────────────────────────────── */

  setupUpdateBanner() {
    if (!window.electronAPI?.onUpdateAvailable) return;

    const banner     = document.getElementById('update-banner');
    const icon       = document.getElementById('update-icon');
    const title      = document.getElementById('update-title');
    const desc       = document.getElementById('update-desc');
    const fill       = document.getElementById('update-progress-fill');
    const pct        = document.getElementById('update-progress-pct');
    const progressWrap = document.getElementById('update-progress-wrap');
    const installBtn = document.getElementById('btn-install-update');
    const laterBtn   = document.getElementById('btn-update-later');

    const show = () => banner.classList.add('visible');
    const hide = () => banner.classList.remove('visible');

    window.electronAPI.onUpdateAvailable((version) => {
      icon.textContent  = '🚀';
      title.textContent = `Доступно обновление v${version}`;
      desc.textContent  = 'Скачивается в фоне автоматически...';
      progressWrap.style.display = 'flex';
      installBtn.style.display   = 'none';
      show();
    });

    window.electronAPI.onUpdateProgress((percent) => {
      fill.style.width  = `${percent}%`;
      pct.textContent   = `${percent}%`;
      desc.textContent  = 'Загружается...';
    });

    window.electronAPI.onUpdateDownloaded(() => {
      icon.textContent  = '✅';
      title.textContent = 'Обновление готово к установке!';
      desc.textContent  = 'Нажмите «Установить» — приложение перезапустится';
      progressWrap.style.display = 'none';
      installBtn.style.display   = 'flex';
    });

    installBtn.addEventListener('click', () => {
      window.electronAPI.installUpdate();
    });

    laterBtn.addEventListener('click', hide);
    window.electronAPI.onUpdateNotAvailable(() => {
      if (this._isCheckingManual) {
        DataUtils.showToast('Установлена последняя версия ✓');
        this._isCheckingManual = false;
      }
    });

    const versionEl = document.getElementById('app-version');
    if (versionEl) {
      versionEl.style.cursor = 'pointer';
      versionEl.title = 'Проверить обновления';
      versionEl.addEventListener('click', () => {
        this._isCheckingManual = true;
        DataUtils.showToast('Поиск обновлений...');
        window.electronAPI.checkForUpdates();
      });
    }
  },

  /* ── Tab Navigation ────────────────────────────────────── */

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
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

    const frag = document.createDocumentFragment();

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `item-row${item.used ? ' used' : ''}`;

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

      frag.appendChild(row);
    });

    listEl.innerHTML = '';
    listEl.appendChild(frag);
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

    const full = this.readyFulls[idx];
    if (!full.isManual) {
      const p = this.personalFulls.find(x => x.id === full.personal.id);
      if (p) p.used = false;
    }
    if (full.business) {
      const b = this.businessFulls.find(x => x.id === full.business.id);
      if (b) b.used = false;
    }

    this._emailEditIds.delete(fullId);
    this._phoneEditIds.delete(fullId);

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

  /* ── Create Secondary Card (Вторяк) ───────────────────── */

  async createSecondary(parentId) {
    const parent = this.readyFulls.find(f => f.id === parentId);
    if (!parent) return;

    // Count existing secondaries for this parent
    const existingCount = this.readyFulls.filter(f => f.parentId === parentId).length;
    if (existingCount >= 4) {
      DataUtils.showToast('Максимум 4 вторяка на одну карточку!');
      return;
    }

    const business = this.businessFulls.find(b => !b.used);
    if (!business) {
      DataUtils.showToast('Нет свободных бизнес фулок!');
      return;
    }

    business.used = true;

    const stateCode  = parent.personal.state;
    const coreProxy  = ProxyGenerator.generateCoreProxy(stateCode);
    const flashProxy = ProxyGenerator.generateFlashProxy(stateCode);

    const secondary = {
      id:                  Date.now() + Math.random(),
      createdAt:           new Date().toISOString(),
      personal:            { ...parent.personal },
      business:            { ...business },
      manualEmail:         '',
      manualEmailPassword: '',
      pendingCode:         '',
      coreProxy,
      flashProxy,
      status:              null,
      statusDate:          null,
      parentId:            parentId,
      secondaryIndex:      existingCount + 1
    };

    // Insert secondary right after parent card
    const parentIdx = this.readyFulls.indexOf(parent);
    this.readyFulls.splice(parentIdx + existingCount + 1, 0, secondary);

    await Promise.all([
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderList('business');
    this.renderReadyFulls();
    DataUtils.showToast(`Вторяк ${secondary.secondaryIndex} создан! ✨`);
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
    this._updateCard(fullId);
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

  /* ── Save Phone ────────────────────────────────────────── */

  async savePhone(fullId, phoneVal) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;
    full.personal.phone = phoneVal.trim();
    await DataStorage.saveReadyFulls(this.readyFulls);
    DataUtils.showToast('Телефон сохранён ✅');
  },

  /* ── Update single card in DOM (performance) ───────────── */

  _updateCard(fullId) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) { this.renderReadyFulls(); return; }
    const index = this.readyFulls.indexOf(full);
    const container = document.getElementById('ready-fulls-container');
    const oldCard   = container.children[index];
    if (!oldCard) { this.renderReadyFulls(); return; }
    const newCard = this._buildCard(full, index);
    container.replaceChild(newCard, oldCard);
  },

  /* ── Render Ready Fulls ────────────────────────────────── */

  renderReadyFulls() {
    const container = document.getElementById('ready-fulls-container');
    container.innerHTML = '';

    if (!this.readyFulls.length) {
      container.innerHTML = '<div class="empty-state">Нет карточек. Загрузите персональные данные и нажмите «Создать карточку».</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    this.readyFulls.forEach((full, i) => frag.appendChild(this._buildCard(full, i)));
    container.appendChild(frag);
  },

  _buildCard(full, index) {
    const p = full.personal;
    const b = full.business;

    const card = document.createElement('div');
    card.className = 'result-card';

    // Status badge
    let badgeClass = '', badgeText = 'Новая';
    if (full.status === 'done')     { badgeClass = 'status-done';     badgeText = 'Сделано'; }
    if (full.status === 'pending')  { badgeClass = 'status-pending';  badgeText = 'Пендинг'; }
    if (full.status === 'rejected') { badgeClass = 'status-rejected'; badgeText = 'Отказ'; }

    // Phone section (inline edit)
    const isEditingPhone = this._phoneEditIds.has(full.id);
    const phoneDisplay = isEditingPhone
      ? `<input class="inline-edit-input" id="phone-edit-${full.id}" value="${this._esc(p.phone || '')}" placeholder="(817) 630-6868">
         <button class="btn-save-phone" data-full-id="${full.id}">✓</button>
         <button class="btn-cancel-phone" data-full-id="${full.id}">✗</button>`
      : `<span>${p.phone ? this._esc(p.phone) : '<span class="text-empty">не указан</span>'}${p.extra ? ', ' + this._esc(p.extra) : ''}</span>
         <button class="btn-edit-phone" title="Редактировать телефон" data-full-id="${full.id}">✏️</button>`;

    // Business section HTML
    const businessHTML = b
      ? `<div class="card-data-section business-section">
           <div class="section-label">🏢 Бизнес</div>
           <div class="data-line"><span class="data-icon">🏢</span> ${this._esc(b.companyName.replace(/,/g, ''))}</div>
           <div class="data-line"><span class="data-icon">🔢</span> ${this._esc(b.ein)}</div>
           <div class="data-line"><span class="data-icon">📅</span> <span class="date-formatted">${this._formatDate(b.date)}</span></div>
         </div>`
      : `<div class="card-data-section business-empty">
           <button class="btn-attach-business" data-full-id="${full.id}">
             <span>🏢</span> Прикрепить бизнес фулку
           </button>
         </div>`;

    // Email section HTML (with pre-fill on edit)
    const emailInputId   = `email-input-${full.id}`;
    const emailPassId    = `email-pass-${full.id}`;
    const hasEmail       = !!full.manualEmail;
    const isEditingEmail = this._emailEditIds.has(full.id);

    const emailSectionHTML = `
      <div class="card-data-section email-section">
        <div class="section-label">📧 Почта</div>
        ${(hasEmail && !isEditingEmail)
          ? `<div class="data-line email-display">
               <span class="data-icon">📧</span>
               <span class="email-value">${this._esc(full.manualEmail)}${full.manualEmailPassword ? ':' + this._esc(full.manualEmailPassword) : ''}</span>
               <button class="btn-edit-email" data-full-id="${full.id}">✏️</button>
             </div>`
          : `<div class="email-input-group">
               <input type="text" id="${emailInputId}" class="email-inline-input" placeholder="email@example.com" value="${this._esc(full.manualEmail || '')}">
               <input type="text" id="${emailPassId}"  class="email-inline-input" placeholder="пароль" value="${this._esc(full.manualEmailPassword || '')}">
               <div class="email-btn-row">
                 <button class="btn-generate-email" data-full-id="${full.id}">🎲 Генерировать</button>
                 <button class="btn-save-email" data-full-id="${full.id}">Сохранить</button>
                 ${hasEmail ? `<button class="btn-cancel-email" data-full-id="${full.id}">Отмена</button>` : ''}
               </div>
             </div>`
        }
      </div>`;

    // Reference number section
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

    // Secondary cards block (shown in parent when status=done)
    const secondaries = full.parentId === null
      ? this.readyFulls.filter(f => f.parentId === full.id)
      : [];
    const secondaryCount = secondaries.length;
    const canAddMore = secondaryCount < 4;

    const statusIcon = (s) => {
      if (s === 'done')     return '✅';
      if (s === 'pending')  return '⏳';
      if (s === 'rejected') return '❌';
      return '🆕';
    };

    const secondaryBlockHTML = (full.status === 'done' && full.parentId === null)
      ? `<div class="secondary-block">
           <div class="secondary-block-header">
             <span class="secondary-block-title">🔁 Вторяки</span>
             <span class="secondary-count">${secondaryCount}/4</span>
           </div>
           ${secondaryCount > 0 ? `<div class="secondary-list">${secondaries.map(s =>
             `<div class="secondary-item" data-scroll-to="${s.id}">
                <span class="secondary-item-icon">${statusIcon(s.status)}</span>
                <span class="secondary-item-name">Вторяк ${s.secondaryIndex}</span>
                <span class="secondary-item-status">${s.status ? ({done:'Сделано',pending:'Пендинг',rejected:'Отказ'}[s.status]) : 'Новая'}</span>
              </div>`
           ).join('')}</div>` : ''}
           ${canAddMore
             ? `<button class="btn-create-secondary" data-parent-id="${full.id}">＋ Создать вторяк</button>`
             : `<div class="secondary-max-note">Максимум 4 вторяка достигнут</div>`
           }
         </div>`
      : '';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="card-number">#${this.readyFulls.length - index}</span>
          <span class="card-name">${this._esc(p.firstName)} ${this._esc(p.lastName)}</span>
          ${full.secondaryIndex !== null && full.secondaryIndex !== undefined
            ? `<span class="secondary-badge">Вторяк ${full.secondaryIndex}</span>`
            : ''}
        </div>
        <span class="card-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="card-body">

        <div class="card-data-section">
          <div class="section-label">👤 Персональные данные</div>
          <div class="data-line dob-line">
            <span class="data-icon">📅</span>
            <span class="date-formatted">${this._formatDate(p.dob)}</span>
          </div>
          <div class="data-line"><span class="data-icon">🔑</span> ${this._esc(p.ssn)}</div>
          <div class="data-line"><span class="data-icon">👤</span> ${this._esc(p.firstName)} ${this._esc(p.lastName)}</div>
          <div class="data-line"><span class="data-icon">📍</span> ${this._esc(p.address)}, ${this._esc(p.city)}, ${this._esc(p.zip)}, ${this._esc(p.state)}</div>
          <div class="data-line"><span class="data-icon">📧</span> ${this._esc(p.email)}</div>
          <div class="data-line phone-line">
            <span class="data-icon">📞</span>
            ${phoneDisplay}
          </div>
        </div>

        ${businessHTML}
        ${emailSectionHTML}
        ${referenceHTML}
        ${secondaryBlockHTML}

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
    if (attachBtn) attachBtn.addEventListener('click', () => this.attachBusiness(full.id));

    // ── Phone edit button
    const editPhoneBtn = card.querySelector('.btn-edit-phone');
    if (editPhoneBtn) {
      editPhoneBtn.addEventListener('click', () => {
        this._phoneEditIds.add(full.id);
        this._updateCard(full.id);
      });
    }

    // ── Phone save button
    const savePhoneBtn = card.querySelector('.btn-save-phone');
    if (savePhoneBtn) {
      savePhoneBtn.addEventListener('click', () => {
        const val = card.querySelector(`#phone-edit-${full.id}`).value;
        this._phoneEditIds.delete(full.id);
        this.savePhone(full.id, val).then(() => this._updateCard(full.id));
      });
    }

    // ── Phone cancel button
    const cancelPhoneBtn = card.querySelector('.btn-cancel-phone');
    if (cancelPhoneBtn) {
      cancelPhoneBtn.addEventListener('click', () => {
        this._phoneEditIds.delete(full.id);
        this._updateCard(full.id);
      });
    }

    // ── Save email button
    const saveEmailBtn = card.querySelector('.btn-save-email');
    if (saveEmailBtn) {
      saveEmailBtn.addEventListener('click', () => {
        const emailVal = card.querySelector(`#${emailInputId}`).value;
        const passVal  = card.querySelector(`#${emailPassId}`).value;
        this._emailEditIds.delete(full.id);
        this.saveManualEmail(full.id, emailVal, passVal).then(() => this._updateCard(full.id));
      });
    }

    // ── Cancel email edit button (pre-filled, keep existing data)
    const cancelEmailBtn = card.querySelector('.btn-cancel-email');
    if (cancelEmailBtn) {
      cancelEmailBtn.addEventListener('click', () => {
        this._emailEditIds.delete(full.id);
        this._updateCard(full.id);
      });
    }

    // ── Edit email button (opens inputs pre-filled with existing data)
    const editEmailBtn = card.querySelector('.btn-edit-email');
    if (editEmailBtn) {
      editEmailBtn.addEventListener('click', () => {
        this._emailEditIds.add(full.id);
        this._updateCard(full.id);
      });
    }

    // ── Generate email button
    const genEmailBtn = card.querySelector('.btn-generate-email');
    if (genEmailBtn) {
      genEmailBtn.addEventListener('click', () => {
        const emailInput = card.querySelector(`#${emailInputId}`);
        const passInput  = card.querySelector(`#${emailPassId}`);
        if (emailInput) emailInput.value = this._generateEmail(full.personal.firstName, full.personal.lastName);
        if (passInput)  passInput.value  = this._generatePassword();
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
        this._updateCard(full.id);
      });
    }

    // ── Copy proxy buttons
    card.querySelectorAll('.btn-copy[data-proxy-type]').forEach(btn => {
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

    // ── Refresh proxy buttons
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

    // ── Status buttons
    card.querySelectorAll('.btn-status').forEach(btn => {
      btn.addEventListener('click', () => this.setStatus(full.id, btn.dataset.status));
    });

    // ── Copy for TG
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

    // ── Create secondary button
    const createSecBtn = card.querySelector('.btn-create-secondary');
    if (createSecBtn) {
      createSecBtn.addEventListener('click', () => this.createSecondary(full.id));
    }

    // ── Secondary item scroll
    card.querySelectorAll('.secondary-item[data-scroll-to]').forEach(item => {
      item.addEventListener('click', () => {
        const targetId = parseFloat(item.dataset.scrollTo);
        const targetIdx = this.readyFulls.findIndex(f => f.id === targetId);
        if (targetIdx === -1) return;
        const container = document.getElementById('ready-fulls-container');
        const targetCard = container.children[targetIdx];
        if (targetCard) targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // ── Delete card button
    card.querySelector('.btn-delete-card').addEventListener('click', () => {
      if (confirm(`Удалить карточку ${full.personal.firstName} ${full.personal.lastName}?`)) {
        this.deleteCard(full.id);
      }
    });

    return card;
  },

  /* ── Format date for display ───────────────────────────── */

  /**
   * Turns "1998-09-15" → "Год: 1998 | Мес: 09 | День: 15"
   * Turns "09/15/1998" → "Год: 1998 | Мес: 09 | День: 15"
   * Falls back to raw string if format is unknown.
   */
  _formatDate(dateStr) {
    if (!dateStr) return '—';
    const s = dateStr.trim();
    const parts = s.split(/[-\/\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `Год: ${parts[0]} | Мес: ${parts[1]} | День: ${parts[2]}`;
      } else if (parts[2].length === 4) {
        // MM/DD/YYYY
        return `Год: ${parts[2]} | Мес: ${parts[0]} | День: ${parts[1]}`;
      }
    }
    return s;
  },

  /* ── Clean Phone ──────────────────────────────────────── */

  _cleanPhone(phone) {
    if (!phone) return '';
    const noComma = phone.split(',')[0].trim();
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
    lines.push(phone);
    lines.push('');

    if (b) lines.push(b.raw.replace(/,/g, ''));

    if (full.manualEmail) {
      lines.push(full.manualEmailPassword
        ? `${full.manualEmail}:${full.manualEmailPassword}`
        : full.manualEmail);
    }

    lines.push('saving+checking');

    if (full.secondaryIndex !== null && full.secondaryIndex !== undefined) {
      lines.push(`Вторяк ${full.secondaryIndex}`);
    }

    return lines.join('\n');
  },

  /* ── Set Status ────────────────────────────────────── */

  async setStatus(fullId, status) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full || full.status !== null) return;

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

    this._updateCard(fullId);

    const labels = { done: 'Сделано ✅', pending: 'Пендинг ⏳', rejected: 'Отказ ❌' };
    DataUtils.showToast(labels[status]);
  },

  /* ── Save Pending Code ────────────────────────────────── */

  async savePendingCode(fullId, code) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;
    full.pendingCode = code.trim();
    await DataStorage.saveReadyFulls(this.readyFulls);
    this._updateCard(fullId);
    DataUtils.showToast('Pending сохранён ✅');
  },

  /* ── Helpers ───────────────────────────────────────────── */

  /**
   * Generates email like jennaspahn72@outlook.com
   * firstName (1st word) + lastName (1st word) + 1-4 random digits + @domain
   */
  _generateEmail(firstName, lastName) {
    const domains = ['outlook.com', 'gmail.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];
    
    // Combine names to handle cases where everything is in firstName, or middle name is in lastName
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    
    // Get first word and last word (if only 1 word, use it for both or just first, let's use first and last)
    let fn = parts.length > 0 ? parts[0].toLowerCase().replace(/[^a-z]/g, '') : '';
    let ln = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '') : '';

    
    // Generate 1 to 4 random digits
    const digitsCount = Math.floor(Math.random() * 4) + 1;
    let numStr = '';
    for (let i = 0; i < digitsCount; i++) {
      numStr += Math.floor(Math.random() * 10).toString();
    }
    
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${fn}${ln}${numStr}@${domain}`;
  },

  /**
   * Generates a random 10-character password with letters and digits
   */
  _generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    return pass;
  },

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
