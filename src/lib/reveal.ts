// Scroll reveal (progressive enhancement). Elements marked data-reveal start
// hidden only once the theme-init script has added .reveal-ready to <html>,
// so visitors without JS always see content.

export function initReveal() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  // Stagger: <Reveal delay> → data-reveal-delay, applied via CSSOM (CSP-safe).
  for (const el of els) {
    if (el.dataset.revealDelay)
      el.style.setProperty('--reveal-delay', `${el.dataset.revealDelay}ms`);
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => io.observe(el));
}
