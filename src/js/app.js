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
    this.setupSecondaryModal();

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
        const page = document.getElementById(`page-${btn.dataset.tab}`);
        if (page) page.classList.add('active');
        // Always scroll to top when switching tabs
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (btn.dataset.tab === 'dashboard') DashboardManager.refresh();
        if (btn.dataset.tab === 'secondaries') this.renderSecondaries();
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

    const parsed = [];
    const errors = [];

    if (type === 'personal' && /^SSN[:\s]/im.test(raw)) {
      // ── Multiline block format (SSN: / DOB: markers present)
      const blocks = raw.split(/\n\s*\n/).filter(b => b.trim());
      for (const block of blocks) {
        const item = DataParser.parseMultilinePersonalBlock(block);
        if (item && !item.error) {
          item.id   = Date.now() + Math.random();
          item.used = false;
          parsed.push(item);
        } else if (item && item.error) {
          errors.push(item.error);
        }
      }
    } else if (type === 'business' && /^EIN\s*Number|^Date\s*Filed/im.test(raw)) {
      // ── Multiline block format for business (EIN Number / Date Filed markers)
      const blocks = raw.split(/\n\s*\n/).filter(b => b.trim());
      for (const block of blocks) {
        const item = DataParser.parseMultilineBusinessBlock(block);
        if (item && !item.error) {
          item.id   = Date.now() + Math.random();
          item.used = false;
          parsed.push(item);
        } else if (item && item.error) {
          errors.push(item.error);
        }
      }
    } else {
      // ── Single-line CSV format (existing logic)
      const lines = raw.split('\n').filter(l => l.trim());
      for (const line of lines) {
        let item = null;
        if (type === 'personal') item = DataParser.parsePersonalFull(line);
        if (type === 'business') item = DataParser.parseBusinessFull(line);
        
        if (item && !item.error) {
          item.id   = Date.now() + Math.random();
          item.used = false;
          parsed.push(item);
        } else if (item && item.error) {
          errors.push(item.error);
        }
      }
    }

    if (!parsed.length) {
      if (errors.length > 0) {
        DataUtils.showToast(`Ошибка: ${errors[0]}`);
      } else {
        DataUtils.showToast('Не удалось распознать данные');
      }
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

    const coreProxy  = ProxyGenerator.generateEmailProxy(state);
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

    // If card had a status — decrement the statistics counter
    const saves = [
      DataStorage.savePersonalFulls(this.personalFulls),
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ];
    if (full.status && full.statusDate) {
      const stats = await DataStorage.loadStatistics();
      const day = full.statusDate;
      if (stats[day]) {
        stats[day].total    = Math.max(0, (stats[day].total    || 0) - 1);
        stats[day].done     = Math.max(0, (stats[day].done     || 0) - (full.status === 'done'     ? 1 : 0));
        stats[day].pending  = Math.max(0, (stats[day].pending  || 0) - (full.status === 'pending'  ? 1 : 0));
        stats[day].rejected = Math.max(0, (stats[day].rejected || 0) - (full.status === 'rejected' ? 1 : 0));
        saves.push(DataStorage.saveStatistics(stats));
      }
    }

    await Promise.all(saves);

    this.renderList('personal');
    this.renderList('business');
    this.renderReadyFulls();
    this.renderSecondaries();
    DashboardManager.refresh();
    DataUtils.showToast('Карточка удалена 🗑️');
  },

  async createPersonalCard() {
    const personal = this.personalFulls.find(p => !p.used);
    if (!personal) { DataUtils.showToast('Нет свободных персональных фулок!'); return; }

    personal.used = true;

    const stateCode  = personal.state;
    const coreProxy  = ProxyGenerator.generateEmailProxy(stateCode);
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
    DashboardManager.refresh();
    DataUtils.showToast('Карточка создана ✅');
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
    const coreProxy  = ProxyGenerator.generateEmailProxy(stateCode);
    const flashProxy = ProxyGenerator.generateFlashProxy(stateCode);

    const secondary = {
      id:                  Date.now() * 1000 + Math.floor(Math.random() * 999) + 1,
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

    // Insert secondary at position 0 (top of list, newest first)
    this.readyFulls.unshift(secondary);

    await Promise.all([
      DataStorage.saveBusinessFulls(this.businessFulls),
      DataStorage.saveReadyFulls(this.readyFulls)
    ]);

    this.renderList('business');
    this.renderReadyFulls();
    this.renderSecondaries();
    DashboardManager.refresh();
    DataUtils.showToast(`Вторяк ${secondary.secondaryIndex} создан! 🎉`);
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

    // Sync email back to personal full if it had no email originally
    if (full.personal && !full.personal.email && emailVal.trim()) {
      full.personal.email = emailVal.trim();
      // Also update the source personalFull record if it exists
      const srcPersonal = this.personalFulls.find(p => p.id === full.personal.id);
      if (srcPersonal && !srcPersonal.email) {
        srcPersonal.email = emailVal.trim();
        await DataStorage.savePersonalFulls(this.personalFulls);
      }
    }

    await DataStorage.saveReadyFulls(this.readyFulls);
    DataUtils.showToast('Почта сохранена ✅');
  },

  /* ── Save Phone ────────────────────────────────────────── */

  async savePhone(fullId, phoneVal) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;

    full.personal.phone = phoneVal.trim();

    // Sync phone back to personal full if it had no phone originally
    const srcPersonal = this.personalFulls.find(p => p.id === full.personal.id);
    if (srcPersonal && !srcPersonal.phone) {
      srcPersonal.phone = phoneVal.trim();
      await DataStorage.savePersonalFulls(this.personalFulls);
    }

    await DataStorage.saveReadyFulls(this.readyFulls);
    DataUtils.showToast('Телефон сохранён ✅');
  },

  /* ── Update single card in DOM (performance) ───────────── */

  _updateCard(fullId) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) { this.renderReadyFulls(); return; }
    const index = this.readyFulls.indexOf(full);

    // Search in ALL possible containers: main list, secondaries tab, archive
    const oldCard = document.querySelector(`.result-card[data-id="${fullId}"]`);
    if (!oldCard) {
      // Not currently visible — just re-render the relevant tab
      this.renderReadyFulls();
      return;
    }
    const newCard = this._buildCard(full, index);
    oldCard.parentNode.replaceChild(newCard, oldCard);
  },

  /* ── Workday Helper ────────────────────────────────────── */

  // Workday: 15:50 MSK to 04:00 MSK next day (16:00 start with 10-min early buffer)
  isCurrentWorkDay(isoDate) {
    if (!isoDate) return false;
    const d = new Date(isoDate);

    const now = new Date();
    const nowMsk = new Date(now.getTime() + 3 * 3600 * 1000);
    const nowH = nowMsk.getUTCHours();
    const nowM = nowMsk.getUTCMinutes();

    // Start of current workday in MSK: 15:50 (10 min before 16:00)
    // Using UTC equivalents: 15:50 MSK = 12:50 UTC
    let wdStart = new Date(Date.UTC(
      nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate(),
      15, 50, 0
    ));
    // If current MSK time is 00:00–03:59, workday started yesterday at 15:50
    if (nowH < 4) wdStart = new Date(wdStart.getTime() - 24 * 3600 * 1000);
    // End of workday: 04:00 MSK = 01:00 UTC next day (12h10m window)
    const wdEnd = new Date(wdStart.getTime() + (12 * 60 + 10) * 60 * 1000);

    // Convert to UTC for comparison (wdStart is already in MSK-expressed UTC)
    // wdStart is "15:50 on MSK date" expressed as UTC offset +3h
    // So actual UTC = wdStart - 3h
    const wdStartUTC = new Date(wdStart.getTime() - 3 * 3600 * 1000);
    const wdEndUTC   = new Date(wdEnd.getTime()   - 3 * 3600 * 1000);

    return d >= wdStartUTC && d < wdEndUTC;
  },

  /* ── Render Ready Fulls ────────────────────────────────── */

  renderReadyFulls() {
    const container = document.getElementById('ready-fulls-container');
    container.innerHTML = '';

    if (!this.readyFulls.length) {
      container.innerHTML = '<div class="empty-state">Нет карточек. Загрузите персональные данные и нажмите «Создать карточку».</div>';
      return;
    }

    const todayCards    = this.readyFulls.filter(f => this.isCurrentWorkDay(f.createdAt));
    const archiveCards  = this.readyFulls.filter(f => !this.isCurrentWorkDay(f.createdAt));

    if (!todayCards.length && archiveCards.length) {
      // All cards are from past days
      container.innerHTML = '<div class="empty-state">Нет карточек за текущий рабочий день.</div>';
    }

    const frag = document.createDocumentFragment();
    todayCards.forEach((full) => {
      const i = this.readyFulls.indexOf(full);
      frag.appendChild(this._buildCard(full, i));
    });
    container.appendChild(frag);

    // Archive toggle
    if (archiveCards.length > 0) {
      const archiveSection = document.createElement('div');
      archiveSection.className = 'archive-section';
      archiveSection.innerHTML = `
        <button class="archive-toggle-btn" id="archive-toggle">
          🗂 Показать за прошлые дни (${archiveCards.length})
        </button>
        <div class="archive-cards" id="archive-cards" style="display:none"></div>
      `;
      container.appendChild(archiveSection);

      document.getElementById('archive-toggle').addEventListener('click', (e) => {
        const archiveEl = document.getElementById('archive-cards');
        const btn = e.currentTarget;
        if (archiveEl.style.display === 'none') {
          if (!archiveEl.children.length) {
            const af = document.createDocumentFragment();
            archiveCards.forEach(full => {
              const i = this.readyFulls.indexOf(full);
              af.appendChild(this._buildCard(full, i));
            });
            archiveEl.appendChild(af);
            this._bindCardEvents(archiveEl);
          }
          archiveEl.style.display = 'block';
          btn.textContent = `🗂 Скрыть прошлые дни (${archiveCards.length})`;
        } else {
          archiveEl.style.display = 'none';
          btn.textContent = `🗂 Показать за прошлые дни (${archiveCards.length})`;
        }
      });
    }

    this._updateSecondariesBadge();
  },

  _buildCard(full, index) {
    const p = full.personal;
    const b = full.business;

    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.id = full.id;

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
    // Sanitize ID for safe CSS selector use (remove dots from float IDs)
    const safeId         = String(full.id).replace(/\./g, '_');
    const emailInputId   = `email-input-${safeId}`;
    const emailPassId    = `email-pass-${safeId}`;
    const refInputId2    = `ref-input-${safeId}`;
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
          : (full.status !== null && !hasEmail)
            ? `<div class="data-line"><span class="data-icon">📧</span><span class="text-empty">не указана</span></div>`
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
    const refInputId = refInputId2;
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
                   <button class="btn-save-email btn-save-reference" data-full-id="${full.id}">Сохранить</button>
                 </div>`
           }
         </div>`
      : '';

    // Secondary cards block (shown in parent when status=done)
    const isParent = (full.parentId === null || full.parentId === undefined);
    const secondaries = isParent
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

    // Secondary block — rich 4-slot panel shown when parent card is done
    const secondaryBlockHTML = (full.status === 'done' && isParent)
      ? (() => {
          const slots = [1, 2, 3, 4].map(i => {
            const sec = secondaries.find(s => s.secondaryIndex === i);
            if (sec) {
              // Already created
              const ic   = statusIcon(sec.status);
              const lbl  = sec.status ? ({done:'Сделано',pending:'Пендинг',rejected:'Отказ'}[sec.status]) : 'Новая';
              return `<div class="v-slot v-slot-done" data-scroll-to="${sec.id}">
                <div class="v-slot-num">${i}</div>
                <div class="v-slot-label">Вторяк ${i}</div>
                <div class="v-slot-status">${ic} ${lbl}</div>
              </div>`;
            } else if (i === secondaryCount + 1) {
              // Next available slot
              return `<div class="v-slot v-slot-available">
                <div class="v-slot-num">${i}</div>
                <div class="v-slot-label">Вторяк ${i}</div>
                <button class="btn-create-secondary btn-v-slot" data-parent-id="${full.id}">⊕ Создать</button>
              </div>`;
            } else {
              // Locked slot
              return `<div class="v-slot v-slot-locked">
                <div class="v-slot-num">${i}</div>
                <div class="v-slot-label">Вторяк ${i}</div>
                <div class="v-slot-lock">🔒</div>
              </div>`;
            }
          }).join('');

          return `<div class="secondary-block">
            <div class="secondary-block-header">
              <span class="secondary-block-title">🔁 Вторяки</span>
              <span class="secondary-count-badge">${secondaryCount}/4 создано</span>
            </div>
            <div class="v-slots-grid">${slots}</div>
          </div>`;
        })()
      : '';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          ${(() => {
            // ── Compute sequential number (all today's cards in order)
            const todayAll = this.readyFulls.filter(f => this.isCurrentWorkDay(f.createdAt));
            const seqIdx   = todayAll.indexOf(full);
            const seqNum   = seqIdx !== -1 ? todayAll.length - seqIdx : null;

            // ── Compute detailed number (tooltip)
            const isSecondary = (full.parentId !== null && full.parentId !== undefined);
            let detailNum = '';
            if (isSecondary) {
              const todayParents = this.readyFulls.filter(f =>
                this.isCurrentWorkDay(f.createdAt) && (f.parentId === null || f.parentId === undefined)
              );
              const parent = todayParents.find(f => f.id === full.parentId);
              const pIdx = parent ? todayParents.indexOf(parent) : -1;
              const pNum = pIdx !== -1 ? todayParents.length - pIdx : '?';
              detailNum = `#${pNum}-${full.secondaryIndex}`;
            } else {
              const todayParents = this.readyFulls.filter(f =>
                this.isCurrentWorkDay(f.createdAt) && (f.parentId === null || f.parentId === undefined)
              );
              const pIdx = todayParents.indexOf(full);
              if (pIdx !== -1) detailNum = `#${todayParents.length - pIdx}`;
            }

            const displayNum = seqNum !== null ? `#${seqNum}` : (() => {
              const allCards = this.readyFulls;
              const aIdx = allCards.indexOf(full);
              return aIdx !== -1 ? `#${allCards.length - aIdx}` : '#?';
            })();

            const tooltip = detailNum && detailNum !== displayNum ? detailNum : '';
            return `<span class="card-number"${tooltip ? ` title="${tooltip}"` : ''}>${displayNum}</span>`;
          })()}
          <span class="card-name">${this._esc(p.firstName)} ${this._esc(p.lastName)}</span>
          ${full.secondaryIndex !== null && full.secondaryIndex !== undefined
            ? `<span class="secondary-badge">Вторяк ${full.secondaryIndex}</span>`
            : ''}
        </div>
        <div class="card-header-right">
          ${full.status && full.statusTimestamp
            ? `<span class="card-elapsed" title="Время заполнения">⏱ ${this._formatElapsed(full.createdAt, full.statusTimestamp)}</span>`
            : ''}
          <span class="card-status-badge ${badgeClass}">${badgeText}</span>
        </div>
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
          ${this._buildAddressBlock(p)}
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
        let emailInput = card.querySelector(`[id="${emailInputId}"]`);

        const fillEmail = (inputEl) => {
          // Base email from name (deterministic — no randomness in _generateEmail)
          const baseEmail = this._generateEmail(full.personal.firstName, full.personal.lastName);
          const [baseLogin, domain] = baseEmail.split('@');
          const current = inputEl ? inputEl.value.trim() : '';

          let newLogin;
          if (!current || !current.includes('@')) {
            // Empty field → first generation, just the base
            newLogin = baseLogin;
          } else {
            const [currentLogin] = current.split('@');
            const hasAddedLetter = currentLogin.length === baseLogin.length + 1
                                && currentLogin.startsWith(baseLogin);

            if (hasAddedLetter) {
              // Already has one added letter → replace it with a DIFFERENT random letter
              const currentAdded = currentLogin[currentLogin.length - 1];
              const baseLast    = baseLogin[baseLogin.length - 1];
              const pool = 'abcdefghijklmnopqrstuvwxyz'
                .split('').filter(c => c !== currentAdded && c !== baseLast);
              newLogin = baseLogin + pool[Math.floor(Math.random() * pool.length)];
            } else if (currentLogin === baseLogin) {
              // At base → add one random letter (not same as last char of base)
              const baseLast = baseLogin[baseLogin.length - 1];
              const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => c !== baseLast);
              newLogin = baseLogin + pool[Math.floor(Math.random() * pool.length)];
            } else {
              // Something unrecognised → restart from base
              newLogin = baseLogin;
            }
          }

          if (inputEl) inputEl.value = `${newLogin}@${domain}`;
          const passEl = card.querySelector(`[id="${emailPassId}"]`);
          if (passEl) passEl.value = this._generatePassword();
        };

        if (!emailInput) {
          this._emailEditIds.add(full.id);
          this._updateCard(full.id);
          requestAnimationFrame(() => {
            const updatedCard = document.querySelector(`.result-card[data-id="${full.id}"]`);
            if (!updatedCard) return;
            fillEmail(updatedCard.querySelector(`[id="${emailInputId}"]`));
          });
          return;
        }
        fillEmail(emailInput);
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
          ? ProxyGenerator.generateEmailProxy(stateCode)
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

    lines.push('checking');

    if (full.secondaryIndex !== null && full.secondaryIndex !== undefined) {
      lines.push(`Вторяк ${full.secondaryIndex}`);
    }

    return lines.join('\n');
  },

  /* ── Set Status ────────────────────────────────────── */

  async setStatus(fullId, status) {
    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full || full.status !== null) return;

    full.status          = status;
    full.statusDate      = DataUtils.getTodayDate();
    full.statusTimestamp = new Date().toISOString();

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
    DashboardManager.refresh();

    const labels = { done: 'Сделано ✅', pending: 'Пендинг ⏳', rejected: 'Отказ ❌' };
    DataUtils.showToast(labels[status]);
    // Refresh secondaries tab if it's active
    this.renderSecondaries();
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
   * Generates email like julianabarcenas@hotmail.com
   * firstName + lastName (letters only, no digits/specials).
   * If last letter of firstName == first letter of lastName, skip the duplicate.
   */
  _generateEmail(firstName, lastName) {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    const parts = fullName.split(/\s+/).filter(Boolean);

    // Letters only, lowercase
    let fn = parts.length > 0 ? parts[0].toLowerCase().replace(/[^a-z]/g, '') : '';
    let ln = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '') : '';

    // Remove duplicate letter at the junction (e.g. "juliana" + "anderson" → "julianderson")
    if (fn && ln && fn[fn.length - 1] === ln[0]) {
      ln = ln.slice(1);
    }

    const domain = 'hotmail.com';
    return `${fn}${ln}@${domain}`;
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

  _formatElapsed(startIso, endIso) {
    if (!startIso || !endIso) return '';
    const diffMs  = new Date(endIso) - new Date(startIso);
    if (diffMs < 0) return '';
    const totalSec = Math.floor(diffMs / 1000);
    const hours    = Math.floor(totalSec / 3600);
    const minutes  = Math.floor((totalSec % 3600) / 60);
    const seconds  = totalSec % 60;
    if (hours > 0)   return `${hours}ч ${minutes}м`;
    if (minutes > 0) return `${minutes}м ${seconds}с`;
    return `${seconds}с`;
  },

  /* ── Build structured address block ────────────────────── */

  _buildAddressBlock(p) {
    if (!p.address) return '';

    const addr = p.address.trim();

    // Directional abbreviations (prefix or suffix)
    const DIR = /^(N\.?|S\.?|E\.?|W\.?|NE\.?|NW\.?|SE\.?|SW\.?|North|South|East|West|Northeast|Northwest|Southeast|Southwest)\b/i;

    // Street type suffixes
    const TYPES = {
      'st':'St','street':'St','ave':'Ave','avenue':'Ave','blvd':'Blvd','boulevard':'Blvd',
      'dr':'Dr','drive':'Dr','rd':'Rd','road':'Rd','ln':'Ln','lane':'Ln','ct':'Ct',
      'court':'Ct','pl':'Pl','place':'Pl','way':'Way','cir':'Cir','circle':'Cir',
      'pkwy':'Pkwy','parkway':'Pkwy','fwy':'Fwy','freeway':'Fwy','trl':'Trl','trail':'Trl',
      'pass':'Pass','hwy':'Hwy','highway':'Hwy','loop':'Loop','run':'Run',
      'ter':'Ter','terrace':'Ter','pt':'Pt','point':'Pt','sq':'Sq','square':'Sq',
      'xing':'Xing','crossing':'Xing'
    };

    // Apt/Unit pattern
    const APT_RE = /\b(apt\.?|unit\.?|#|suite\.?|ste\.?|bldg\.?)\s*[\w-]+/i;

    let street = addr;
    let aptUnit = '';

    // Extract apartment/unit first
    const aptMatch = street.match(APT_RE);
    if (aptMatch) {
      aptUnit = aptMatch[0].trim();
      street = street.replace(aptMatch[0], '').trim().replace(/,\s*$/, '').trim();
    }

    // Split street into tokens
    const tokens = street.split(/\s+/);
    let houseNum = '';
    let direction = '';
    let suffix = '';
    let streetNameParts = [];

    let i = 0;

    // 1. House number (leading digits, possibly with letter: 6503, 12A)
    if (i < tokens.length && /^\d+[a-zA-Z]?$/.test(tokens[i])) {
      houseNum = tokens[i++];
    }

    // 2. Optional prefix direction
    if (i < tokens.length && DIR.test(tokens[i])) {
      direction = tokens[i++];
    }

    // 3. Collect name tokens, checking last for type suffix
    const rest = tokens.slice(i);
    // Check last 1-2 tokens for street type
    for (let j = rest.length - 1; j >= 0; j--) {
      const t = rest[j].replace(/\.$/, '').toLowerCase();
      if (TYPES[t]) {
        suffix = TYPES[t];
        streetNameParts = rest.slice(0, j);
        break;
      }
      if (j === 0) streetNameParts = rest; // no type found
    }

    // Build display rows
    const rows = [];

    // Row 1: street line
    const streetLine = [
      houseNum,
      direction,
      ...streetNameParts,
      suffix
    ].filter(Boolean).join(' ');

    if (streetLine) {
      rows.push(`<div class="data-line addr-street">
        <span class="data-icon">📍</span>
        <div class="addr-cell">
          <span class="addr-tag">\u0423\u043b\u0438\u0446\u0430</span>
          <span class="addr-val">${this._esc(streetLine)}</span>
        </div>
      </div>`);
    }

    // Row 2: apt/unit (if any)
    if (aptUnit) {
      rows.push(`<div class="data-line addr-apt">
        <span class="data-icon">&nbsp;</span>
        <div class="addr-cell">
          <span class="addr-tag">\u041a\u0432\u0430\u0440\u0442\u0438\u0440\u0430</span>
          <span class="addr-val">${this._esc(aptUnit)}</span>
        </div>
      </div>`);
    }

    // Row 3: city + zip + state in one compact line
    const cityLine = [
      p.city ? `<span class="addr-city">${this._esc(p.city)}</span>` : '',
      p.zip  ? `<span class="addr-zip">${this._esc(p.zip)}</span>`   : '',
      p.state? `<span class="addr-state-badge">${this._esc(p.state)}</span>` : ''
    ].filter(Boolean).join('<span class="addr-sep">&nbsp;&bull;&nbsp;</span>');

    rows.push(`<div class="data-line addr-location">
      <span class="data-icon">&nbsp;</span>
      <div class="addr-city-row">${cityLine}</div>
    </div>`);

    return rows.join('');
  },

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /* ── Bind card events for dynamically rendered archive cards ─ */

  _bindCardEvents(container) {
    // Events are already bound by _buildCard; this is a no-op placeholder
    // because _buildCard binds listeners directly on each element.
  },

  /* ── Update secondaries badge counter in tab ──────────── */

  _updateSecondariesBadge() {
    const badge = document.getElementById('secondaries-badge');
    if (!badge) return;
    const parents = this.readyFulls.filter(f => f.status === 'done' && (f.parentId === null || f.parentId === undefined));
    const totalSlots = parents.length * 4;
    const usedSlots  = this.readyFulls.filter(f => f.parentId !== null && f.parentId !== undefined).length;
    const available  = totalSlots - usedSlots;
    if (available > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = available;
    } else {
      badge.style.display = 'none';
    }
  },

  /* ── Render Secondaries Page ────────────────────────── */

  renderSecondaries() {
    const container = document.getElementById('secondaries-container');
    if (!container) return;
    container.innerHTML = '';

    // Only parent cards that have status = done
    const parents = this.readyFulls.filter(
      f => f.status === 'done' && (f.parentId === null || f.parentId === undefined)
    );

    const allSecondaries = this.readyFulls.filter(f => f.parentId !== null && f.parentId !== undefined);
    const totalSlots  = parents.length * 4;
    const created     = allSecondaries.length;
    const available   = totalSlots - created;
    const secDone     = allSecondaries.filter(f => f.status === 'done').length;
    const secPending  = allSecondaries.filter(f => f.status === 'pending').length;
    const secRejected = allSecondaries.filter(f => f.status === 'rejected').length;

    // Stats bar
    const statsBar = document.createElement('div');
    statsBar.className = 'sec-stats-bar';
    statsBar.innerHTML = `
      <div class="sec-stat">
        <span class="sec-stat-value" style="color:var(--accent-light)">${available}</span>
        <span class="sec-stat-label">\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e</span>
      </div>
      <div class="sec-stat-divider"></div>
      <div class="sec-stat">
        <span class="sec-stat-value">${created}</span>
        <span class="sec-stat-label">\u0421\u043e\u0437\u0434\u0430\u043d\u043e</span>
      </div>
      <div class="sec-stat-divider"></div>
      <div class="sec-stat">
        <span class="sec-stat-value" style="color:var(--success)">${secDone}</span>
        <span class="sec-stat-label">\u0421\u0434\u0435\u043b\u0430\u043d\u043e</span>
      </div>
      <div class="sec-stat-divider"></div>
      <div class="sec-stat">
        <span class="sec-stat-value" style="color:var(--warning)">${secPending}</span>
        <span class="sec-stat-label">\u041f\u0435\u043d\u0434\u0438\u043d\u0433</span>
      </div>
      <div class="sec-stat-divider"></div>
      <div class="sec-stat">
        <span class="sec-stat-value" style="color:var(--danger)">${secRejected}</span>
        <span class="sec-stat-label">\u041e\u0442\u043a\u0430\u0437</span>
      </div>
    `;
    container.appendChild(statsBar);

    if (!parents.length) {
      container.innerHTML = `<div class="empty-state">Нет завершённых аккаунтов для создания вторяков.<br><small style="color:var(--text-muted);font-size:0.78rem">Отметьте карточку как «Сделано», чтобы она появилась здесь.</small></div>`;
      this._updateSecondariesBadge();
      return;
    }

    const statusIcon = (s) => {
      if (s === 'done')     return '✅';
      if (s === 'pending')  return '⏳';
      if (s === 'rejected') return '❌';
      return '🆕';
    };
    const statusLabel = (s) => ({
      done: 'Сделано', pending: 'Пендинг', rejected: 'Отказ'
    })[s] || 'Новая';

    parents.forEach(parent => {
      const secondaries = this.readyFulls.filter(f => f.parentId === parent.id);
      const createdCount = secondaries.length;

      const group = document.createElement('div');
      group.className = 'sec-group';

      // Header
      const header = document.createElement('div');
      header.className = 'sec-group-header';
      header.innerHTML = `
        <div class="sec-group-person">
          <span class="sec-group-avatar">${parent.personal.firstName[0]}${parent.personal.lastName[0]}</span>
          <div class="sec-group-info">
            <span class="sec-group-name">${this._esc(parent.personal.firstName)} ${this._esc(parent.personal.lastName)}</span>
            <span class="sec-group-meta">${this._esc(parent.personal.state)} &bull; ${parent.business ? this._esc(parent.business.companyName || '') : 'Без бизнеса'}</span>
          </div>
        </div>
        <div class="sec-group-counter">${createdCount}/4 вторяка</div>
      `;

      // Slots
      const slots = document.createElement('div');
      slots.className = 'sec-group-slots';

      for (let i = 1; i <= 4; i++) {
        const sec = secondaries.find(s => s.secondaryIndex === i);
        const slot = document.createElement('div');

        if (sec) {
          slot.className = 'sec-slot sec-slot-filled';
          slot.innerHTML = `
            <div class="sec-slot-num">${i}</div>
            <div class="sec-slot-icon">${statusIcon(sec.status)}</div>
            <div class="sec-slot-label">Вторяк ${i}</div>
            <div class="sec-slot-status">${statusLabel(sec.status)}</div>
          `;
          slot.addEventListener('click', () => {
            // Switch to processing tab and scroll
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-tab="processing"]').classList.add('active');
            document.getElementById('page-processing').classList.add('active');
            setTimeout(() => {
              const container2 = document.getElementById('ready-fulls-container');
              Array.from(container2.querySelectorAll('.result-card')).forEach(card => {
                const cardId = parseFloat(card.dataset.id);
                if (cardId === sec.id) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            }, 100);
          });
        } else if (i === createdCount + 1) {
          slot.className = 'sec-slot sec-slot-available';
          slot.innerHTML = `
            <div class="sec-slot-num">${i}</div>
            <div class="sec-slot-label">Вторяк ${i}</div>
            <button class="btn-sec-create">⊕ Создать</button>
          `;
          slot.querySelector('.btn-sec-create').addEventListener('click', async () => {
            await this.createSecondary(parent.id);
          });
        } else {
          slot.className = 'sec-slot sec-slot-locked';
          slot.innerHTML = `
            <div class="sec-slot-num">${i}</div>
            <div class="sec-slot-label">Вторяк ${i}</div>
            <div class="sec-slot-lock">🔒</div>
          `;
        }

        slots.appendChild(slot);
      }

      group.appendChild(header);
      group.appendChild(slots);
      container.appendChild(group);
    });

    this._updateSecondariesBadge();
  },

  /* ── Secondary Modal ───────────────────────────────────── */

  setupSecondaryModal() {
    const modal     = document.getElementById('modal-secondary');
    const closeBtn  = document.getElementById('secondary-modal-close');
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  },

  showSecondaryModal(fullId) {
    const modal      = document.getElementById('modal-secondary');
    const slotsEl    = document.getElementById('secondary-modal-slots');
    const titleEl    = document.getElementById('secondary-modal-title');
    const descEl     = document.getElementById('secondary-modal-desc');

    const full = this.readyFulls.find(f => f.id === fullId);
    if (!full) return;

    const existingCount = this.readyFulls.filter(f => f.parentId === fullId).length;
    const remaining = 4 - existingCount;

    titleEl.textContent = `Аккаунт зарегистрирован! ${full.personal.firstName} ${full.personal.lastName}`;
    descEl.textContent  = remaining > 0
      ? `Доступно создание вторяка${remaining > 1 ? 'ов' : 'а'} (${remaining} из 4)`
      : 'Все 4 вторяка уже созданы';

    slotsEl.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
      const isCreated = i <= existingCount;
      const isNext    = i === existingCount + 1;
      const canCreate = remaining > 0 && isNext;

      const slot = document.createElement('div');
      slot.className = `secondary-slot ${isCreated ? 'slot-created' : ''} ${canCreate ? 'slot-available' : ''} ${!isCreated && !canCreate ? 'slot-locked' : ''}`;

      if (isCreated) {
        const sec = this.readyFulls.find(f => f.parentId === fullId && f.secondaryIndex === i);
        const statusIcon = sec?.status === 'done' ? '✅' : sec?.status === 'pending' ? '⏳' : sec?.status === 'rejected' ? '❌' : '🆕';
        const statusText = sec?.status ? ({done:'Сделано',pending:'Пендинг',rejected:'Отказ'}[sec.status]) : 'Новая';
        slot.innerHTML = `
          <div class="slot-label">Вторяк ${i}</div>
          <div class="slot-status">${statusIcon} ${statusText}</div>
        `;
      } else if (canCreate) {
        slot.innerHTML = `
          <div class="slot-label">Вторяк ${i}</div>
          <button class="btn-slot-create" data-parent-id="${fullId}">⊕ Создать</button>
        `;
        slot.querySelector('.btn-slot-create').addEventListener('click', async () => {
          await this.createSecondary(fullId);
          modal.style.display = 'none';
        });
      } else {
        slot.innerHTML = `
          <div class="slot-label">Вторяк ${i}</div>
          <div class="slot-locked-icon">🔒</div>
        `;
      }

      slotsEl.appendChild(slot);
    }

    modal.style.display = 'flex';
  }
};

// ── Bootstrap ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
