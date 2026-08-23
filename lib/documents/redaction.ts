/*
 * Identity number redaction.
 *
 * Life Vault holds Aadhaar, PAN and passport documents. Storing those numbers in
 * a queryable column would mean a single database compromise leaks every user's
 * identity numbers, so nothing here ever persists a full number: the masked form
 * and the last four digits are all that reach the database, and the complete
 * number stays only inside the encrypted file in S3.
 *
 * Searching by the last digits still works, which is how people actually look
 * for these documents ("the passport ending 1234").
 */

/*
 * Patterns for the identity numbers common in India, ordered most to least
 * specific. Each keeps a group for the trailing characters that stay visible.
 *
 * Anchored with (?<![0-9A-Z]) / (?![0-9A-Z]) rather than \b: \b would treat the
 * boundary between a letter and a digit as a word break, letting a longer
 * account number match a shorter pattern inside it.
 */
const identityPatterns: Array<{ label: string; pattern: RegExp }> = [
  // PAN: five letters, four digits, one letter.
  {
    label: "PAN",
    pattern: /(?<![0-9A-Z])[A-Z]{5}[0-9]{4}[A-Z](?![0-9A-Z])/gi,
  },
  // Aadhaar: 12 digits, usually spaced or hyphenated in groups of four.
  {
    label: "Aadhaar",
    pattern: /(?<![0-9])[2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}(?![0-9])/g,
  },
  // Indian passport: one letter followed by seven digits.
  {
    label: "Passport",
    pattern: /(?<![0-9A-Z])[A-PR-WYa-pr-wy][0-9]{7}(?![0-9A-Z])/g,
  },
  // Driving licence: two letters, two digits, then 11 digits (often spaced).
  {
    label: "Driving Licence",
    pattern: /(?<![0-9A-Z])[A-Z]{2}[\s-]?[0-9]{2}[\s-]?[0-9]{11}(?![0-9])/gi,
  },
  // GSTIN.
  {
    label: "GSTIN",
    pattern:
      /(?<![0-9A-Z])[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Zz][0-9A-Z](?![0-9A-Z])/gi,
  },
  // Long bank account / policy numbers: 9-18 digits.
  {
    label: "Account",
    pattern: /(?<![0-9])[0-9]{9,18}(?![0-9])/g,
  },
];

/*
 * Keeps the last four alphanumeric characters and replaces everything before
 * them with X, preserving the original spacing so the shape stays recognisable.
 */
export function maskIdentityNumber(raw: string) {
  const trimmed = raw.trim();
  const alphanumeric = trimmed.replace(/[^0-9A-Za-z]/g, "");
  if (alphanumeric.length <= 4) return { masked: trimmed, last4: alphanumeric };

  const last4 = alphanumeric.slice(-4);
  let remainingVisible = 4;
  let masked = "";

  // Walk backwards so the four visible characters are the trailing ones.
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const character = trimmed[index];
    if (!/[0-9A-Za-z]/.test(character)) {
      masked = character + masked;
      continue;
    }
    if (remainingVisible > 0) {
      masked = character + masked;
      remainingVisible -= 1;
      continue;
    }
    masked = `X${masked}`;
  }

  return { masked, last4 };
}

export type DetectedIdentityNumber = {
  label: string;
  masked: string;
  last4: string;
};

/*
 * Finds the most significant identity number in text and returns it masked.
 *
 * Returns the first match by pattern specificity rather than by position: a
 * document usually contains several numbers (a phone number, a pin code, an
 * invoice number) and the identity number is the one worth surfacing.
 */
export function detectIdentityNumber(
  text: string,
): DetectedIdentityNumber | null {
  for (const { label, pattern } of identityPatterns) {
    // Patterns are module-level and carry /g, so reset before reuse.
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    const { masked, last4 } = maskIdentityNumber(match[0]);
    return { label, masked, last4 };
  }
  return null;
}

/*
 * Strips every identity number from free text before it is stored.
 *
 * OCR text is written to a searchable column, so leaving raw numbers in it would
 * defeat the masking above — the number would simply live in a different column.
 */
export function redactIdentityNumbers(text: string) {
  let redacted = text;
  for (const { pattern } of identityPatterns) {
    redacted = redacted.replace(pattern, (match) => {
      const { masked } = maskIdentityNumber(match);
      return masked;
    });
  }
  return redacted;
}
