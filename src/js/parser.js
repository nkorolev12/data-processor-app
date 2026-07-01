// ── Data Parsers ──────────────────────────────────────────────

const DataParser = {

  /**
   * Parse a personal full line.
   * Format: DOB,SSN,FirstName,MiddleName,LastName,Address,City,ZIP,State,State2,Email,Phone,Extra
   * Middle name is discarded.
   */
  parsePersonalFull(line) {
    const parts = line.split(',');
    if (parts.length < 13) return null;

    const firstName = parts[2].trim();
    const lastName  = parts[4].trim();
    if (!firstName || !lastName) return null;

    return {
      raw:       line.trim(),
      dob:       parts[0].trim(),
      ssn:       parts[1].trim(),
      firstName,
      lastName,
      address:   parts[5].trim(),
      city:      parts[6].trim(),
      zip:       parts[7].trim(),
      state:     parts[8].trim().toUpperCase(),
      email:     parts[10].trim(),
      phone:     parts[11].trim(),
      extra:     parts[12].trim(),
      used:      false
    };
  },

  /**
   * Parse a business full line.
   * Format: COMPANY NAME, LLC  EIN  DATE
   * Fields are separated by 2+ consecutive spaces.
   */
  parseBusinessFull(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Split by 2+ whitespace characters
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length < 3) return null;

    return {
      raw:         trimmed,
      companyName: parts[0].trim(),
      ein:         parts[1].trim(),
      date:        parts[2].trim(),
      used:        false
    };
  },

  /**
   * Parse an email line.
   * Format: email:password
   */
  parseEmail(line) {
    const trimmed = line.trim();
    const idx = trimmed.indexOf(':');
    if (idx === -1) return null;

    const email    = trimmed.substring(0, idx).trim();
    const password = trimmed.substring(idx + 1).trim();
    if (!email || !password) return null;

    return {
      raw:      trimmed,
      email,
      password,
      used:     false
    };
  }
};
