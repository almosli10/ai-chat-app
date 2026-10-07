// ═══════════════════════════════════════════════════════
// PERFORMANCE — تحسينات أداء عميقة
// ═══════════════════════════════════════════════════════
(function perf() {
  'use strict';

  // 1) Debounce للبحث
  const hookSearch = (r = 30) => {
    const el = document.getElementById('searchInput');
    if (!el) {
      if (r > 0) return setTimeout(() => hookSearch(r - 1), 250);
      return;
    }
    if (el.__debounced) return;
    el.__debounced = true;
    el.removeAttribute('oninput');
    let t;
    el.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (typeof renderSidebar === 'function') renderSidebar();
      }, 180);
    });
    console.log('⚡ Search debounced');
  };
  hookSearch();

  // 2) Passive event listeners للـ scroll
  ['chat', 'chatList'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.__passiveHooked) {
      el.__passiveHooked = true;
      // الـ listeners الموجودة تستخدم addEventListener مع options
      // نضيف stub لتحويل أي listener جديد إلى passive تلقائياً
      const orig = el.addEventListener.bind(el);
      el.addEventListener = function (type, fn, opts) {
        if (type === 'scroll' || type === 'touchstart' || type === 'touchmove' || type === 'wheel') {
          if (typeof opts === 'boolean') opts = { passive: true, capture: opts };
          else opts = { ...opts, passive: true };
        }
        return orig(type, fn, opts);
      };
    }
  });

  // 3) requestIdleCallback للمهام غير العاجلة
  window.idleTask = function (fn, timeout = 2000) {
    if ('requestIdleCallback' in window) {
      return requestIdleCallback(fn, { timeout });
    }
    return setTimeout(fn, 1);
  };

  // 4) Throttle للـ mousemove
  window.throttle = function (fn, wait = 100) {
    let last = 0, timer;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => {
          last = Date.now();
          fn.apply(this, args);
        }, wait - (now - last));
      }
    };
  };

  // 5) Cache للـ DOM queries
  const cache = new Map();
  window.$cached = function (sel) {
    if (!cache.has(sel)) cache.set(sel, document.querySelector(sel));
    return cache.get(sel);
  };

  // 6) Lazy rendering للرسائل الطويلة
  const hookSwitchChat = (r = 30) => {
    if (typeof window.switchChat !== 'function') {
      if (r > 0) return setTimeout(() => hookSwitchChat(r - 1), 300);
      return;
    }
    if (window.switchChat.__lazyRendered) return;
    const orig = window.switchChat;
    window.switchChat = function (id) {
      try {
        const chat = allChats[id];
        if (chat && chat.messages.length > 60) {
          // سيتم عرض الرسائل على دفعات
          return lazySwitchChat(id, orig);
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    window.switchChat.__lazyRendered = true;
    console.log('⚡ Lazy message rendering hooked');
  };
  hookSwitchChat();

  function lazySwitchChat(id, orig) {
    const chat = allChats[id];
    const total = chat.messages.length;
    const BATCH = 30;
    let shown = 0;
    chatInner.innerHTML = '';
    const indicator = document.createElement('div');
    indicator.className = 'lazy-loading-indicator';
    indicator.textContent = '⏳ جاري تحميل المحادثة...';
    chatInner.appendChild(indicator);

    // استخدم النسخة الأصلية لكن اقطع الرسائل
    const fullMessages = chat.messages.slice();
    chat.messages = fullMessages.slice(-BATCH);
    orig.call(window, id);
    chat.messages = fullMessages;
    setTimeout(() => { const ind = chatInner.querySelector('.lazy-loading-indicator'); if (ind) ind.remove(); }, 300);

    // أضف زر "تحميل المزيد" إذا كان هناك المزيد
    if (total > BATCH) {
      const btn = document.createElement('button');
      btn.className = 'load-more-msgs';
      btn.textContent = `⬆️ تحميل ${total - BATCH} رسالة سابقة`;
      btn.onclick = () => {
        btn.remove();
        // أعد البناء الكامل
        const savedMessages = chat.messages;
        chat.messages = fullMessages;
        orig.call(window, id);
        chat.messages = savedMessages;
      };
      chatInner.insertBefore(btn, chatInner.firstChild);
    }
  }

  // 7) تنظيف الـ toast timeouts القديمة
  setInterval(() => {
    if (document.querySelectorAll('.confetti-piece').length > 200) {
      document.querySelectorAll('.confetti-piece').forEach((el, i) => {
        if (i > 100) el.remove();
      });
    }
  }, 10000);

  // 8) مؤشر أداء بسيط
  if (window.performance && performance.getEntriesByType) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          const dcl = Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart);
          const total = Math.round(nav.loadEventEnd - nav.startTime);
          console.log(`⚡ Perf: DOMContentLoaded ${dcl}ms | Total ${total}ms`);
        }
      }, 100);
    });
  }

  console.log('⚡ Performance enhancements ready');
})();