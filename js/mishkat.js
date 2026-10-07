// ═══════════════════════════════════════════════════════
// MISHKAT 2.0 — واقعية أعلى + تفاعل ذكي
// ═══════════════════════════════════════════════════════
(function mishkat() {
  'use strict';

  const SVG = `
    <svg viewBox="0 0 120 120" class="mk-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mkGlow">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="mkBody" cx="0.4" cy="0.3">
          <stop offset="0%" stop-color="#fef3c7"/>
          <stop offset="35%" stop-color="#fcd34d"/>
          <stop offset="70%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </radialGradient>
        <linearGradient id="mkFlame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#ea580c" stop-opacity="0.6"/>
          <stop offset="40%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#fffbeb"/>
        </linearGradient>
      </defs>

      <circle cx="60" cy="72" r="52" fill="url(#mkGlow)" class="mk-glow"/>

      <g class="mk-flame">
        <path d="M60 12 Q 70 26 66 38 Q 72 34 70 46 Q 62 42 60 50 Q 58 42 50 46 Q 48 34 54 38 Q 50 26 60 12 Z" fill="url(#mkFlame)"/>
        <path d="M60 22 Q 64 30 62 38 Q 60 42 60 44 Q 60 42 58 38 Q 56 30 60 22 Z" fill="#fffbeb" opacity="0.85"/>
      </g>

      <g class="mk-head-breathe">
        <g class="mk-head">
          <ellipse cx="60" cy="72" rx="32" ry="30" fill="url(#mkBody)"/>
          <ellipse cx="48" cy="60" rx="11" ry="6" fill="white" opacity="0.3"/>
          <ellipse cx="76" cy="86" rx="6" ry="3" fill="#7c2d12" opacity="0.15"/>

          <g class="mk-eye mk-eye-l">
            <ellipse cx="48" cy="72" rx="7" ry="8.5" fill="#fffbeb"/>
            <circle class="mk-pupil mk-pupil-l" cx="48" cy="72" r="4" fill="#1c1917"/>
            <circle cx="46.5" cy="70" r="1.4" fill="white"/>
          </g>
          <g class="mk-eye mk-eye-r">
            <ellipse cx="72" cy="72" rx="7" ry="8.5" fill="#fffbeb"/>
            <circle class="mk-pupil mk-pupil-r" cx="72" cy="72" r="4" fill="#1c1917"/>
            <circle cx="70.5" cy="70" r="1.4" fill="white"/>
          </g>

          <ellipse class="mk-lid mk-lid-l" cx="48" cy="72" rx="7.5" ry="0" fill="#d97706"/>
          <ellipse class="mk-lid mk-lid-r" cx="72" cy="72" rx="7.5" ry="0" fill="#d97706"/>

          <path class="mk-mouth mk-mouth-neutral" d="M 53 88 Q 60 91 67 88" stroke="#78350f" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path class="mk-mouth mk-mouth-happy" d="M 50 86 Q 60 95 70 86" stroke="#78350f" stroke-width="2.2" fill="none" stroke-linecap="round" style="display:none"/>
          <path class="mk-mouth mk-mouth-think" d="M 55 88 L 65 88" stroke="#78350f" stroke-width="2" fill="none" stroke-linecap="round" style="display:none"/>
          <ellipse class="mk-blush mk-blush-l" cx="42" cy="82" rx="4" ry="2.5" fill="#f43f5e" opacity="0"/>
          <ellipse class="mk-blush mk-blush-r" cx="78" cy="82" rx="4" ry="2.5" fill="#f43f5e" opacity="0"/>
        </g>
      </g>
    </svg>
  `;

  const wrap = document.createElement('div');
  wrap.id = 'mishkat';
  wrap.className = 'mishkat';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'مساعد مشكاة');
  wrap.innerHTML = SVG;
  const mount = () => document.body.appendChild(wrap);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });

  const $ = s => wrap.querySelector(s);
  const pupils = [$('.mk-pupil-l'), $('.mk-pupil-r')];
  const lids = [$('.mk-lid-l'), $('.mk-lid-r')];
  const mouthN = $('.mk-mouth-neutral');
  const mouthH = $('.mk-mouth-happy');
  const mouthT = $('.mk-mouth-think');
  const blush = [$('.mk-blush-l'), $('.mk-blush-r')];

  // ───── State ─────
  let state = 'idle';
  let currentX = 0, currentY = 0;
  let sleepTimer = null, blinkTimer = null, idleTimer = null, saccadeTimer = null;
  let lastActivity = Date.now();
  let inputActive = false;
  let lastTypedLength = 0;

  // ═══════════════════════════════════════════════════════
  // LOOKAT — Saccades (حركات قافزة بشرية)
  // ═══════════════════════════════════════════════════════
  function lookAt(x, y, instant = false) {
    const targetX = (x || 0) * 2.5;
    const targetY = (y || 0) * 2.5;

    if (instant) {
      currentX = targetX;
      currentY = targetY;
      applyPupils();
      return;
    }

    // قفزات صغيرة تحاكي حركة العين البشرية
    const steps = 2 + Math.floor(Math.random() * 3);
    let step = 0;
    const startX = currentX, startY = currentY;

    const move = () => {
      step++;
      const t = step / steps;
      // easing سريع في البداية (Saccade pattern)
      const eased = 1 - Math.pow(1 - t, 3);
      currentX = startX + (targetX - startX) * eased;
      currentY = startY + (targetY - startY) * eased;
      applyPupils();
      if (step < steps) setTimeout(move, 25 + Math.random() * 15);
    };
    move();
  }

  function applyPupils() {
    pupils.forEach(p => {
      p.style.transform = `translate(${currentX}px, ${currentY}px)`;
      p.style.transformOrigin = 'center';
    });
  }

  // الإدخال بالنسبة لموقع مِشكاة (أسفل-يسار) = يمين-أسفل
  function lookAtInput() {
    lookAt(0.75, 0.55);
  }
  function lookForward() {
    lookAt(0, 0);
  }
  function lookUpThinking() {
    lookAt(0.35, -0.75);
  }
  function lookAside() {
    const dir = Math.random() > 0.5 ? 1 : -1;
    lookAt(dir * 0.85, 0.1);
  }

  // ═══════════════════════════════════════════════════════
  // BLINK — أنماط بشرية
  // ═══════════════════════════════════════════════════════
  function blink(duration = 150) {
    lids.forEach(l => l.setAttribute('ry', '10'));
    setTimeout(() => {
      if (state === 'sleepy' || state === 'peeking') return;
      lids.forEach(l => l.setAttribute('ry', '0'));
    }, duration);
  }

  function naturalBlink() {
    const type = Math.random();
    if (type < 0.6) {
      blink(140 + Math.random() * 40);
    } else if (type < 0.85) {
      // رفّة مزدوجة (شائعة في البشر)
      blink(110);
      setTimeout(() => blink(110), 190);
    } else {
      // رفّة بطيئة (تفكير/كسل)
      blink(280 + Math.random() * 100);
    }
  }

  function quickBlink() {
    blink(90);
  }

  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════
  function setState(newState, opts = {}) {
    if (state === newState && !opts.force) return;
    state = newState;
    wrap.setAttribute('data-state', newState);
    lastActivity = Date.now();
    resetSleepTimer();
    updateMouth();
  }

  function updateMouth() {
    mouthN.style.display = 'none';
    mouthH.style.display = 'none';
    mouthT.style.display = 'none';
    if (state === 'happy') mouthH.style.display = 'block';
    else if (state === 'thinking') mouthT.style.display = 'block';
    else mouthN.style.display = 'block';
  }

  // ═══════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════
  function leanIn() {
    wrap.classList.add('leaning');
    setTimeout(() => wrap.classList.remove('leaning'), 1100);
  }

  function nod() {
    wrap.classList.add('nodding');
    setTimeout(() => wrap.classList.remove('nodding'), 750);
  }

  function thinkUp() {
    lookUpThinking();
    setState('thinking', { force: true });
  }

  function celebrate(intensity = 'normal') {
    setState('happy', { force: true });
    lookForward();
    blush.forEach(b => b.setAttribute('opacity', '0.55'));
    wrap.classList.add('bouncing');
    spawnSparks(intensity === 'big' ? 10 : 6);
    const duration = intensity === 'big' ? 3200 : 2400;
    setTimeout(() => {
      blush.forEach(b => b.setAttribute('opacity', '0'));
      wrap.classList.remove('bouncing');
      setState('idle');
    }, duration);
  }

  function peek() {
    setState('peeking', { force: true });
    lids.forEach(l => l.setAttribute('ry', '9'));
    lookAt(-0.3, 0.1);
    setTimeout(() => {
      if (state === 'peeking') {
        lids.forEach(l => l.setAttribute('ry', '0'));
        setState('typing', { force: true });
      }
    }, 900);
  }

  function sleepy() {
    setState('sleepy', { force: true });
    lids.forEach(l => l.setAttribute('ry', '10'));
    lookAt(0, 0.1);
  }

  function wake() {
    if (state === 'sleepy') {
      lids.forEach(l => l.setAttribute('ry', '0'));
      setState('idle', { force: true });
      quickBlink();
    }
    lastActivity = Date.now();
    resetSleepTimer();
  }

  function resetSleepTimer() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      if (state === 'idle') sleepy();
    }, 55000);
  }

  // ═══════════════════════════════════════════════════════
  // SPARKS
  // ═══════════════════════════════════════════════════════
  function spawnSparks(n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'mk-spark';
      const angle = (Math.PI * 2 * i) / n + (Math.random() * 0.5);
      const dist = 40 + Math.random() * 30;
      s.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      s.style.animationDelay = `${i * 30}ms`;
      wrap.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  // ═══════════════════════════════════════════════════════
  // IDLE LOOPS — التنفس، الرفّة، النظرات العشوائية
  // ═══════════════════════════════════════════════════════

  // رفّة عشوائية طبيعية
  function blinkLoop() {
    clearTimeout(blinkTimer);
    const delay = 1800 + Math.random() * 3800;
    blinkTimer = setTimeout(() => {
      if (state === 'idle' || state === 'attentive' || state === 'typing') naturalBlink();
      blinkLoop();
    }, delay);
  }
  blinkLoop();

  // نظرات عشوائية خفيفة في وضع الراحة
  function saccadeLoop() {
    clearTimeout(saccadeTimer);
    const delay = 3000 + Math.random() * 4500;
    saccadeTimer = setTimeout(() => {
      if (state === 'idle' && Math.random() < 0.4) {
        const rx = (Math.random() - 0.5) * 1.4;
        const ry = (Math.random() - 0.5) * 0.6;
        lookAt(rx, ry);
        // رجوع تدريجي للمنتصف بعد لحظة
        setTimeout(() => { if (state === 'idle') lookForward(); }, 1200 + Math.random() * 800);
      }
      saccadeLoop();
    }, delay);
  }
  saccadeLoop();

  // تمايل خفيف (idle sway)
  function swayLoop() {
    if (state === 'idle' || state === 'attentive') {
      wrap.classList.add('swaying');
      setTimeout(() => wrap.classList.remove('swaying'), 3500);
    }
    setTimeout(swayLoop, 7000 + Math.random() * 6000);
  }
  swayLoop();

  // ═══════════════════════════════════════════════════════
  // WIRE TO UI
  // ═══════════════════════════════════════════════════════
  function wireUp(retries = 40) {
    const input = document.getElementById('msg');
    const sendBtn = document.getElementById('sendBtn');
    if (!input || !sendBtn) {
      if (retries > 0) return setTimeout(() => wireUp(retries - 1), 250);
      return;
    }

    // تركيز على الإدخال
    input.addEventListener('focus', () => {
      wake();
      inputActive = true;
      lookAtInput();
      setState('attentive', { force: true });
    });

    input.addEventListener('blur', () => {
      inputActive = false;
      if (state === 'attentive' || state === 'typing' || state === 'peeking') {
        lookForward();
        setState('idle', { force: true });
      }
    });

    // كتابة
    let charBurst = 0;
    input.addEventListener('input', () => {
      wake();
      const val = input.value;
      const len = val.length;

      if (len === 0) {
        lookForward();
        setState('attentive', { force: true });
        lastTypedLength = 0;
        return;
      }

      // الكتابة النشطة — ينظر للإدخال
      lookAtInput();
      setState('typing', { force: true });

      // burst: يكتب بسرعة → بعض التفاعلات
      charBurst++;

      // بعد 40+ حرف: أحيانًا يقرب "يشوف زين"
      if (len > 40 && len - lastTypedLength > 0 && Math.random() < 0.15) {
        leanIn();
        quickBlink();
      }
      // بعد 70+ حرف: أحيانًا يغض عيونه
      if (len > 70 && Math.random() < 0.10) {
        peek();
      }
      // كل ~15 ضغطة: نظرة جانبية فضولية
      if (charBurst > 0 && charBurst % 15 === 0 && Math.random() < 0.5) {
        lookAside();
        setTimeout(() => { if (inputActive) lookAtInput(); }, 700);
      }

      lastTypedLength = len;
    });

    // عند الإرسال: يرمش → يومئ → يرفع عيونه (يفكر)
    const onSend = () => {
      wake();
      quickBlink();
      setTimeout(() => { nod(); lookAt(0, -0.3); }, 200);
      setTimeout(() => thinkUp(), 900);
      lastTypedLength = 0;
      charBurst = 0;
    };
    sendBtn.addEventListener('click', onSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) onSend();
    });
  }
  wireUp();

  // ═══════════════════════════════════════════════════════
  // REPLY OBSERVER — يتفاعل حسب طول الرد
  // ═══════════════════════════════════════════════════════
  function wireReplyObserver(retries = 40) {
    const chatInner = document.getElementById('chatInner');
    if (!chatInner) {
      if (retries > 0) return setTimeout(() => wireReplyObserver(retries - 1), 250);
      return;
    }
    const obs = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains('msg') && n.classList.contains('assistant')) {
          // تأخير بسيط ليكون البث انتهى نسبيًا
          setTimeout(() => {
            if (!n.isConnected) return;
            // هل الرد طويل؟
            const textLen = (n.textContent || '').length;
            const intensity = textLen > 400 ? 'big' : 'normal';
            celebrate(intensity);
          }, 500);
        }
      }));
    });
    obs.observe(chatInner, { childList: true });
  }
  wireReplyObserver();

  // ═══════════════════════════════════════════════════════
  // POKE + GLOBAL WAKE
  // ═══════════════════════════════════════════════════════
  wrap.addEventListener('click', () => {
    wake();
    celebrate('normal');
  });

  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (state === 'sleepy') wake();
      else {
        lastActivity = Date.now();
        resetSleepTimer();
      }
    }, { passive: true });
  });

  // تتبع الماوس (اختياري — 20% احتمال فقط عند اقترابه)
  document.addEventListener('mousemove', (e) => {
    if (state !== 'idle' && state !== 'attentive') return;
    if (Math.random() > 0.08) return;
    const rect = wrap.getBoundingClientRect();
    const mkX = rect.left + rect.width / 2;
    const mkY = rect.top + rect.height / 2;
    const dx = (e.clientX - mkX) / (window.innerWidth / 2);
    const dy = (e.clientY - mkY) / (window.innerHeight / 2);
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
      lookAt(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
      setTimeout(() => { if (state === 'idle') lookForward(); }, 900);
    }
  }, { passive: true });

  resetSleepTimer();
    // ═══════════════════════════════════════════════════════
  // MINI AVATAR — استبدال ✨ بشخصية مشكاة صغيرة
  // ═══════════════════════════════════════════════════════
  const MINI_SVG = `
    <svg viewBox="0 0 100 100" class="mk-mini-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="mkMiniGlow">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="mkMiniBody" cx="0.4" cy="0.3">
          <stop offset="0%" stop-color="#fef3c7"/>
          <stop offset="35%" stop-color="#fcd34d"/>
          <stop offset="70%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </radialGradient>
        <linearGradient id="mkMiniFlame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#ea580c"/>
          <stop offset="40%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#fffbeb"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="68" r="44" fill="url(#mkMiniGlow)" class="mk-mini-glow"/>
      <g class="mk-mini-flame">
        <path d="M50 8 Q 60 22 56 34 Q 62 30 60 42 Q 52 38 50 46 Q 48 38 40 42 Q 38 30 44 34 Q 40 22 50 8 Z" fill="url(#mkMiniFlame)"/>
        <path d="M50 16 Q 54 24 52 32 Q 50 36 50 38 Q 50 36 48 32 Q 46 24 50 16 Z" fill="#fffbeb" opacity="0.9"/>
      </g>
      <ellipse cx="50" cy="68" rx="30" ry="28" fill="url(#mkMiniBody)"/>
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

  function swapSparkles(root) {
    if (!root || root.nodeType !== 1) return;
    const SELECTORS = '.brand-logo, .welcome-logo, .msg.assistant .msg-avatar';
    const candidates = [];
    if (root.matches && root.matches(SELECTORS)) candidates.push(root);
    if (root.querySelectorAll) candidates.push(...root.querySelectorAll(SELECTORS));

    candidates.forEach(el => {
      if (el.dataset.mkReplaced === '1') return;
      if (el.querySelector('.mk-mini-svg')) { el.dataset.mkReplaced = '1'; return; }
      if ((el.textContent || '').trim() === '✨') {
        el.innerHTML = MINI_SVG;
        el.dataset.mkReplaced = '1';
        el.classList.add('mk-avatar-mini');
      }
    });
  }

  // مراقبة الإضافات الجديدة (رسائل، شاشات الترحيب)
  const miniObs = new MutationObserver((muts) => {
    muts.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType === 1) swapSparkles(n); });
    });
  });
  if (document.body) miniObs.observe(document.body, { childList: true, subtree: true });

  // pass أولي
  const initPass = () => swapSparkles(document.body);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPass, { once: true });
  } else {
    initPass();
  }

  // مكرر كل ثانية كأمان (يغطي حالات نادرة)
  setInterval(initPass, 1500);

  console.log('🏮 Mishkat 2.0 loaded');
})();