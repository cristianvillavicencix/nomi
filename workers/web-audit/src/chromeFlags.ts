/**
 * Flags passed to the Chrome **process** via chrome-launcher.launch({ chromeFlags }).
 * Lighthouse attaches to that instance by port — it does not re-launch Chrome.
 * Required in Docker/Fly without sandbox; missing flags → cryptic launch failures.
 */
export const CHROME_LAUNCH_FLAGS = [
  "--headless=new",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--mute-audio",
  "--no-first-run",
  "--disable-default-apps",
] as const;
