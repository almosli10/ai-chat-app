// ═══════ PREMIUM VISUAL — Cursor Glow ═══════
    (function cursorGlow() {
      if ('ontouchstart' in window) return;
      const glow = document.createElement('div');
      glow.className = 'cursor-glow';
      document.body.appendChild(glow);

      let mx = window.innerWidth / 2, my = window.innerHeight / 2;
      let cx = mx, cy = my;
      let raf;

      document.addEventListener('mousemove', (e) => {
        mx = e.clientX; my = e.clientY;
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });

      function tick() {
        cx += (mx - cx) * 0.09;
        cy += (my - cy) * 0.09;
        glow.style.left = cx + 'px';
        glow.style.top = cy + 'px';
        const dist = Math.hypot(mx - cx, my - cy);
        if (dist > 0.5) raf = requestAnimationFrame(tick);
        else raf = null;
      }
      glow.style.left = cx + 'px';
      glow.style.top = cy + 'px';

      window.addEventListener('resize', () => {
        mx = Math.min(mx, window.innerWidth);
        my = Math.min(my, window.innerHeight);
      }, { passive: true });

      console.log('🌌 Cursor glow active');
    })();
