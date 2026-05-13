function openTargetCollapsible() {
  const hash = window.location.hash;
  if (!hash) return;

  const target = document.querySelector(hash);
  if (!target) return;

  const details = target.closest("details");

  // If the details is hidden (e.g., category filter), dispatch an event
  // so filter components can enable the category before we scroll.
  if (details instanceof HTMLElement && details.style.display === "none") {
    document.dispatchEvent(
      new CustomEvent("glossary:reveal", { detail: { hash } }),
    );
  }

  if (details instanceof HTMLDetailsElement && !details.open) {
    details.open = true;
  }

  // Scroll to the target after opening (handles cases where
  // opening the details shifted the element's position)
  target.scrollIntoView({ behavior: "instant" });
}

// Open on initial page load
openTargetCollapsible();

// Open when hash changes (e.g., clicking TOC links)
window.addEventListener("hashchange", openTargetCollapsible);

// Handle clicks on same-hash links: the browser doesn't fire
// "hashchange" when clicking a link whose href matches the
// current hash, so we intercept those clicks manually.
document.addEventListener("click", (e) => {
  const anchor = (e.target as HTMLElement).closest("a[href^='#']");
  if (!anchor) return;

  const href = anchor.getAttribute("href");
  if (href && href === window.location.hash) {
    e.preventDefault();
    openTargetCollapsible();
  }
});
