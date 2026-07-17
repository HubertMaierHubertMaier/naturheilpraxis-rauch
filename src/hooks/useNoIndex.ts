import { useEffect } from "react";

export function useNoIndex(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !robots;
    const previousContent = robots?.getAttribute("content") ?? null;

    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }

    robots.setAttribute("content", "noindex, nofollow");

    return () => {
      if (created) {
        robots?.remove();
      } else if (previousContent === null) {
        robots?.removeAttribute("content");
      } else {
        robots?.setAttribute("content", previousContent);
      }
    };
  }, [enabled]);
}
