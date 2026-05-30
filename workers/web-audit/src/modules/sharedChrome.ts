import * as chromeLauncher from "chrome-launcher";
import { CHROME_LAUNCH_FLAGS } from "../chromeFlags.js";
import { config } from "../config.js";

export type AuditChrome = Awaited<ReturnType<typeof chromeLauncher.launch>>;

/** Single Chromium instance per audit (shared by Lighthouse + axe via CDP). */
export const launchAuditChrome = async (): Promise<AuditChrome> =>
  chromeLauncher.launch({
    chromeFlags: [...CHROME_LAUNCH_FLAGS],
    chromePath: config.chromePath,
  });

export const killAuditChrome = async (chrome: AuditChrome | null) => {
  if (!chrome) return;
  try {
    await chrome.kill();
  } catch {
    /* ignore shutdown errors */
  }
};
