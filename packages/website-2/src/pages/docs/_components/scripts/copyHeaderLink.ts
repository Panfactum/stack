
// TODO: Convert into custom element

document.addEventListener("click", function (event) {
  // Check if the clicked element is an anchor inside a heading

  const target = event.target;

  if (target instanceof HTMLElement) {
    const anchor = target.closest("a");
    if (
      anchor instanceof HTMLAnchorElement &&
      target.closest("h1, h2, h3, h4, h5, h6")
    ) {
      const href = anchor.getAttribute("href");

      if (href && href.startsWith("#")) {
        // Combine the current page URL with the href
        const fullUrl = `${window.location.origin}${window.location.pathname}${href}`;

        // Copy the full URL to the clipboard
        void navigator.clipboard.writeText(fullUrl);

        // Prevent the default action of scrolling to the anchor
        event.preventDefault();
      }
    }
  }
});
