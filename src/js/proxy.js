// ── Proxy Generator ───────────────────────────────────────────

const ProxyGenerator = {

  /** State code → full lowercase name (as used by proxy services) */
  STATE_MAP: {
    'AK': 'alaska', 'AL': 'alabama', 'AR': 'arkansas', 'AZ': 'arizona', 'CA': 'california',
    'CO': 'colorado', 'CT': 'connecticut', 'DC': 'washingtondc', 'DE': 'delaware', 'FL': 'florida',
    'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana',
    'IA': 'iowa', 'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'MA': 'massachusetts',
    'MD': 'maryland', 'ME': 'maine', 'MI': 'michigan', 'MN': 'minnesota', 'MO': 'missouri',
    'MS': 'mississippi', 'MT': 'montana', 'NC': 'northcarolina', 'ND': 'northdakota',
    'NE': 'nebraska', 'NH': 'newhampshire', 'NJ': 'newjersey', 'NM': 'newmexico',
    'NV': 'nevada', 'NY': 'newyork', 'OH': 'ohio', 'OK': 'oklahoma', 'OR': 'oregon',
    'PA': 'pennsylvania', 'RI': 'rhodeisland', 'SC': 'southcarolina', 'SD': 'southdakota',
    'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VA': 'virginia', 'VT': 'vermont',
    'WA': 'washington', 'WI': 'wisconsin', 'WV': 'westvirginia', 'WY': 'wyoming'
  },

  /**
   * CoreProxy — для создания почты
   * Format: resi.coreproxy.io:32325:207438cdfbc4:2216fe4bab7a_country-us_state-{state}_session-{token}_lifetime-30m
   */
  generateCoreProxy(stateCode) {
    const state = this.STATE_MAP[stateCode.toUpperCase()] || stateCode.toLowerCase();
    const token = DataUtils.generateToken(10, 15);
    return `resi.coreproxy.io:32325:207438cdfbc4:2216fe4bab7a_country-us_state-${state}_session-${token}_lifetime-30m`;
  },

  /**
   * FlashProxy — для регистрации BOA
   * Format: adam.flashproxy.io:1080:yezrwnhnxwfk-country-US-state-{state}-speed-fast-pool-unlocked-session-{token}-time-long:mihe6hpqdspy
   */
  generateFlashProxy(stateCode) {
    const state = this.STATE_MAP[stateCode.toUpperCase()] || stateCode.toLowerCase();
    const token = DataUtils.generateToken(10, 15);
    return `adam.flashproxy.io:1080:yezrwnhnxwfk-country-US-state-${state}-speed-fast-pool-unlocked-session-${token}-time-long:mihe6hpqdspy`;
  }
};
