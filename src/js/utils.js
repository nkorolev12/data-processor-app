// ── Utility Functions ─────────────────────────────────────────

const DataUtils = {

  /** Generate a random alphanumeric token (a-zA-Z0-9), length between min and max */
  generateToken(minLen = 10, maxLen = 15) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /** Copy text to clipboard and show toast */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      DataUtils.showToast('Скопировано! ✓');
    }).catch(() => {
      // Fallback for older Electron versions
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      DataUtils.showToast('Скопировано! ✓');
    });
  },

  /** Show a toast notification */
  showToast(message, duration = 2200) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
  },

  /** Today as YYYY-MM-DD */
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  },

  /** YYYY-MM-DD → DD.MM.YYYY */
  formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  }
};
