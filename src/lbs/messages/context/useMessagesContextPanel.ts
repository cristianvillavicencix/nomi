import { useCallback, useState } from "react";

const STORAGE_KEY = "nomi:messages:context-panel-open";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const useMessagesContextPanel = () => {
  const [open, setOpen] = useState(readStored);

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch {
      // ignore
    }
  }, []);

  return { open, toggle, close, setOpen };
};
