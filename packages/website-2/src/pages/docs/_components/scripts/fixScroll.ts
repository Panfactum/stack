document.addEventListener("DOMContentLoaded", () => {
  const adjustScroll = () => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element instanceof HTMLElement) {
        window.scrollTo({
          top: element.offsetTop - 100, // Adjust this value to match your fixed nav height
          behavior: "smooth",
        });
      }
    }
  };
  window.addEventListener("popstate", adjustScroll);
  window.addEventListener("hashchange", adjustScroll);
  adjustScroll(); // Adjust scroll on initial load if there's a hash
});
