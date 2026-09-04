/**
 * Parse / serialize .env-style text for the project Security tab.
 * Does not expand ${VAR} references — values stay literal.
 */

export type ParsedEnvVar = {
  key: string;
  value: string;
};

const SECRET_KEY_RE = /PASS|SECRET|KEY|TOKEN|PWD|PRIVATE/i;

export const isLikelySecretEnvKey = (key: string) => SECRET_KEY_RE.test(key);

const stripQuotes = (raw: string) => {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  // Inline comment only for unquoted values: KEY=value # comment
  const hashIndex = value.search(/\s+#/);
  if (hashIndex >= 0) return value.slice(0, hashIndex).trim();
  return value;
};

/** Parse a .env blob into key/value pairs (last duplicate key wins). */
export const parseEnvText = (text: string): ParsedEnvVar[] => {
  const map = new Map<string, string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const value = stripQuotes(line.slice(eq + 1));
    map.set(key, value);
  }

  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
};

/** Merge pasted vars into existing rows (by key). */
export const mergeEnvVars = <T extends { key: string; value?: string }>(
  existing: T[],
  incoming: ParsedEnvVar[],
): Array<T | ParsedEnvVar> => {
  const byKey = new Map<string, T | ParsedEnvVar>();
  for (const row of existing) {
    const key = String(row.key ?? "").trim();
    if (!key) continue;
    byKey.set(key, row);
  }
  for (const row of incoming) {
    const prev = byKey.get(row.key);
    if (prev && typeof prev === "object") {
      byKey.set(row.key, { ...prev, key: row.key, value: row.value });
    } else {
      byKey.set(row.key, row);
    }
  }
  return Array.from(byKey.values());
};

export const serializeEnvVars = (
  rows: Array<{ key: string; value?: string | null }>,
): string =>
  rows
    .map((row) => {
      const key = String(row.key ?? "").trim();
      if (!key) return null;
      const value = String(row.value ?? "");
      const needsQuotes =
        value.includes(" ") ||
        value.includes("#") ||
        value.includes("'") ||
        value.includes('"') ||
        value.includes("\n");
      if (!needsQuotes) return `${key}=${value}`;
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${key}="${escaped}"`;
    })
    .filter(Boolean)
    .join("\n");
