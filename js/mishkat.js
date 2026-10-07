// ═══════════════════════════════════════════════════════
// MISHKAT — كائن حي يتفاعل مع المستخدم
// ═══════════════════════════════════════════════════════
(function mishkat() {
  'use strict';

  // ───── SVGs (Flame + Head + Eyes + Mouth) ─────
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
        <ellipse class="mk-blush mk-blush-l" cx="42" cy="82" rx="4" ry="2.5" fill="#f43f5e" opacity="0"/>
        <ellipse class="mk-blush mk-blush-r" cx="78" cy="82" rx="4" ry="2.5" fill="#f43f5e" opacity="0"/>
      </g>
    </svg>
  `;

  // ───── أنشئ العنصر ─────
  const wrap = document.createElement('div');
  wrap.id = 'mishkat';
  wrap.className = 'mishkat';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'مساعد مشكاة');
  wrap.innerHTML = SVG;
  if (document.body) document.body.appendChild(wrap);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wrap), { once: true });

  const $ = s => wrap.querySelector(s);
  const pupils = [$('.mk-pupil-l'), $('.mk-pupil-r')];
  const lids = [$('.mk-lid-l'), $('.mk-lid-r')];
  const mouthN = $('.mk-mouth-neutral');
  const mouthH = $('.mk-mouth-happy');
  const blush = [$('.mk-blush-l'), $('.mk-blush-r')];
  const flame = $('.mk-flame');

  // ───── State ─────
  let state = 'idle'; // idle | attentive | typing | thinking | happy | sleepy | peeking
  let sleepTimer = null;
  let blinkTimer = null;
  let peekTimer = null;
  let lastActivity = Date.now();

  function setState(newState, opts = {}) {
    if (state === newState && !opts.force) return;
    state = newState;
    wrap.setAttribute('data-state', newState);
    lastActivity = Date.now();
    resetSleepTimer();
  }

  // ───── Actions ─────
  function blink(duration = 160) {
    lids.forEach(l => l.setAttribute('ry', '10'));
    setTimeout(() => {
      if (state === 'sleepy' || state === 'peeking') return;
      lids.forEach(l => l.setAttribute('ry', '0'));
    }, duration);
  }

  function lookAt(x, y) {
    // x: -1 (يسار) → 1 (يمين) | y: -1 (فوق) → 1 (تحت)
    const px = (x || 0) * 2.5;
    const py = (y || 0) * 2.5;
    pupils.forEach(p => {
      p.style.transform = `translate(${px}px, ${py}px)`;
      p.style.transformOrigin = 'center';
    });
  }

  function lookAtInput() {
    // الإدخال عادة أسفل-يسار
    lookAt(-0.7, 0.6);
    setState('typing', { force: true });
  }

  function lookForward() {
    lookAt(0, 0);
  }

  function leanIn() {
    wrap.classList.add('leaning');
    setTimeout(() => wrap.classList.remove('leaning'), 1100);
  }

  function nod() {
    wrap.classList.add('nodding');
    setTimeout(() => wrap.classList.remove('nodding'), 750);
  }

  function thinkUp() {
    lookAt(0.4, -0.7);
    setState('thinking', { force: true });
  }

  function celebrate() {
    setState('happy', { force: true });
    // فتح الفم المبتسم
    mouthN.style.display = 'none';
    mouthH.style.display = 'block';
    blush.forEach(b => { b.setAttribute('opacity', '0.55'); });
    lookAt(0, 0);
    wrap.classList.add('bouncing');
    // شرارات
    spawnSparks(6);
    setTimeout(() => {
      mouthN.style.display = 'block';
      mouthH.style.display = 'none';
      blush.forEach(b => { b.setAttribute('opacity', '0'); });
      wrap.classList.remove('bouncing');
      setState('idle');
    }, 2400);
  }

  function peek() {
    // يغض عيونه مع "نظرة جانبية"
    setState('peeking', { force: true });
    lids.forEach(l => l.setAttribute('ry', '9'));
    lookAt(-0.3, 0);
    setTimeout(() => {
      if (state === 'peeking') {
        lids.forEach(l => l.setAttribute('ry', '0'));
        setState('typing', { force: true });
      }
    }, 900);
  }

  function sleep() {
    setState('sleepy', { force: true });
    lids.forEach(l => l.setAttribute('ry', '10'));
    lookAt(0, 0);
  }

  function wake() {
    if (state === 'sleepy') {
      lids.forEach(l => l.setAttribute('ry', '0'));
      setState('idle', { force: true });
      blink();
    }
    lastActivity = Date.now();
    resetSleepTimer();
  }

  function resetSleepTimer() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      if (state === 'idle') sleep();
    }, 65000);
  }

  // ───── Sparks ─────
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

  // ───── Idle loop ─────
  function idleLoop() {
    // رمشة عشوائية
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (state === 'idle' || state === 'attentive' || state === 'typing') blink();
      idleLoop();
    }, 2200 + Math.random() * 3500);
  }
  idleLoop();

  // ───── Wire to input ─────
  function wireUp(retries = 40) {
    const input = document.getElementById('msg');
    const sendBtn = document.getElementById('sendBtn');
    if (!input || !sendBtn) {
      if (retries > 0) return setTimeout(() => wireUp(retries - 1), 250);
      return;
    }

    input.addEventListener('focus', () => {
      wake();
      lookAtInput();
      setState('attentive', { force: true });
    });

    input.addEventListener('blur', () => {
      if (state === 'attentive' || state === 'typing') {
        lookForward();
        setState('idle', { force: true });
      }
    });

    let lastLength = 0;
    input.addEventListener('input', () => {
      wake();
      const val = input.value;
      const len = val.length;

      if (len === 0) {
        lookForward();
        setState('attentive', { force: true });
        return;
      }

      lookAtInput();

      // بعد 40 حرف: أحيانًا يقرب يشوف
      if (len > 40 && len - lastLength > 0 && Math.random() < 0.12) {
        leanIn();
      }
      // بعد 80 حرف: أحيانًا يغض عيونه (يحترم الخصوصية)
      if (len > 80 && Math.random() < 0.08) {
        peek();
      }
      lastLength = len;
    });

    sendBtn.addEventListener('click', () => {
      wake();
      nod();
      lookForward();
      setTimeout(() => thinkUp(), 700);
    });

    // التفاعل مع Enter من داخل الإدخال
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        nod();
        setTimeout(() => thinkUp(), 500);
      }
    });
  }
  wireUp();

  // ───── Hook: عندما يظهر رد المساعد ─────
  function wireReplyObserver(retries = 40) {
    const chatInner = document.getElementById('chatInner');
    if (!chatInner) {
      if (retries > 0) return setTimeout(() => wireReplyObserver(retries - 1), 250);
      return;
    }
    const obs = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        // رسالة مساعد جديدة (لكن ليست streaming فارغة)
        if (n.classList && n.classList.contains('msg') && n.classList.contains('assistant')) {
          // تأخير بسيط حتى ينتهي البث
          setTimeout(() => {
            // لا تتفاعل لو اختفى العنصر
            if (!n.isConnected) return;
            celebrate();
          }, 400);
        }
      }));
    });
    obs.observe(chatInner, { childList: true });
  }
  wireReplyObserver();

  // ───── Poke on click ─────
  wrap.addEventListener('click', () => {
    wake();
    celebrate();
  });

  // ───── Wake on any user interaction ─────
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (state === 'sleepy') wake();
      else {
        lastActivity = Date.now();
        resetSleepTimer();
      }
    }, { passive: true });
  });

  resetSleepTimer();
  console.log('🏮 Mishkat companion loaded');
})();