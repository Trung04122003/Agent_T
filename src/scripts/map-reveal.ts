// Run the map's draw-in once, the first time it scrolls into view (UX section 3).
// Without IntersectionObserver or with reduced motion the map simply stays fully drawn.
export function initMap(): void {
  const map = document.querySelector<HTMLElement>("[data-map]");
  if (!map || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  map.classList.add("is-armed");
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      // Motion budget (UX-v2 section 1): never start while a mode change is running.
      const reveal = (): void => {
        if (document.documentElement.dataset["scene"] !== undefined) setTimeout(reveal, 100);
        else map.classList.add("is-revealed");
      };
      reveal();
    },
    { threshold: 0.3 },
  );
  observer.observe(map);
}
