// ═══════════════════════════════════════════
// PARTICLES — جزيئات عائمة في الخلفية
// ═══════════════════════════════════════════
(function initParticles() {
  // تجاهل على الجوال أو مع reduce-motion (أداء)
  if (window.innerWidth < 768) return;
  if ('ontouchstart' in window) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'particles-bg';
  document.body.insertBefore(container, document.body.firstChild);

  const PARTICLE_COUNT = 20;
  const colors = [
    'rgba(99, 102, 241, 0.55)',
    'rgba(139, 92, 246, 0.5)',
    'rgba(236, 72, 153, 0.42)',
    'rgba(16, 185, 129, 0.4)',
    'rgba(6, 182, 212, 0.5)',
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = Math.random() * 30 + 28;
    const delay = Math.random() * -55;

    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = color;
    p.style.left = (Math.random() * 100) + '%';
    p.style.animationDuration = duration + 's';
    p.style.animationDelay = delay + 's';
    p.style.boxShadow = `0 0 ${size * 4}px ${color}`;
    container.appendChild(p);
  }
  console.log('✨ Particles active (' + PARTICLE_COUNT + ')');
})();