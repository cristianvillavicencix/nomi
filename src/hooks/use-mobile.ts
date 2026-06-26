import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_MAX_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

/** True below lg (1024px) — mobile + tablet compact layouts. */
export function useIsBelowLg() {
  const [isBelowLg, setIsBelowLg] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < TABLET_MAX_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${TABLET_MAX_BREAKPOINT - 1}px)`,
    );
    const onChange = () => {
      setIsBelowLg(window.innerWidth < TABLET_MAX_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsBelowLg(window.innerWidth < TABLET_MAX_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isBelowLg;
}
