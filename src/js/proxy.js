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

  /** Generate a random alphanumeric session token */
  _randomSession(len = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  },

  /** Map state code to snake_case region used by proxy-man */
  REGION_MAP: {
    'AK': 'alaska', 'AL': 'alabama', 'AR': 'arkansas', 'AZ': 'arizona', 'CA': 'california',
    'CO': 'colorado', 'CT': 'connecticut', 'DC': 'washington_dc', 'DE': 'delaware', 'FL': 'florida',
    'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana',
    'IA': 'iowa', 'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'MA': 'massachusetts',
    'MD': 'maryland', 'ME': 'maine', 'MI': 'michigan', 'MN': 'minnesota', 'MO': 'missouri',
    'MS': 'mississippi', 'MT': 'montana', 'NC': 'north_carolina', 'ND': 'north_dakota',
    'NE': 'nebraska', 'NH': 'new_hampshire', 'NJ': 'new_jersey', 'NM': 'new_mexico',
    'NV': 'nevada', 'NY': 'new_york', 'OH': 'ohio', 'OK': 'oklahoma', 'OR': 'oregon',
    'PA': 'pennsylvania', 'RI': 'rhode_island', 'SC': 'south_carolina', 'SD': 'south_dakota',
    'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VA': 'virginia', 'VT': 'vermont',
    'WA': 'washington', 'WI': 'wisconsin', 'WV': 'west_virginia', 'WY': 'wyoming'
  },

  /**
   * EmailProxy — для создания почты (geo.g-w.info)
   * Format: socks5://user-nSnoq6CCVLgaxmpG-type-residential-session-{SESSION}-country-US-state-{state}-rotation-20-udp-1:2ssv7poW4xbYIfqo@geo.g-w.info:10800
   */
  generateEmailProxy(stateCode) {
    const state   = this.STATE_MAP[stateCode.toUpperCase()] || stateCode.toLowerCase();
    const session = this._randomSession(10);
    return `socks5://user-nSnoq6CCVLgaxmpG-type-residential-session-${session}-country-US-state-${state}-rotation-20-udp-1:2ssv7poW4xbYIfqo@geo.g-w.info:10800`;
  },

  /**
   * FlashProxy — для регистрации BOA
   * Format: proxy.psbproxy.io:12321:d848096630c24e71811fe26e7257cc:Opad42F6YHGJVmRU_country-us_state-{state}_session-{sid}_lifetime-30m
   */
  generateFlashProxy(stateCode) {
    const state = this.STATE_MAP[stateCode.toUpperCase()] || stateCode.toLowerCase();
    const sid = this._randomSession(8);
    return `proxy.psbproxy.io:12321:d848096630c24e71811fe26e7257cc:Opad42F6YHGJVmRU_country-us_state-${state}_session-${sid}_lifetime-30m`;
  },

  /** @deprecated Legacy alias kept for old card data compatibility */
  generateCoreProxy(stateCode) {
    return this.generateEmailProxy(stateCode);
  }
};
