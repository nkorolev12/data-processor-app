// ── Proxy Generator ───────────────────────────────────────────

const ProxyGenerator = {

  /** State code → full lowercase name (as used by proxy services) */
  STATE_MAP: {
    'AL': 'alabama',       'AK': 'alaska',        'AZ': 'arizona',
    'AR': 'arkansas',      'CA': 'california',     'CO': 'colorado',
    'CT': 'connecticut',   'DE': 'delaware',       'FL': 'florida',
    'GA': 'georgia',       'HI': 'hawaii',         'ID': 'idaho',
    'IL': 'illinois',      'IN': 'indiana',        'IA': 'iowa',
    'KS': 'kansas',        'KY': 'kentucky',       'LA': 'louisiana',
    'ME': 'maine',         'MD': 'maryland',       'MA': 'massachusetts',
    'MI': 'michigan',      'MN': 'minnesota',      'MS': 'mississippi',
    'MO': 'missouri',      'MT': 'montana',        'NE': 'nebraska',
    'NV': 'nevada',        'NH': 'newhampshire',   'NJ': 'newjersey',
    'NM': 'newmexico',     'NY': 'newyork',        'NC': 'northcarolina',
    'ND': 'northdakota',   'OH': 'ohio',           'OK': 'oklahoma',
    'OR': 'oregon',        'PA': 'pennsylvania',   'RI': 'rhodeisland',
    'SC': 'southcarolina', 'SD': 'southdakota',    'TN': 'tennessee',
    'TX': 'texas',         'UT': 'utah',           'VT': 'vermont',
    'VA': 'virginia',      'WA': 'washington',     'WV': 'westvirginia',
    'WI': 'wisconsin',     'WY': 'wyoming',        'DC': 'districtofcolumbia'
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
