// Evidence trail (EvidenceFlow.astro): pointing at an entry, a source or a tier lights the trail it
// is on (every node and ribbon sharing one of its entries); the rest steps back. Nothing runs while
// the pointer rests.
export function initEvidenceFlow(): void {
  const flow = document.querySelector<HTMLElement>("[data-flow]");
  const plot = flow?.querySelector<HTMLElement>("[data-flow-plot]");
  if (!flow || !plot) return;
  const items = [...plot.querySelectorAll<Element>("[data-entries]")];
  const ids = (el: Element) => (el.getAttribute("data-entries") ?? "").split(" ");
  let current: Element | null = null;
  plot.addEventListener("pointerover", (e) => {
    const hit = (e.target as Element).closest("[data-entries]");
    if (!hit || hit === current || hit.tagName === "path") return;
    current = hit;
    const on = new Set(ids(hit));
    for (const el of items) el.classList.toggle("is-lit", ids(el).some((id) => on.has(id)));
    flow.classList.add("is-hot");
  });
  plot.addEventListener("pointerleave", () => {
    current = null;
    flow.classList.remove("is-hot");
    for (const el of items) el.classList.remove("is-lit");
  });
}
