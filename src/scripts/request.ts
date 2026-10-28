// "Copy address" (ROADMAP 24.4): the Clipboard API, or, where it is missing or refused, the
// address text gets selected so the visitor can copy it by hand. Delegated from the document, so
// it keeps working after the language switch swaps the page in place.
export function initRequest(): void {
  document.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-copy-email]");
    const box = button?.closest("[data-request]");
    if (!button || !box) return;
    const status = box.querySelector<HTMLElement>("[data-copy-status]")!;
    const selectAddress = (): void => {
      const range = document.createRange();
      range.selectNodeContents(box.querySelector("[data-request-addr]")!);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = button.dataset["selected"] ?? "";
    };
    if (!navigator.clipboard?.writeText) return selectAddress();
    navigator.clipboard.writeText(button.dataset["copyEmail"] ?? "").then(
      () => (status.textContent = button.dataset["copied"] ?? ""),
      selectAddress,
    );
  });
}
