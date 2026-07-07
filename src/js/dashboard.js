// ── Dashboard Manager ─────────────────────────────────────────

const DashboardManager = {
  stats: {},

  async init() {
    this.stats = await DataStorage.loadStatistics();
    document.getElementById('period-select').addEventListener('change', () => this.refresh());
  },

  async refresh() {
    this.stats = await DataStorage.loadStatistics();
    this.renderKPI();
    this.renderChart();
    this.renderTable();
    await this.renderTodayCards();
  },

  /* ── KPI Cards ─────────────────────────────────────────── */

  renderKPI() {
    const today = DataUtils.getTodayDate();
    const s = this.stats[today] || { total: 0, done: 0, pending: 0, rejected: 0 };

    this._animateValue('kpi-total',    s.total);
    this._animateValue('kpi-done',     s.done);
    this._animateValue('kpi-pending',  s.pending);
    this._animateValue('kpi-rejected', s.rejected);
  },

  /** Animate a numeric value from current to target */
  _animateValue(elementId, target) {
    const el = document.getElementById(elementId);
    const current = parseInt(el.textContent) || 0;
    if (current === target) { el.textContent = target; return; }

    const duration = 400;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(current + (target - current) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  },

  /* ── Chart ─────────────────────────────────────────────── */

  getDateRange(days) {
    const dates = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  },

  renderChart() {
    const canvas = document.getElementById('chart-canvas');
    const ctx    = canvas.getContext('2d');
    const period = parseInt(document.getElementById('period-select').value);
    const dates  = this.getDateRange(period);

    // High-DPI support
    const wrapper = canvas.parentElement;
    const dpr     = window.devicePixelRatio || 1;
    const w       = wrapper.clientWidth;
    const h       = 300;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const pad = { top: 40, right: 24, bottom: 56, left: 46 };
    const cw  = w - pad.left - pad.right;
    const ch  = h - pad.top  - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Collect data
    const data   = dates.map(d => this.stats[d] || { total: 0, done: 0, pending: 0, rejected: 0 });
    const maxVal = Math.max(1, ...data.flatMap(d => [d.total, d.done, d.pending, d.rejected]));

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth   = 1;
    const gridN = 5;
    for (let i = 0; i <= gridN; i++) {
      const y = pad.top + (ch / gridN) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      // Y-axis label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font      = '11px Inter, sans-serif';
      ctx.textAlign  = 'right';
      ctx.fillText(Math.round(maxVal - (maxVal / gridN) * i), pad.left - 8, y + 4);
    }

    // Series
    const series = [
      { key: 'total',    color: '#7c3aed', label: 'Всего'   },
      { key: 'done',     color: '#10b981', label: 'Сделано'  },
      { key: 'pending',  color: '#f59e0b', label: 'Пендинг'  },
      { key: 'rejected', color: '#ef4444', label: 'Отказ'    }
    ];

    const groupW  = cw / dates.length;
    const barW    = Math.max(3, Math.min(14, groupW * 0.16));
    const barGap  = Math.max(1, barW * 0.25);

    // Draw bars
    dates.forEach((_date, i) => {
      const d      = data[i];
      const cx     = pad.left + groupW * i + groupW / 2;
      const totalW = series.length * barW + (series.length - 1) * barGap;
      const startX = cx - totalW / 2;

      series.forEach((s, si) => {
        const bx = startX + si * (barW + barGap);
        const bh = Math.max(0, (d[s.key] / maxVal) * ch);
        const by = pad.top + ch - bh;
        const r  = Math.min(barW / 2, 3);

        ctx.fillStyle = s.color;
        ctx.beginPath();
        if (bh < r * 2) {
          ctx.fillRect(bx, by, barW, bh);
        } else {
          ctx.moveTo(bx + r, by);
          ctx.arcTo(bx + barW, by, bx + barW, by + bh, r);
          ctx.arcTo(bx + barW, pad.top + ch, bx, pad.top + ch, 0);
          ctx.arcTo(bx, pad.top + ch, bx, by, 0);
          ctx.arcTo(bx, by, bx + barW, by, r);
          ctx.closePath();
          ctx.fill();
        }
      });

      // X-axis label
      ctx.fillStyle  = 'rgba(255, 255, 255, 0.35)';
      ctx.font       = '10px Inter, sans-serif';
      ctx.textAlign  = 'center';
      const [, m, day] = _date.split('-');
      ctx.save();
      ctx.translate(cx, h - pad.bottom + 18);
      if (period > 14) ctx.rotate(-Math.PI / 5);
      ctx.fillText(`${day}.${m}`, 0, 0);
      ctx.restore();
    });

    // Legend
    let lx = pad.left;
    const ly = 18;
    ctx.font      = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    series.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(lx + 5, ly - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(s.label, lx + 14, ly + 2);
      lx += ctx.measureText(s.label).width + 32;
    });
  },

  /* ── History Table ─────────────────────────────────────── */

  /* ── History Table ─────────────────────────────────────── */

  renderTable() {
    const tbody  = document.getElementById('stats-table-body');
    const period = parseInt(document.getElementById('period-select').value);
    const dates  = this.getDateRange(period).reverse(); // newest first

    tbody.innerHTML = '';

    let hasData = false;
    for (const date of dates) {
      const d = this.stats[date];
      if (!d) continue;
      hasData = true;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${DataUtils.formatDate(date)}</td>
        <td>${d.total}</td>
        <td class="stat-done">${d.done}</td>
        <td class="stat-pending">${d.pending}</td>
        <td class="stat-rejected">${d.rejected}</td>
      `;
      tbody.appendChild(tr);
    }

    if (!hasData) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-table">Нет данных за выбранный период</td></tr>';
    }
  },

  /* ── Today's Cards List ───────────────────────────────────── */

  async renderTodayCards() {
    const container = document.getElementById('today-cards-list');
    if (!container) return;

    const readyFulls = await DataStorage.loadReadyFulls();
    const statusLabel = { done: 'Сделано', pending: 'Пендинг', rejected: 'Отказ' };

    // Filter: have a status AND were created today (MSK)
    const todayCards = readyFulls.filter(f => f.status && App && App.isCurrentWorkDay(f.createdAt));

    if (!todayCards.length) {
      container.innerHTML = '<div class="today-cards-empty">Нет карточек за сегодняшний рабочий день</div>';
      return;
    }

    // Sort oldest first so #1 is the first card of the day
    const sorted = [...todayCards].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    container.innerHTML = sorted.map((f, idx) => {
      const num    = idx + 1;
      const name   = `${f.personal?.firstName || ''} ${f.personal?.lastName || ''}`.trim();
      const status = f.status;
      const label  = statusLabel[status] || status;
      return `
        <div class="today-card-row">
          <span class="today-card-num">#${num}</span>
          <span class="today-card-name">${name}</span>
          <span class="today-card-status ${status}">${label}</span>
        </div>`;
    }).join('');
  }
};
