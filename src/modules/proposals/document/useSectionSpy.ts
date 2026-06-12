import { useCallback, useEffect, useState } from "react";

export const useSectionSpy = (
  sectionIds: string[],
  rootMargin = "-8% 0px -55% 0px",
  enabled = true,
  scrollRoot: HTMLElement | null = null,
) => {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (!enabled || sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin,
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [enabled, rootMargin, scrollRoot, sectionIds]);

  const scrollTo = useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (!element) return;

      if (scrollRoot) {
        const offset = 20;
        const top =
          element.getBoundingClientRect().top -
          scrollRoot.getBoundingClientRect().top +
          scrollRoot.scrollTop -
          offset;
        scrollRoot.scrollTo({ top, behavior: "smooth" });
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [scrollRoot],
  );

  return { activeId, scrollTo };
};
