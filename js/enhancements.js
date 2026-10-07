// ═══════ UI/UX ENHANCEMENTS ═══════
    function haptic(ms = 8) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch(e){} }
    document.addEventListener('click', (e) => {
      if (e.target.closest('button, .chat-item, .suggestion-card, .template-chip, .theme-card, .persona-card, .msg-action-btn')) haptic(8);
    }, true);

    (function initAutoTheme() {
      if (localStorage.getItem('theme')) return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) document.body.setAttribute('data-theme', 'dark');
      mq.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      });
    })();

    function addTooltips() {
      document.querySelectorAll('.icon-btn, .send-btn, .menu-btn, .top-actions button').forEach(btn => {
        const t = btn.getAttribute('title');
        if (t && !btn.hasAttribute('data-tooltip')) { btn.setAttribute('data-tooltip', t); btn.removeAttribute('title'); }
      });
    }
    setTimeout(addTooltips, 300);

    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button, .new-chat-btn, .send-btn');
      if (!b) return;
      b.classList.add('ripple');
      const r = b.getBoundingClientRect();
      b.style.setProperty('--rx', ((e.clientX - r.left) / r.width * 100) + '%');
      b.style.setProperty('--ry', ((e.clientY - r.top) / r.height * 100) + '%');
      setTimeout(() => b.classList.remove('ripple'), 500);
    });

    function fireConfetti(count = 45) {
      const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f43f5e'];
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        p.style.animation = `confettiFall ${1.6 + Math.random() * 1.4}s cubic-bezier(0.3, 0.6, 0.6, 1) ${Math.random() * 0.4}s forwards`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 3600);
      }
    }

    (function initScrollButton() {
      const btn = document.createElement('button');
      btn.className = 'scroll-bottom-btn';
      btn.innerHTML = '↓';
      btn.setAttribute('aria-label', 'الأسفل');
      const chatEl = document.getElementById('chat');
      btn.onclick = () => chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
      document.querySelector('.main-content').appendChild(btn);
      chatEl.addEventListener('scroll', () => {
        const far = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight > 300;
        btn.classList.toggle('show', far);
      }, { passive: true });
    })();

    (function initStickyHeader() {
      const tb = document.querySelector('.top-bar');
      const c = document.getElementById('chat');
      c.addEventListener('scroll', () => tb.classList.toggle('scrolled', c.scrollTop > 10), { passive: true });
    })();

    const skeletonObserver = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        let ti = null;
        if (n.classList && n.classList.contains('typing-indicator')) ti = n;
        else if (n.querySelector) ti = n.querySelector('.typing-indicator');
        if (ti) {
          const bubble = ti.closest('.msg-bubble');
          if (bubble && !bubble.querySelector('.skeleton-bubble')) {
            bubble.innerHTML = '<div class="skeleton-bubble"><div class="sk-line skeleton w-90"></div><div class="sk-line skeleton w-70"></div><div class="sk-line skeleton w-50"></div></div>';
          }
        }
      }));
    });
    skeletonObserver.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      const iw = document.getElementById('inputRow');
      const ab = document.getElementById('agentBtn');
      if (iw && ab) iw.classList.toggle('agent-on', ab.classList.contains('active'));
    }, 300);

    (function firstMsgConfetti() {
      if (localStorage.getItem('celebrated')) return;
      const check = setInterval(() => {
        const total = document.querySelectorAll('#chatInner .msg.user').length;
        if (total >= 1 && !localStorage.getItem('celebrated')) {
          fireConfetti(60);
          localStorage.setItem('celebrated', '1');
          clearInterval(check);
        }
      }, 800);
    })();

    setTimeout(() => {
      ['openSettings','openThemes','openPersonas','openSounds','openNotifications','openMemory','openStats','openShortcuts','openEncryption'].forEach(fn => {
        if (typeof window[fn] === 'function' && !window[fn].__wrapped) {
          const orig = window[fn];
          const wrapped = function(...args) { const r = orig.apply(this, args); setTimeout(addTooltips, 200); return r; };
          wrapped.__wrapped = true;
          window[fn] = wrapped;
        }
      });
    }, 500);

    window.addEventListener('beforeunload', () => {
      if (typeof saveAllChats === 'function') try { saveAllChats(); } catch(e){}
    });
    // ═══════ إغلاق النوافذ عند الضغط على الخلفية ═══════
    (function modalBackdropClose() {
      document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('modal-overlay')) return;
        e.target.classList.remove('show');
      }, true);

      // إغلاق بـ Esc لكل النوافذ المفتوحة
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
      }, true);
    })();

        // ═══════ POLISH PASS ═══════
    (function polishPass() {
      // 1) وقت الرسالة — Tooltip خفيف يظهر عند المرور
      function attachTimeToMessage(msgDiv) {
        if (!msgDiv || msgDiv.querySelector('.msg-time')) return;
        const body = msgDiv.querySelector('.msg-body');
        if (!body) return;
        const timeEl = document.createElement('span');
        timeEl.className = 'msg-time';
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        timeEl.title = now.toLocaleString('ar-EG', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit'
        });
        body.appendChild(timeEl);
      }

      // Hook: addMessage
      function hookAddMessage(retries) {
        if (typeof window.addMessage !== 'function') {
          if (retries > 0) return setTimeout(() => hookAddMessage(retries - 1), 200);
          return;
        }
        if (window.addMessage.__polished) return;
        const orig = window.addMessage;
        window.addMessage = function (...args) {
          const result = orig.apply(this, args);
          try {
            if (result && result.div) attachTimeToMessage(result.div);
          } catch (e) {}
          return result;
        };
        window.addMessage.__polished = true;
      }
      hookAddMessage(20);

      // 2) إضافة وقت للرسائل الموجودة مسبقًا عند التبديل
      setTimeout(() => {
        document.querySelectorAll('#chatInner .msg').forEach(attachTimeToMessage);
      }, 1500);
    })();

        // ═══════ نافذة الإعدادات والقائمة السريعة ═══════
    window.openQuickSettings = function() {
      const modal = document.getElementById('quickSettingsModal');
      if (!modal) { console.warn('⚠️ quickSettingsModal غير موجود في HTML'); return; }
      modal.classList.add('show');
      if (window.lucide && lucide.createIcons) {
        try { lucide.createIcons(); } catch (e) {}
      }
      if (typeof playSound === 'function') playSound('click');
    };


    console.log('✨ UI/UX Enhancements loaded');
