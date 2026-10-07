// ═══════════════════════════════════════════════════════
// PWA ENHANCEMENTS — Install, Update, Badge, Wake Lock, Share
// ═══════════════════════════════════════════════════════
(function pwaEnhancements() {
  'use strict';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isTouch = 'ontouchstart' in window;

  // ─────────────────────────────────────────────
  // 1) SHARE TARGET + SHORTCUTS — معالجة ?share= و ?action=
  // ─────────────────────────────────────────────
  function handleUrlActions() {
    const params = new URLSearchParams(location.search);

    // Share Target
    if (params.get('share') === '1') {
      const sharedTitle = params.get('title') || '';
      const sharedText = params.get('text') || '';
      const sharedUrl = params.get('url') || '';
      const composed = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n\n').trim();
      if (composed) {
        // انتظر حتى يجهز التطبيق
        const tryFill = (retries = 30) => {
          const input = document.getElementById('msg');
          if (input) {
            input.value = composed;
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof toast === 'function') toast('📥 محتوى مشارك جاهز للإرسال');
          } else if (retries > 0) {
            setTimeout(() => tryFill(retries - 1), 200);
          }
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => tryFill(), { once: true });
        } else {
          tryFill();
        }
      }
      history.replaceState({}, '', location.pathname);
      return;
    }

    // Shortcuts
    const action = params.get('action');
    if (!action) return;
    const runAction = (retries = 30) => {
      try {
        if (action === 'new' && typeof createNewChat === 'function') {
          createNewChat();
        } else if (action === 'search') {
          const s = document.getElementById('searchInput');
          if (s) s.focus();
        } else if (action === 'memory' && typeof openMemory === 'function') {
          openMemory();
        }
      } catch (e) {}
      if (retries > 0 && typeof createNewChat !== 'function') {
        setTimeout(() => runAction(retries - 1), 200);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => runAction(), { once: true });
    } else {
      runAction();
    }
    history.replaceState({}, '', location.pathname);
  }
  handleUrlActions();

  // ─────────────────────────────────────────────
  // 2) INSTALL BANNER — قبل التثبيت
  // ─────────────────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (localStorage.getItem('pwa_install_dismissed') === '1') return;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">✨</div>
        <div class="pwa-install-text">
          <strong>ثبّت التطبيق</strong>
          <span>افتحه من سطح المكتب أو الشاشة الرئيسية</span>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-install-btn" id="pwa-install-go">تثبيت</button>
          <button class="pwa-install-dismiss" id="pwa-install-x" aria-label="إغلاق">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));

    document.getElementById('pwa-install-go').onclick = async () => {
      if (!deferredPrompt) return;
      banner.classList.remove('show');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      setTimeout(() => banner.remove(), 400);
      if (outcome === 'accepted' && typeof toast === 'function') toast('🎉 تم التثبيت');
    };
    document.getElementById('pwa-install-x').onclick = () => {
      banner.classList.remove('show');
      localStorage.setItem('pwa_install_dismissed', '1');
      setTimeout(() => banner.remove(), 400);
    };
  }

  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
    if (typeof toast === 'function') toast('🎉 تم تثبيت التطبيق');
  });

  // iOS — إرشاد تثبيت يدوي (Safari ما يدعم beforeinstallprompt)
  if (isIOS && !isStandalone && !localStorage.getItem('pwa_ios_dismissed')) {
    setTimeout(() => {
      const banner = document.createElement('div');
      banner.id = 'pwa-install-banner';
      banner.innerHTML = `
        <div class="pwa-install-content">
          <div class="pwa-install-icon">✨</div>
          <div class="pwa-install-text">
            <strong>ثبّت التطبيق على iPhone</strong>
            <span>اضغط زر المشاركة <strong>⎙</strong> ثم "إضافة إلى الشاشة الرئيسية"</span>
          </div>
          <div class="pwa-install-actions">
            <button class="pwa-install-dismiss" id="pwa-install-x" aria-label="إغلاق">✕</button>
          </div>
        </div>
      `;
      document.body.appendChild(banner);
      requestAnimationFrame(() => banner.classList.add('show'));
      document.getElementById('pwa-install-x').onclick = () => {
        banner.classList.remove('show');
        localStorage.setItem('pwa_ios_dismissed', '1');
        setTimeout(() => banner.remove(), 400);
      };
    }, 8000); // تأخير عشان لا يزعج فور الفتح
  }

  // ─────────────────────────────────────────────
  // 3) SW UPDATE — تحديثات فورية
  // ─────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.ready.then((reg) => {
      // فحص دوري كل 30 دقيقة
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    });

    // اختصار: تحديث عند عودة التطبيق للمقدمة بعد غياب
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) navigator.serviceWorker.ready.then(r => r.update().catch(() => {}));
    });
  }

  function showUpdateToast(reg) {
    const t = document.createElement('div');
    t.id = 'pwa-update-toast';
    t.innerHTML = `
      <span>🚀 يتوفر إصدار جديد</span>
      <button id="pwa-update-btn">تحديث</button>
      <button id="pwa-update-x" aria-label="إغلاق">✕</button>
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));

    document.getElementById('pwa-update-btn').onclick = () => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    };
    document.getElementById('pwa-update-x').onclick = () => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    };
  }

  // ─────────────────────────────────────────────
  // 4) APP BADGE — رقم غير المقروء على أيقونة التطبيق
  // ─────────────────────────────────────────────
  function updateAppBadge() {
    if (!('setAppBadge' in navigator)) return;
    try {
      const count = (typeof unreadChats !== 'undefined' && unreadChats.size) || 0;
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch (e) {}
  }
  setInterval(updateAppBadge, 3000);

  // ─────────────────────────────────────────────
  // 5) WAKE LOCK — الشاشة ما تنطفي أثناء انتظار رد طويل
  // ─────────────────────────────────────────────
  let wakeLock = null;
  let wakeLockDesired = false;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
  }
  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseWakeLock();
    } else if (wakeLockDesired) {
      requestWakeLock();
    }
  });

  // Hook: لما يبدأ الإرسال → شغّل Wake Lock | لما ينتهي → أطلقه
  function hookSend(retries = 30) {
    if (typeof window.send !== 'function') {
      if (retries > 0) return setTimeout(() => hookSend(retries - 1), 200);
      return;
    }
    if (window.send.__wakeWrapped) return;
    const orig = window.send;
    window.send = async function (...args) {
      wakeLockDesired = true;
      requestWakeLock();
      try {
        return await orig.apply(this, args);
      } finally {
        setTimeout(() => { wakeLockDesired = false; releaseWakeLock(); }, 400);
      }
    };
    window.send.__wakeWrapped = true;
  }
  hookSend();

  // ─────────────────────────────────────────────
  // 6) iOS SPLASH — شاشة افتتاحية فاخرة
  // ─────────────────────────────────────────────
  if (isStandalone && !sessionStorage.getItem('pwa_splash_done')) {
    const splash = document.createElement('div');
    splash.id = 'pwa-splash';
    splash.innerHTML = `
      <div class="pwa-splash-logo">✨</div>
      <div class="pwa-splash-brand">مساعد AI</div>
      <div class="pwa-splash-loader"><span></span><span></span><span></span></div>
    `;
    document.body.appendChild(splash);
    sessionStorage.setItem('pwa_splash_done', '1');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 600);
    }, 900);
  }

  // ─────────────────────────────────────────────
  // 7) فحص دوري لـ theme_color (يحدّث شريط الحالة على الجوال)
  // ─────────────────────────────────────────────
  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const theme = document.body.getAttribute('data-theme') || 'light';
    const colors = {
      light: '#f7f8fc', dark: '#0a0d15', 'blue-night': '#0a1424',
      pink: '#fff1f5', 'royal-green': '#f0fdf4', 'warm-brown': '#fef6e7',
      'midnight-purple': '#0d0819', 'rose-gold': '#fff8f5', 'ocean-deep': '#031520'
    };
    meta.setAttribute('content', colors[theme] || '#6366f1');
  }
  setInterval(syncThemeColor, 1000);

  console.log('🚀 PWA Enhancements loaded');
})();