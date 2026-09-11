(() => {
  'use strict';

  // Real links work without JavaScript. Enhance them to retain a valid section.
  const languageLinks = [...document.querySelectorAll('[data-language-link]')];
  const updateLanguageLinks = () => {
    let hash = '';
    try {
      if (location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))) hash = location.hash;
    } catch { /* A malformed fragment leaves the normal page link intact. */ }
    for (const link of languageLinks) link.hash = hash;
  };
  updateLanguageLinks();
  window.addEventListener('hashchange', updateLanguageLinks);

  if (!window.matchMedia || !('IntersectionObserver' in window)) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const candidates = [...document.querySelectorAll('.latest-layout > *, .section-heading, .release-card, .concept > *, .album-story, .tracks, .single-details, .single-album')];
  let observer;
  let generation = 0;
  const show = element => {
    element.dataset.revealState = 'visible';
    observer?.unobserve(element);
  };
  const disable = () => {
    generation += 1;
    observer?.disconnect();
    observer = undefined;
    for (const element of candidates) delete element.dataset.revealState;
  };
  const configure = () => {
    // Elements are hidden only after successful observer registration.
    const previouslyVisible = new Set(candidates.filter(element => element.dataset.revealState === 'visible'));
    disable();
    if (preference.matches) return;
    const current = generation;
    try {
      observer = new IntersectionObserver(entries => {
        if (current !== generation) return;
        try {
          for (const entry of entries) if (entry.isIntersecting) show(entry.target);
        } catch { disable(); }
      }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });
      for (const element of candidates) {
        // Back/forward navigation and direct section links stay immediately readable.
        const bounds = element.getBoundingClientRect();
        if (previouslyVisible.has(element) || bounds.top < window.innerHeight || element.contains(document.activeElement)) {
          element.dataset.revealState = 'visible';
          continue;
        }
        observer.observe(element);
        element.dataset.revealState = 'waiting';
      }
    } catch { disable(); }
  };
  document.addEventListener('focusin', event => {
    const element = event.target.closest?.('[data-reveal-state="waiting"]');
    if (element) show(element);
  });
  window.addEventListener('pageshow', () => {
    updateLanguageLinks();
    configure();
  });
  // These listeners also respond when the OS motion preference changes in this tab.
  if (preference.addEventListener) preference.addEventListener('change', configure);
  else if (preference.addListener) preference.addListener(configure);
  configure();
})();
