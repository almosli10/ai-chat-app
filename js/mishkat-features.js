// ═══════════════════════════════════════════════════════
// MISHKAT FEATURES — Mood + Focus + TTS + Recos + Share
// ═══════════════════════════════════════════════════════
(function mishkatFeatures() {
  'use strict';

  // ═══════════════════════════════════════════════════════
  // FEATURE 2: MOOD SYSTEM
  // ═══════════════════════════════════════════════════════
  (function moodSystem() {
    const MOODS = {
      cheerful: { icon: '😊', name: 'مرح', prompt: '\n\n[المزاج: مرح. أجب بأسلوب خفيف وودود مع إيموجي طبيعية بلا إفراط.]' },
      academic: { icon: '🎓', name: 'أكاديمي', prompt: '\n\n[المزاج: أكاديمي. أجب بأسلوب رسمي منظم كأستاذ جامعي.]' },
      calm: { icon: '🧘', name: 'هادئ', prompt: '\n\n[المزاج: هادئ. أجب بأسلوب ناعم متأمل بلا استعجال.]' },
      fast: { icon: '⚡', name: 'سريع', prompt: '\n\n[المزاج: سريع. أجب بنقاط قصيرة موجزة بلا حشو.]' },
    };

    window.currentMood = localStorage.getItem('mishkat_mood') || 'cheerful';
    window.getMoodPrompt = () => MOODS[window.currentMood]?.prompt || '';

    window.setMood = function(mood) {
      if (!MOODS[mood]) return;
      window.currentMood = mood;
      localStorage.setItem('mishkat_mood', mood);
      if (typeof toast === 'function') toast(`${MOODS[mood].icon} المزاج: ${MOODS[mood].name}`);
      updateIndicator();
    };

    function updateIndicator() {
      let el = document.getElementById('mood-indicator');
      if (!el) {
        el = document.createElement('button');
        el.id = 'mood-indicator';
        el.className = 'mood-indicator';
        el.title = 'مزاج مِشكاة';
        el.onclick = (e) => { e.stopPropagation(); openPanel(); };
        const mk = document.getElementById('mishkat');
        if (mk) mk.appendChild(el);
      }
      el.textContent = MOODS[window.currentMood]?.icon || '😊';
    }

    function openPanel() {
      let p = document.getElementById('mood-panel');
      if (p) { p.remove(); return; }
      p = document.createElement('div');
      p.id = 'mood-panel';
      p.className = 'mood-panel';
      p.innerHTML = `
        <div class="mood-panel-title">مزاج مِشكاة</div>
        <div class="mood-grid">
          ${Object.entries(MOODS).map(([k, m]) => `
            <button class="mood-btn ${k === window.currentMood ? 'active' : ''}" data-mood="${k}">
              <span class="mood-icon">${m.icon}</span>
              <span class="mood-name">${m.name}</span>
            </button>
          `).join('')}
        </div>
      `;
      document.body.appendChild(p);
      requestAnimationFrame(() => p.classList.add('show'));
      p.querySelectorAll('.mood-btn').forEach(b => {
        b.onclick = () => { setMood(b.dataset.mood); p.remove(); };
      });
      setTimeout(() => {
        const close = (e) => {
          if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', close); }
        };
        document.addEventListener('click', close);
      }, 100);
    }

    // Hook: append mood to system prompt before send
    const hookSend = (r = 30) => {
      if (typeof window.send !== 'function') {
        if (r > 0) return setTimeout(() => hookSend(r - 1), 250);
        return;
      }
      if (window.send.__moodWrapped) return;
      const orig = window.send;
      window.send = function () {
        try {
          const c = allChats[currentChatId];
          if (c && c.messages[0]?.role === 'system') {
            const base = c.messages[0].content.split('\n\n[المزاج:')[0];
            c.messages[0].content = base + getMoodPrompt();
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      window.send.__moodWrapped = true;
    };
    hookSend();

    const wait = setInterval(() => {
      if (document.getElementById('mishkat')) { updateIndicator(); clearInterval(wait); }
    }, 300);
    console.log('😊 Mood ready');
  })();

  // ═══════════════════════════════════════════════════════
  // FEATURE 5: FOCUS MODE (Pomodoro)
  // ═══════════════════════════════════════════════════════
  (function focusMode() {
    const FOCUS = 25 * 60, BREAK = 5 * 60;
    let s = { active: false, phase: 'focus', remaining: 0, timer: null, cycles: 0 };

    function start() {
      s.active = true; s.phase = 'focus'; s.remaining = FOCUS; s.cycles = 0;
      showWidget(); tick();
      if (typeof toast === 'function') toast('🎯 وضع التركيز — 25 دقيقة');
    }
    function stop() {
      s.active = false; clearTimeout(s.timer); hideWidget();
      if (typeof toast === 'function') toast('⏹️ تم إيقاف وضع التركيز');
    }
    function tick() {
      if (!s.active) return;
      s.remaining--;
      update();
      if (s.remaining <= 0) {
        if (s.phase === 'focus') {
          s.cycles++; s.phase = 'break'; s.remaining = BREAK;
          if (typeof playSound === 'function') playSound('receive');
          if (typeof fireConfetti === 'function') fireConfetti(60);
          notify('🎉 أكملت جلسة تركيز!', 'استرح 5 دقائق');
        } else {
          s.phase = 'focus'; s.remaining = FOCUS;
          if (typeof playSound === 'function') playSound('notif');
          notify('☕ انتهت الراحة', 'ابدأ جلسة جديدة');
        }
      }
      s.timer = setTimeout(tick, 1000);
    }
    function notify(t, b) {
      if (typeof showDesktopNotification === 'function') showDesktopNotification(t, b, null, true);
      else if (typeof toast === 'function') toast(t + ' — ' + b, 4000);
    }
    function showWidget() {
      let w = document.getElementById('focus-widget');
      if (!w) {
        w = document.createElement('div');
        w.id = 'focus-widget'; w.className = 'focus-widget';
        w.innerHTML = `<div class="focus-phase" id="focus-phase">🎯 تركيز</div><div class="focus-time" id="focus-time">25:00</div><button class="focus-stop" id="focus-stop">✕</button>`;
        document.body.appendChild(w);
        w.querySelector('#focus-stop').onclick = stop;
      }
      w.classList.add('show');
      update();
    }
    function hideWidget() {
      const w = document.getElementById('focus-widget');
      if (w) w.classList.remove('show');
    }
    function update() {
      const t = document.getElementById('focus-time');
      const p = document.getElementById('focus-phase');
      if (!t) return;
      const m = Math.floor(s.remaining / 60), sec = s.remaining % 60;
      t.textContent = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
      if (p) p.textContent = s.phase === 'focus' ? `🎯 تركيز #${s.cycles + 1}` : '☕ راحة';
      const w = document.getElementById('focus-widget');
      if (w) w.dataset.phase = s.phase;
    }
    window.toggleFocusMode = () => s.active ? stop() : start();
    console.log('🎯 Focus ready');
  })();

  // ═══════════════════════════════════════════════════════
  // FEATURE 11: EXPRESSIVE TTS
  // ═══════════════════════════════════════════════════════
  (function expressiveTTS() {
    function detect(text) {
      let rate = 1.0, pitch = 1.0;
      if (/[؟?]/.test(text)) { pitch += 0.1; rate -= 0.05; }
      if (/[!]/.test(text)) { pitch += 0.15; rate += 0.05; }
      if (/رائع|ممتاز|عظيم|جميل|سعيد|🎉|✨|🎊/.test(text)) { pitch += 0.12; rate += 0.03; }
      if (/تحذير|خطير|انتبه|احذر|⚠️|🚨/.test(text)) { rate -= 0.1; pitch -= 0.05; }
      if (/آسف|للأسف|حزين|هادئ|تأمل|همس/.test(text)) { rate -= 0.15; pitch -= 0.08; }
      if (/```|function |const |def |class /.test(text)) { rate += 0.02; }
      return { rate: Math.max(0.7, Math.min(1.3, rate)), pitch: Math.max(0.7, Math.min(1.3, pitch)) };
    }

    // Patch SpeechSynthesis.speak to inject emotion
    if (!window.speechSynthesis.__expressiveHooked) {
      const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (u) {
        if (window.__ttsEmotion) {
          try {
            u.rate = Math.max(0.1, Math.min(2, (u.rate || 1) * window.__ttsEmotion.rate));
            u.pitch = Math.max(0, Math.min(2, (u.pitch || 1) * window.__ttsEmotion.pitch));
          } catch (e) {}
        }
        return origSpeak(u);
      };
      window.speechSynthesis.__expressiveHooked = true;
    }

    const hook = (r = 30) => {
      if (typeof window.speakMessage !== 'function') {
        if (r > 0) return setTimeout(() => hook(r - 1), 300);
        return;
      }
      if (window.speakMessage.__expressive) return;
      const orig = window.speakMessage;
      window.speakMessage = function (btn, text) {
        window.__ttsEmotion = detect(text || '');
        return orig.apply(this, arguments);
      };
      window.speakMessage.__expressive = true;
    };
    hook();
    console.log('🎵 Expressive TTS ready');
  })();

  // ═══════════════════════════════════════════════════════
  // FEATURE 13: SMART RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════
  (function smartRecos() {
    const DISMISS_KEY = 'mishkat_rec_dismissed_v1';
    const LAST_KEY = 'mishkat_rec_last_shown';
    const INTERVAL = 3 * 24 * 60 * 60 * 1000;

    const RULES = [
      { id: 'py', check: () => (JSON.stringify(allChats).toLowerCase().match(/python|بايثون/g) || []).length >= 5,
        icon: '💻', title: 'تحب Python!', body: 'جرّب شخصية "مبرمج" للحصول على ردود أكثر تخصصًا.',
        action: { label: 'جرّب', run: () => typeof openPersonas === 'function' && openPersonas() } },
      { id: 'news', check: () => {
          const t = JSON.stringify(allChats).toLowerCase();
          return /أخبار|news/.test(t) && (t.match(/أخبار|news/g) || []).length >= 3;
        },
        icon: '🔍', title: 'تسأل عن الأخبار', body: 'فعّل الوكيل (Ctrl+B) للبحث التلقائي في الإنترنت.',
        action: { label: 'معلومة', run: () => typeof openShortcuts === 'function' && openShortcuts() } },
      { id: 'enc', check: () => {
          const total = Object.values(allChats).reduce((a, c) => a + c.messages.length, 0);
          return total > 50 && typeof encKey !== 'undefined' && !encKey;
        },
        icon: '🔐', title: 'محادثاتك كثيرة', body: 'فعّل التشفير E2E لحماية خصوصيتك.',
        action: { label: 'فعّل', run: () => typeof openEncryption === 'function' && openEncryption() } },
      { id: 'themes', check: () => {
          const used = JSON.parse(localStorage.getItem('mishkat_themes_used') || '[]');
          return used.length < 3 && Object.keys(allChats).length >= 3;
        },
        icon: '🎨', title: 'جرّب ثيمات جديدة', body: 'عندنا 9 ثيمات فاخرة، كل واحدة لها إحساس مختلف.',
        action: { label: 'افتح', run: () => typeof openThemes === 'function' && openThemes() } },
      { id: 'focus', check: () => {
          const h = new Date().getHours();
          return h >= 9 && h <= 17;
        },
        icon: '🎯', title: 'وقت التركيز!', body: 'جرّب Pomodoro — 25 دقيقة تركيز ثم راحة.',
        action: { label: 'ابدأ', run: () => window.toggleFocusMode && window.toggleFocusMode() } },
    ];

    function shouldShow() {
      const last = parseInt(localStorage.getItem(LAST_KEY) || '0');
      if (Date.now() - last < INTERVAL) return null;
      const dis = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
      for (const r of RULES) {
        if (dis.includes(r.id)) continue;
        try { if (r.check()) return r; } catch (e) {}
      }
      return null;
    }

    function show(rec) {
      localStorage.setItem(LAST_KEY, Date.now().toString());
      const el = document.createElement('div');
      el.className = 'rec-toast';
      el.innerHTML = `
        <div class="rec-icon">${rec.icon}</div>
        <div class="rec-body">
          <div class="rec-title">${rec.title}</div>
          <div class="rec-text">${rec.body}</div>
          <div class="rec-actions">
            <button class="rec-go">${rec.action.label}</button>
            <button class="rec-later">لاحقًا</button>
          </div>
        </div>
        <button class="rec-x">✕</button>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      el.querySelector('.rec-go').onclick = () => { try { rec.action.run(); } catch (e) {} dismiss(rec.id, el); };
      el.querySelector('.rec-later').onclick = () => dismiss(rec.id, el, true);
      el.querySelector('.rec-x').onclick = () => dismiss(rec.id, el);
    }
    function dismiss(id, el, later) {
      if (!later) {
        const l = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
        if (!l.includes(id)) l.push(id);
        localStorage.setItem(DISMISS_KEY, JSON.stringify(l));
      }
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }

    setTimeout(() => {
      const r = shouldShow();
      if (r) show(r);
    }, 30000);
    console.log('🎁 Smart recos ready');
  })();

  // ═══════════════════════════════════════════════════════
  // FEATURE 15: SHARE AS IMAGE
  // ═══════════════════════════════════════════════════════
  (function shareAsImage() {
    async function buildCard(text) {
      const W = 1080, PAD = 80;
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d');
      const font = '"IBM Plex Sans Arabic", "Segoe UI", sans-serif';

      // Measure lines
      ctx.font = `400 32px ${font}`;
      const maxW = W - PAD * 2;
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      const lh = 50;
      const H = Math.max(720, 320 + lines.length * lh + 140);
      cv.width = W; cv.height = H;

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0d0819');
      bg.addColorStop(0.5, '#1a0f33');
      bg.addColorStop(1, '#0a0518');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top accent
      const acc = ctx.createLinearGradient(0, 0, W, 0);
      acc.addColorStop(0, 'transparent');
      acc.addColorStop(0.5, '#fbbf24');
      acc.addColorStop(1, 'transparent');
      ctx.fillStyle = acc;
      ctx.fillRect(0, 0, W, 3);

      // Glow
      const g = ctx.createRadialGradient(W/2, 120, 30, W/2, 120, 500);
      g.addColorStop(0, 'rgba(251,191,36,0.18)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 500);

      // Header
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fef3c7';
      ctx.font = `700 44px ${font}`;
      ctx.fillText('مِشكاة', W - PAD, 120);
      ctx.fillStyle = 'rgba(168,85,247,0.75)';
      ctx.font = `400 22px ${font}`;
      ctx.fillText('مساعدك الذكي', W - PAD, 158);

      // Body
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `400 32px ${font}`;
      const startY = 250;
      lines.forEach((l, i) => ctx.fillText(l, W - PAD, startY + i * lh));

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `400 20px ${font}`;
      ctx.fillText('ai-chat-app-two-lime.vercel.app', W/2, H - 55);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.font = `400 18px ${font}`;
      ctx.fillText(new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }), W - PAD, H - 55);

      return cv;
    }

    async function share(text) {
      if (!text || text.length < 5) { if (typeof toast === 'function') toast('⚠️ الرسالة قصيرة'); return; }
      if (typeof toast === 'function') toast('🎨 جاري إنشاء الصورة...');
      try {
        const cv = await buildCard(text);
        cv.toBlob(async (blob) => {
          if (!blob) { if (typeof toast === 'function') toast('❌ فشل'); return; }
          const file = new File([blob], `mishkat-${Date.now()}.png`, { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'من مِشكاة' }); return; } catch (e) {}
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `mishkat-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          if (typeof toast === 'function') toast('✅ تم حفظ الصورة');
        }, 'image/png');
      } catch (e) { console.error(e); if (typeof toast === 'function') toast('❌ فشل'); }
    }

    function addButtons() {
      const ci = document.getElementById('chatInner');
      if (!ci || ci.__shareObserved) return;
      ci.__shareObserved = true;
      const obs = new MutationObserver((muts) => {
        muts.forEach(m => m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.classList?.contains('msg') && n.classList?.contains('assistant')) {
            setTimeout(() => {
              if (!n.isConnected) return;
              const a = n.querySelector('.msg-actions');
              const b = n.querySelector('.msg-bubble');
              if (!a || !b || a.querySelector('.share-img-btn')) return;
              const btn = document.createElement('button');
              btn.className = 'msg-action-btn share-img-btn';
              btn.title = 'مشاركة كصورة';
              btn.textContent = '📸';
              btn.onclick = (e) => { e.stopPropagation(); share(b.innerText || b.textContent); };
              a.appendChild(btn);
            }, 1200);
          }
        }));
      });
      obs.observe(ci, { childList: true });
    }
    addButtons();

    window.shareMessageImage = share;
    console.log('📸 Share as Image ready');
  })();

  console.log('✨ Mishkat features loaded');
})();