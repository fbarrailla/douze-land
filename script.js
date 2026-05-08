// Douze Land — small enhancements: scroll fade-in & lightbox.
(() => {
  const photos = window.__DOUZE || [];

  /* --- Scroll-triggered fade-in for plates --- */
  const plates = document.querySelectorAll('.plate');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    plates.forEach(p => io.observe(p));
  } else {
    plates.forEach(p => p.classList.add('is-visible'));
  }

  /* --- Lightbox --- */
  const lb       = document.getElementById('lightbox');
  const lbImg    = lb.querySelector('.lightbox__img');
  const lbCap    = lb.querySelector('.lightbox__caption');
  const btnClose = lb.querySelector('.lightbox__close');
  const btnPrev  = lb.querySelector('.lightbox__nav--prev');
  const btnNext  = lb.querySelector('.lightbox__nav--next');

  let current = -1;

  const renderRomanCount = (n) => {
    const total = photos.length;
    const p = photos[n];
    return `<span class="num">${p.roman}</span><span>Plate ${n + 1} / ${total}</span>`;
  };

  function open(idx) {
    if (idx < 0 || idx >= photos.length) return;
    current = idx;
    const p = photos[idx];
    lbImg.src = p.src;
    lbImg.alt = `Douze Land, plate ${p.roman}`;
    lbCap.innerHTML = renderRomanCount(idx);
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    lb.setAttribute('aria-hidden', 'false');
    btnClose.focus({ preventScroll: true });
  }

  function close() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; lbImg.removeAttribute('src'); }, 250);
  }

  function step(d) {
    const next = (current + d + photos.length) % photos.length;
    open(next);
  }

  document.querySelectorAll('.plate__frame').forEach((frame) => {
    frame.addEventListener('click', () => {
      const fig = frame.closest('.plate');
      const id = fig?.dataset.id;
      const idx = photos.findIndex(p => p.id === id);
      if (idx >= 0) open(idx);
    });
  });

  btnClose.addEventListener('click', close);
  btnPrev .addEventListener('click', () => step(-1));
  btnNext .addEventListener('click', () => step( 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape')      close();
    else if (e.key === 'ArrowLeft')  step(-1);
    else if (e.key === 'ArrowRight') step( 1);
  });

  // Touch swipe on the lightbox image
  let touchX = null;
  lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend',   (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });
})();
