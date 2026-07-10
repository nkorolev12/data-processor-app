// ── Data Parsers ──────────────────────────────────────────────

const DataParser = {

  /**
   * Proper CSV line parser — handles quoted fields with commas inside.
   * e.g. "1610 North Interstate 35, Apt 417" → single field.
   */
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  },

  /**
   * Converts a name to Title Case.
   * Handles ALL_CAPS and all_lowercase.
   * e.g. "JULIANA" → "Juliana", "BARCENAS" → "Barcenas"
   * Mixed-case names (already proper) are left untouched.
   */
  _toTitleCase(str) {
    if (!str) return str;
    // If already mixed case — leave it (e.g. "McDonald" stays "McDonald")
    if (str !== str.toUpperCase() && str !== str.toLowerCase()) return str;
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Parse a personal full line. Supports multiple formats:
   *
   * Format A (13 fields — original with State2 and bank):
   *   DOB,SSN,First,Middle,Last,Address,City,ZIP,State,State2,Email,Phone,Extra
   *
   * Format B (12 fields — without bank, with State2):
   *   DOB,SSN,First,Middle,Last,Address,City,ZIP,State,State2,Email,Phone
   *
   * Format C (11 fields — most common new format):
   *   DOB,SSN,First,Middle,Last,Address,City,ZIP,State,Email,Phone
   *   Middle CAN be empty, single letter, or full word.
   *   Detected by: parts[9] contains '@'
   *
   * Format D (10 fields — no middle name):
   *   DOB,SSN,First,Last,Address,City,ZIP,State,Email,Phone
   *   Detected by: parts[8] contains '@'
   *
   * Uses proper CSV parsing to handle quoted fields (addresses with commas).
   */
  parsePersonalFull(line) {
    if (!line || !line.trim()) return null;

    // ── Colon-separated format detection
    // Format: FirstName [Middle]:LastName:Address:City:ZIP:State:SSN:DOB
    // e.g. "Lindsey Nicole:Casas:9430 Tranquil Park Dr:San Antonio:78254:TX:632-66-9207:04/17/1999"
    if (line.includes(':') && !line.includes(',')) {
      const colonParts = line.trim().split(':');
      // Expect exactly 8 colon-delimited fields
      if (colonParts.length === 8) {
        const firstRaw = colonParts[0].trim().split(/\s+/);
        const firstName = this._toTitleCase(firstRaw[0]);
        const lastName  = this._toTitleCase(colonParts[1].trim());
        if (firstName && lastName) {
          return {
            raw:       line.trim(),
            dob:       colonParts[7].trim(),
            ssn:       colonParts[6].trim(),
            firstName,
            lastName,
            address:   colonParts[2].trim(),
            city:      colonParts[3].trim(),
            zip:       colonParts[4].trim(),
            state:     colonParts[5].trim().toUpperCase(),
            email:     '',
            phone:     '',
            extra:     '',
            used:      false
          };
        }
      }
    }

    const parts = this._parseCSVLine(line);
    const len   = parts.length;

    if (len < 10) return { error: `Слишком мало полей (найдено ${len}, нужно 10+)` };

    // Common validations
    const isValidSSN = s => s && (s.includes('-') || s.replace(/\D/g, '').length === 9);
    
    // ── Format A: 13+ fields (original with State2 + bank)
    if (len >= 13) {
      if (!isValidSSN(parts[1])) return { error: 'Неверный формат SSN (формат 13+ полей)' };
      const firstName = this._toTitleCase(parts[2]);
      const lastName  = this._toTitleCase(parts[4]);
      if (!firstName || !lastName) return { error: 'Отсутствует имя или фамилия' };
      return {
        raw:       line.trim(),
        dob:       parts[0],
        ssn:       parts[1],
        firstName,
        lastName,
        address:   parts[5],
        city:      parts[6],
        zip:       parts[7],
        state:     parts[8].toUpperCase(),
        email:     parts[10],
        phone:     parts[11],
        extra:     parts[12] || '',
        used:      false
      };
    }

    // ── Format B: 12 fields (State2, no bank). Email at index 10.
    if (len === 12) {
      if (!isValidSSN(parts[1])) return { error: 'Неверный формат SSN (формат 12 полей)' };
      const firstName = this._toTitleCase(parts[2]);
      const lastName  = this._toTitleCase(parts[4]);
      if (!firstName || !lastName) return { error: 'Отсутствует имя или фамилия' };
      return {
        raw:       line.trim(),
        dob:       parts[0],
        ssn:       parts[1],
        firstName,
        lastName,
        address:   parts[5],
        city:      parts[6],
        zip:       parts[7],
        state:     parts[8].toUpperCase(),
        email:     parts[10],
        phone:     parts[11],
        extra:     '',
        used:      false
      };
    }

    // ── Format C: 11 fields. Email at index 9, Phone at 10.
    // DOB,SSN,First,Middle,Last,Address,City,ZIP,State,Email,Phone
    if (len === 11) {
      if (!isValidSSN(parts[1])) return { error: 'Неверный формат SSN (формат 11 полей)' };
      const firstName = this._toTitleCase(parts[2]);
      const lastName  = this._toTitleCase(parts[4]);
      if (!firstName || !lastName) return { error: 'Отсутствует имя или фамилия' };
      return {
        raw:       line.trim(),
        dob:       parts[0],
        ssn:       parts[1],
        firstName,
        lastName,
        address:   parts[5],
        city:      parts[6],
        zip:       parts[7],
        state:     parts[8].toUpperCase(),
        email:     parts[9],
        phone:     parts[10],
        extra:     '',
        used:      false
      };
    }

    // ── Format D: 10 fields, no middle name. Email at index 8.
    // DOB,SSN,First,Last,Address,City,ZIP,State,Email,Phone
    if (len === 10) {
      if (!isValidSSN(parts[1])) return { error: 'Неверный формат SSN (формат 10 полей)' };
      const firstName = this._toTitleCase(parts[2]);
      const lastName  = this._toTitleCase(parts[3]);
      if (!firstName || !lastName) return { error: 'Отсутствует имя или фамилия' };
      return {
        raw:       line.trim(),
        dob:       parts[0],
        ssn:       parts[1],
        firstName,
        lastName,
        address:   parts[4],
        city:      parts[5],
        zip:       parts[6],
        state:     parts[7].toUpperCase(),
        email:     parts[8],
        phone:     parts[9],
        extra:     '',
        used:      false
      };
    }

    return { error: 'Неизвестный формат строки' };
  },

  /**
   * Parse a business full line.
   * Format: COMPANY NAME, LLC  EIN  DATE
   * Fields are separated by 2+ consecutive spaces.
   */
  parseBusinessFull(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Try finding EIN (XX-XXXXXXX) and Date (MM/DD/YYYY) anywhere in the string
    const einMatch = trimmed.match(/\b(\d{2}-\d{7})\b/);
    const dateMatch = trimmed.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);

    if (einMatch && dateMatch) {
      // Company name is everything before the EIN
      let companyName = trimmed.substring(0, einMatch.index).trim();
      
      // Clean up any trailing commas or hyphens from company name
      companyName = companyName.replace(/[,;-]+$/, '').trim();

      return {
        raw:         trimmed,
        companyName: companyName,
        ein:         einMatch[1],
        date:        dateMatch[1],
        used:        false
      };
    }

    // Fallback: CSV format fallback
    const csvParts = this._parseCSVLine(trimmed);
    if (csvParts.length >= 3) {
      if (csvParts[1].match(/^\d{2}-\d{7}$/)) {
        return {
          raw:         trimmed,
          companyName: csvParts[0].trim(),
          ein:         csvParts[1].trim(),
          date:        csvParts[2].trim(),
          used:        false
        };
      }
    }

    return { error: 'Не удалось найти EIN (XX-XXXXXXX) или дату' };
  },

  /**
   * Parse a multiline personal block.
   * Format (each on its own line, blocks separated by blank lines):
   *   7028261439
   *   Stephanie Scott
   *   Apr 1997               (ignored)
   *   3319 Esters Rd #1093
   *   Irving, TX 75062
   *   Dallas County          (ignored)
   *   (Nov 2023 - Apr 2026)  (ignored)
   *   xcstephanie13@yahoo.com
   *   SSN: 321-94-8574
   *   DOB: 04/06/1997
   */
  parseMultilinePersonalBlock(block) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 4) return null;

    let ssn = '', dob = '', email = '', phone = '', firstName = '', lastName = '',
        address = '', city = '', state = '', zip = '';

    for (const line of lines) {
      // SSN line
      if (/^SSN[:\s]/i.test(line)) {
        ssn = line.replace(/^SSN[:\s]+/i, '').trim();
        continue;
      }
      // DOB line
      if (/^DOB[:\s]/i.test(line)) {
        dob = line.replace(/^DOB[:\s]+/i, '').trim();
        continue;
      }
      // Email
      if (line.includes('@')) {
        email = line.trim();
        continue;
      }
      // Skip date ranges like (Nov 2023 - Apr 2026)
      if (/^\(/.test(line)) continue;
      // Skip county lines
      if (/county/i.test(line)) continue;
      // Skip lines that look like "Month YYYY" alone
      if (/^[A-Za-z]+ \d{4}$/.test(line)) continue;
      // Phone: 10 digits or formatted
      if (!phone && /^[\d()+\-\s]{7,15}$/.test(line) && line.replace(/\D/g,'').length >= 7) {
        phone = line.replace(/\D/g, '');
        continue;
      }
      // City, State ZIP: "Irving, TX 75062"
      const cityMatch = line.match(/^(.+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (cityMatch) {
        city  = cityMatch[1].trim();
        state = cityMatch[2].trim();
        zip   = cityMatch[3].trim();
        continue;
      }
      // Name: two or more words starting with capital (allows initials like "C")
      if (!firstName && /^[A-Z][a-z]*(?:\s+[A-Z][a-z]*)+$/.test(line) && !line.includes(',')) {
        const parts = line.trim().split(/\s+/);
        firstName = this._toTitleCase(parts[0]);
        lastName  = this._toTitleCase(parts[parts.length - 1]);
        continue;
      }
      // Address: starts with a number
      if (!address && /^\d/.test(line)) {
        address = line;
        continue;
      }
    }

    if (!firstName || !lastName || !ssn || !dob) return null;

    return {
      raw:       block.replace(/\n/g, ' | ').trim(),
      dob,
      ssn,
      firstName,
      lastName,
      address,
      city,
      zip,
      state:     state.toUpperCase(),
      email,
      phone,
      extra:     '',
      used:      false
    };
  },

  /**
   * Parse a multiline business block.
   * Format:
   *   ACHANES LLC
   *
   *   EIN Number 25-0389230
   *   Date Filed 03/13/2023
   */
  parseMultilineBusinessBlock(block) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    let companyName = '', ein = '', date = '';

    for (const line of lines) {
      // EIN line
      if (/^EIN\s*(Number|#|:)?/i.test(line)) {
        ein = line.replace(/^EIN\s*(Number|#|:)?\s*/i, '').trim();
        continue;
      }
      // Date Filed line
      if (/^Date\s*Filed/i.test(line)) {
        date = line.replace(/^Date\s*Filed\s*/i, '').trim();
        continue;
      }
      // First non-empty line that's not EIN/Date → company name
      if (!companyName) {
        companyName = line.trim();
      }
    }

    if (!companyName || !ein) return null;

    return {
      raw:         block.replace(/\n/g, ' | ').trim(),
      companyName,
      ein,
      date,
      used:        false
    };
  }
};
