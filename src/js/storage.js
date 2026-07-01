// ── Data Storage (via Electron IPC) ──────────────────────────

const DataStorage = {

  async loadData(filename) {
    const data = await window.electronAPI.readData(filename);
    return data;
  },

  async saveData(filename, data) {
    return await window.electronAPI.writeData(filename, data);
  },

  // ── Convenience wrappers ──

  async loadPersonalFulls()          { return (await this.loadData('personal_fulls.json')) || []; },
  async savePersonalFulls(data)      { return this.saveData('personal_fulls.json', data); },

  async loadBusinessFulls()          { return (await this.loadData('business_fulls.json')) || []; },
  async saveBusinessFulls(data)      { return this.saveData('business_fulls.json', data); },

  async loadEmails()                 { return (await this.loadData('emails.json')) || []; },
  async saveEmails(data)             { return this.saveData('emails.json', data); },

  async loadReadyFulls()             { return (await this.loadData('ready_fulls.json')) || []; },
  async saveReadyFulls(data)         { return this.saveData('ready_fulls.json', data); },

  async loadStatistics()             { return (await this.loadData('statistics.json')) || {}; },
  async saveStatistics(data)         { return this.saveData('statistics.json', data); }
};
