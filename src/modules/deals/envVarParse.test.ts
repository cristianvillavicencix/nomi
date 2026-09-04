import { describe, expect, it } from "vitest";
import {
  isLikelySecretEnvKey,
  mergeEnvVars,
  parseEnvText,
  serializeEnvVars,
} from "@/modules/deals/envVarParse";

describe("envVarParse", () => {
  it("parses keys, quotes, and comments", () => {
    const parsed = parseEnvText(`
# APP
APP_NAME='Hudsonview Contractor'
HOST=0.0.0.0
APP_URL=https://example.com
DB_PASS=tgqwvbrblfmkd05r # cambiar
INVALID
=nope
`);
    expect(parsed).toEqual([
      { key: "APP_NAME", value: "Hudsonview Contractor" },
      { key: "HOST", value: "0.0.0.0" },
      { key: "APP_URL", value: "https://example.com" },
      { key: "DB_PASS", value: "tgqwvbrblfmkd05r" },
    ]);
  });

  it("keeps ${VAR} literal", () => {
    expect(parseEnvText('VITE_APP_NAME="${APP_NAME}"')).toEqual([
      { key: "VITE_APP_NAME", value: "${APP_NAME}" },
    ]);
  });

  it("marks secret-like keys", () => {
    expect(isLikelySecretEnvKey("DB_PASS")).toBe(true);
    expect(isLikelySecretEnvKey("APP_URL")).toBe(false);
  });

  it("merges by key", () => {
    const merged = mergeEnvVars(
      [{ key: "HOST", value: "old" }],
      [
        { key: "HOST", value: "0.0.0.0" },
        { key: "PORT", value: "3333" },
      ],
    );
    expect(merged).toEqual([
      { key: "HOST", value: "0.0.0.0" },
      { key: "PORT", value: "3333" },
    ]);
  });

  it("serializes back to .env", () => {
    expect(
      serializeEnvVars([
        { key: "HOST", value: "0.0.0.0" },
        { key: "NOTE", value: "hello # world" },
      ]),
    ).toBe('HOST=0.0.0.0\nNOTE="hello # world"');
  });
});
