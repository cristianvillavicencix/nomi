const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 140;

type PreviewListener = (activeId: string | null) => void;

let activeId: string | null = null;
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<PreviewListener>();

const notify = () => {
  listeners.forEach((listener) => listener(activeId));
};

const clearOpenTimer = () => {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
};

const clearCloseTimer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
};

export const calendarEventPreviewController = {
  subscribe(listener: PreviewListener) {
    listeners.add(listener);
    listener(activeId);
    return () => listeners.delete(listener);
  },

  scheduleOpen(id: string) {
    clearCloseTimer();
    if (activeId === id) return;

    clearOpenTimer();

    if (activeId != null && activeId !== id) {
      activeId = id;
      notify();
      return;
    }

    openTimer = setTimeout(() => {
      openTimer = null;
      activeId = id;
      notify();
    }, OPEN_DELAY_MS);
  },

  scheduleClose(id: string) {
    clearOpenTimer();
    if (activeId !== id) return;

    clearCloseTimer();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (activeId === id) {
        activeId = null;
        notify();
      }
    }, CLOSE_DELAY_MS);
  },

  cancelClose() {
    clearCloseTimer();
  },

  closeImmediately(id?: string) {
    clearOpenTimer();
    clearCloseTimer();
    if (id && activeId !== id) return;
    activeId = null;
    notify();
  },

  isActive(id: string) {
    return activeId === id;
  },
};

export const calendarEventPreviewDelays = {
  openMs: OPEN_DELAY_MS,
  closeMs: CLOSE_DELAY_MS,
};
