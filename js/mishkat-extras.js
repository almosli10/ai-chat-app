// ═══════════════════════════════════════════════════════
// MISHKAT EXTRAS — Avatar في الردود + فقاعة حوار + أصوات + مزاج
// ═══════════════════════════════════════════════════════
(function mishkatExtras() {
  'use strict';

  const wrap = () => document.getElementById('mishkat');
  const $ = (sel, root) => (root || document).querySelector(sel);

  // ═══════════════════════════════════════════════════════
  // 1) AVATAR في كل ردود المساعد
  // ═══════════════════════════════════════════════════════
  const MINI_SVG = `
    <svg viewBox="0 0 100 100" class="mk-mini-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="mkMiniGlow2">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="mkMiniBody2" cx="0.4" cy="0.3">
          <stop offset="0%" stop-color="#fef3c7"/>
          <stop offset="35%" stop-color="#fcd34d"/>
          <stop offset="70%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </radialGradient>
        <linearGradient id="mkMiniFlame2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#ea580c"/>
          <stop offset="40%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#fffbeb"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="68" r="44" fill="url(#mkMiniGlow2)" class="mk-mini-glow"/>
      <g class="mk-mini-flame">
        <path d="M50 8 Q 60 22 56 34 Q 62 30 60 42 Q 52 38 50 46 Q 48 38 40 42 Q 38 30 44 34 Q 40 22 50 8 Z" fill="url(#mkMiniFlame2)"/>
        <path d="M50 16 Q 54 24 52 32 Q 50 36 50 38 Q 50 36 48 32 Q 46 24 50 16 Z" fill="#fffbeb" opacity="0.9"/>
      </g>
      <ellipse cx="50" cy="68" rx="30" ry="28" fill="url(#mkMiniBody2)"/>
      <ellipse cx="40" cy="58" rx="9" ry="5" fill="white" opacity="0.35"/>
      <ellipse cx="64" cy="80" rx="5" ry="2.5" fill="#7c2d12" opacity="0.15"/>
      <ellipse cx="40" cy="68" rx="6" ry="7" fill="#fffbeb"/>
      <circle cx="40" cy="68" r="3.5" fill="#1c1917"/>
      <circle cx="38.5" cy="66.5" r="1.2" fill="white"/>
      <ellipse cx="60" cy="68" rx="6" ry="7" fill="#fffbeb"/>
      <circle cx="60" cy="68" r="3.5" fill="#1c1917"/>
      <circle cx="58.5" cy="66.5" r="1.2" fill="white"/>
      <path d="M44 82 Q50 85 56 82" stroke="#78350f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </svg>
  `;

  function swapOne(el) {
    if (!el || el.dataset.mkReplaced === '1') return;
    if (el.querySelector('.mk-mini-svg')) { el.dataset.mkReplaced = '1'; return; }
    const txt = (el.textContent || '').trim();
    if (txt === '✨' || txt === '' || /^[\s✨]+$/.test(txt)) {
      el.innerHTML = MINI_SVG;
      el.dataset.mkReplaced = '1';
      el.classList.add('mk-avatar-mini');
    }
  }

  function scanAll() {
    document.querySelectorAll('.msg.assistant .msg-avatar, .brand-logo, .welcome-logo').forEach(swapOne);
  }

  const obs = new MutationObserver((muts) => {
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.msg.assistant .msg-avatar, .brand-logo, .welcome-logo')) swapOne(n);
        n.querySelectorAll && n.querySelectorAll('.msg.assistant .msg-avatar, .brand-logo, .welcome-logo').forEach(swapOne);
      });
    });
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanAll, 300);
  setInterval(scanAll, 1200);

  // ═══════════════════════════════════════════════════════
  // 2) فقاعة حوار — يظهر أحيانًا بجُمل ودّية
  // ═══════════════════════════════════════════════════════
  const BUBBLE_IDLE = [
    'كيف أقدر أنير يومك؟ ✨',
    'جاهز وقت ما تحتاج 🌟',
    'أنا هنا معك 💛',
    'فكرة اليوم؟ 💡',
    'مستعد لأي سؤال 🚀',
    'هممم... أفكر معك 🤔',
    'اكتب بحرية، أنا أسمعك 👂',
    'دعنا نبدع شيئًا 🎨',
  ];
  const BUBBLE_MORNING = ['صباح النور ☀️', 'يومك مشرق ✨', 'قهوتك جاهزة؟ ☕'];
  const BUBBLE_AFTERNOON = ['كيف الإنتاج؟ 💪', 'خلنا ننجز 🎯', 'الظهيرة مثالية للعمل ⚡'];
  const BUBBLE_EVENING = ['مساء الخير 🌆', 'وقت الاسترخاء 🌙', 'كيف كان يومك؟ 💭'];
  const BUBBLE_NIGHT = ['ليلة هادئة 🌌', 'أنا مستيقظ معك ✨', 'لا تنسَ النوم 💤'];
  const BUBBLE_ON_TYPE = ['أكتب معك ✍️', 'أفهم...', 'متابع 👀', 'خذ وقتك 💭'];
  const BUBBLE_ON_SEND = ['تمام! 🚀', 'جاري...', 'أفكر 🤔', 'استلمت ✅'];
  const BUBBLE_ON_REPLY = ['✨', 'ها هو ذا!', 'أتمنى يفيدك 💡', 'كيف كان؟ 💛'];

  let bubbleEl = null;
  let bubbleTimer = null;
  let lastBubble = '';

  function makeBubble() {
    if (bubbleEl) return bubbleEl;
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'mk-bubble';
    bubbleEl.innerHTML = `
      <span class="mk-bubble-text"></span>
      <span class="mk-bubble-tail"></span>
    `;
    document.body.appendChild(bubbleEl);
    return bubbleEl;
  }

  function showBubble(text, duration = 3200) {
    if (!text || text === lastBubble) return;
    lastBubble = text;
    const b = makeBubble();
    b.querySelector('.mk-bubble-text').textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove('show'), duration);
  }

  function pickTimeList() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return BUBBLE_MORNING;
    if (h >= 12 && h < 18) return BUBBLE_AFTERNOON;
    if (h >= 18 && h < 22) return BUBBLE_EVENING;
    return BUBBLE_NIGHT;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // فقاعات دورية في وضع الراحة
  function idleBubbleLoop() {
    const state = wrap()?.getAttribute('data-state') || 'idle';
    if (state === 'idle' && !document.hidden) {
      const list = Math.random() < 0.6 ? pickTimeList() : BUBBLE_IDLE;
      showBubble(pick(list));
    }
    setTimeout(idleBubbleLoop, 25000 + Math.random() * 45000);
  }
  setTimeout(idleBubbleLoop, 20000);

  // فقاعات عند الأحداث
  function wireBubbles(retries = 40) {
    const input = document.getElementById('msg');
    const sendBtn = document.getElementById('sendBtn');
    if (!input || !sendBtn) {
      if (retries > 0) return setTimeout(() => wireBubbles(retries - 1), 250);
      return;
    }

    let typeDebounce;
    input.addEventListener('input', () => {
      if (Math.random() > 0.15) return;
      clearTimeout(typeDebounce);
      typeDebounce = setTimeout(() => showBubble(pick(BUBBLE_ON_TYPE), 1800), 600);
    });

    sendBtn.addEventListener('click', () => showBubble(pick(BUBBLE_ON_SEND), 2200));
  }
  wireBubbles();

  // فقاعة عند الرد
  const chatInner = () => document.getElementById('chatInner');
  function watchReplies(retries = 40) {
    const ci = chatInner();
    if (!ci) {
      if (retries > 0) return setTimeout(() => watchReplies(retries - 1), 250);
      return;
    }
    const o = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList?.contains('msg') && n.classList?.contains('assistant')) {
          setTimeout(() => {
            if (n.isConnected) showBubble(pick(BUBBLE_ON_REPLY), 2400);
          }, 700);
        }
      }));
    });
    o.observe(ci, { childList: true });
  }
  watchReplies();

  // ═══════════════════════════════════════════════════════
  // 3) أصوات خفيفة + مزاج حسب الوقت
  // ═══════════════════════════════════════════════════════
  let mkAudioCtx = null;
  function getCtx() {
    if (!mkAudioCtx) mkAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return mkAudioCtx;
  }
  function mkSound(type) {
    if (typeof soundSettings !== 'undefined' && soundSettings.enabled === false) return;
    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'chirp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.13);
      } else if (type === 'hum') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now); osc.stop(now + 0.36);
      } else if (type === 'sleep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.51);
      }
    } catch (e) {}
  }

  // صوت عند الضغط على مشكاة
  document.addEventListener('click', (e) => {
    if (e.target.closest('#mishkat')) {
      mkSound('chirp');
      setTimeout(() => mkSound('hum'), 180);
    }
  }, true);

  // مزاج حسب الوقت — يغير لون التوهج
  function applyTimeMood() {
    const w = wrap();
    if (!w) return;
    const h = new Date().getHours();
    let mood = 'day';
    if (h >= 5 && h < 11) mood = 'morning';
    else if (h >= 11 && h < 17) mood = 'afternoon';
    else if (h >= 17 && h < 21) mood = 'evening';
    else mood = 'night';
    if (w.dataset.mood !== mood) w.dataset.mood = mood;
  }
  applyTimeMood();
  setInterval(applyTimeMood, 60000);

  // صوت ناعم لما ينام
  const origSleep = null; // can't intercept easily, monitor data-state instead
  let wasSleepy = false;
  setInterval(() => {
    const w = wrap();
    if (!w) return;
    const isSleepy = w.getAttribute('data-state') === 'sleepy';
    if (isSleepy && !wasSleepy) mkSound('sleep');
    wasSleepy = isSleepy;
  }, 800);

  // ═══════════════════════════════════════════════════════
  // 4) PWA Splash + Title يفضّلون مشكاة
  // ═══════════════════════════════════════════════════════
  // استبدال شعار Splash الحالي إذا ظهر
  function swapSplashLogo() {
    const logo = document.querySelector('.pwa-splash-logo');
    if (logo && logo.textContent.trim() === '✨') {
      logo.innerHTML = MINI_SVG;
      logo.style.background = 'transparent';
      logo.style.boxShadow = 'none';
      logo.style.width = '120px';
      logo.style.height = '120px';
    }
  }
  const splashObs = new MutationObserver(() => swapSplashLogo());
  splashObs.observe(document.body, { childList: true, subtree: true });

  console.log('🏮 Mishkat extras loaded');
})();