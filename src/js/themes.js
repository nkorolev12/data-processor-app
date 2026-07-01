// ── Theme & Zoom Manager ──────────────────────────────────────

const ThemeManager = {

  themes: {
    'dark-purple': {
      '--bg-primary':     '#0a0a0f',
      '--bg-secondary':   '#111118',
      '--bg-surface':     '#16161f',
      '--accent':         '#7c3aed',
      '--accent-light':   '#a78bfa',
      '--accent-glow':    'rgba(124, 58, 237, 0.35)',
      '--gradient':       'linear-gradient(135deg, #7c3aed, #3b82f6)',
      '--gradient-hover': 'linear-gradient(135deg, #8b5cf6, #60a5fa)',
      '--btn-create-bg':  'linear-gradient(135deg, #7c3aed, #3b82f6)',
      '--btn-create-opacity': '1',
    },
    'ocean-blue': {
      '--bg-primary':     '#040d18',
      '--bg-secondary':   '#081526',
      '--bg-surface':     '#0d1f35',
      '--accent':         '#0ea5e9',
      '--accent-light':   '#38bdf8',
      '--accent-glow':    'rgba(14, 165, 233, 0.35)',
      '--gradient':       'linear-gradient(135deg, #0ea5e9, #6366f1)',
      '--gradient-hover': 'linear-gradient(135deg, #38bdf8, #818cf8)',
      '--btn-create-bg':  'linear-gradient(135deg, #0369a1, #4338ca)',
      '--btn-create-opacity': '0.82',
    },
    'matrix-green': {
      '--bg-primary':     '#030a03',
      '--bg-secondary':   '#061206',
      '--bg-surface':     '#0a1c0a',
      '--accent':         '#22c55e',
      '--accent-light':   '#4ade80',
      '--accent-glow':    'rgba(34, 197, 94, 0.35)',
      '--gradient':       'linear-gradient(135deg, #16a34a, #22c55e)',
      '--gradient-hover': 'linear-gradient(135deg, #22c55e, #4ade80)',
      '--btn-create-bg':  'linear-gradient(135deg, #166534, #15803d)',
      '--btn-create-opacity': '0.82',
    },
    'sunset-orange': {
      '--bg-primary':     '#0f0806',
      '--bg-secondary':   '#1a0d0a',
      '--bg-surface':     '#24120e',
      '--accent':         '#f97316',
      '--accent-light':   '#fb923c',
      '--accent-glow':    'rgba(249, 115, 22, 0.35)',
      '--gradient':       'linear-gradient(135deg, #f97316, #ec4899)',
      '--gradient-hover': 'linear-gradient(135deg, #fb923c, #f472b6)',
      '--btn-create-bg':  'linear-gradient(135deg, #c2410c, #9d174d)',
      '--btn-create-opacity': '0.82',
    },
    'midnight': {
      '--bg-primary':     '#050507',
      '--bg-secondary':   '#09090e',
      '--bg-surface':     '#0d0d14',
      '--accent':         '#64748b',
      '--accent-light':   '#94a3b8',
      '--accent-glow':    'rgba(100, 116, 139, 0.35)',
      '--gradient':       'linear-gradient(135deg, #475569, #64748b)',
      '--gradient-hover': 'linear-gradient(135deg, #64748b, #94a3b8)',
      '--btn-create-bg':  'linear-gradient(135deg, #334155, #475569)',
      '--btn-create-opacity': '1',
    },
    'rose': {
      '--bg-primary':     '#0f080d',
      '--bg-secondary':   '#1a0d15',
      '--bg-surface':     '#22101c',
      '--accent':         '#e11d48',
      '--accent-light':   '#fb7185',
      '--accent-glow':    'rgba(225, 29, 72, 0.35)',
      '--gradient':       'linear-gradient(135deg, #be123c, #e11d48)',
      '--gradient-hover': 'linear-gradient(135deg, #e11d48, #fb7185)',
      '--btn-create-bg':  'linear-gradient(135deg, #9f1239, #be123c)',
      '--btn-create-opacity': '0.82',
    },
    'nord': {
      '--bg-primary':     '#060c12',
      '--bg-secondary':   '#0d1520',
      '--bg-surface':     '#131e2e',
      '--accent':         '#5e81ac',
      '--accent-light':   '#81a1c1',
      '--accent-glow':    'rgba(94, 129, 172, 0.35)',
      '--gradient':       'linear-gradient(135deg, #4c6a8c, #5e81ac)',
      '--gradient-hover': 'linear-gradient(135deg, #5e81ac, #81a1c1)',
      '--btn-create-bg':  'linear-gradient(135deg, #3b5470, #4c6a8c)',
      '--btn-create-opacity': '0.82',
    },
    'cyber': {
      '--bg-primary':     '#04080f',
      '--bg-secondary':   '#060e1a',
      '--bg-surface':     '#091525',
      '--accent':         '#facc15',
      '--accent-light':   '#fde047',
      '--accent-glow':    'rgba(250, 204, 21, 0.3)',
      '--gradient':       'linear-gradient(135deg, #ca8a04, #facc15)',
      '--gradient-hover': 'linear-gradient(135deg, #facc15, #fde047)',
      '--btn-create-bg':  'linear-gradient(135deg, #a16207, #ca8a04)',
      '--btn-create-opacity': '0.85',
    },
  },

  zoomLevels: [75, 90, 110, 125, 150, 175],

  init() {
    const savedTheme = localStorage.getItem('dp-theme') || 'dark-purple';
    const savedZoom  = parseInt(localStorage.getItem('dp-zoom') || '110', 10);
    this.applyTheme(savedTheme, false);
    this.applyZoom(savedZoom, false);
    this._setupPanel();
  },

  applyTheme(name, save = true) {
    const vars = this.themes[name];
    if (!vars) return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (save) localStorage.setItem('dp-theme', name);
    document.querySelectorAll('.theme-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.theme === name)
    );
  },

  applyZoom(percent, save = true) {
    document.documentElement.style.zoom = (percent / 100).toString();
    if (save) localStorage.setItem('dp-zoom', String(percent));
    const el = document.getElementById('zoom-value');
    if (el) el.textContent = `${percent}%`;
    const decBtn = document.getElementById('zoom-decrease');
    const incBtn = document.getElementById('zoom-increase');
    if (decBtn) decBtn.disabled = percent <= this.zoomLevels[0];
    if (incBtn) incBtn.disabled = percent >= this.zoomLevels[this.zoomLevels.length - 1];
  },

  _setupPanel() {
    const toggleBtn = document.getElementById('btn-settings');
    const panel     = document.getElementById('settings-panel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== toggleBtn) {
        panel.classList.remove('open');
      }
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => this.applyTheme(btn.dataset.theme));
    });

    document.getElementById('zoom-decrease').addEventListener('click', () => {
      const cur = parseInt(localStorage.getItem('dp-zoom') || '100', 10);
      const idx = this.zoomLevels.indexOf(cur);
      if (idx > 0) this.applyZoom(this.zoomLevels[idx - 1]);
    });

    document.getElementById('zoom-increase').addEventListener('click', () => {
      const cur = parseInt(localStorage.getItem('dp-zoom') || '100', 10);
      const idx = this.zoomLevels.indexOf(cur);
      if (idx < this.zoomLevels.length - 1) this.applyZoom(this.zoomLevels[idx + 1]);
    });
  },
};
