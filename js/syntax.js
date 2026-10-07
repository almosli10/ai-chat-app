// ═══════════════════════════════════════════
// SYNTAX HIGHLIGHTING — lazy loaded (highlight.js)
// ═══════════════════════════════════════════
(function syntaxHighlighting() {
  let loadPromise = null;

  function applyHighlight(container) {
    if (!container || !window.hljs) return;
    container.querySelectorAll('pre code').forEach(code => {
      if (code.dataset.highlighted === 'yes') return;
      try { hljs.highlightElement(code); } catch (e) {}
      const pre = code.parentElement;
      if (pre && !pre.querySelector('.code-lang-badge')) {
        const m = (code.className || '').match(/language-([\w-]+)/);
        const badge = document.createElement('span');
        badge.className = 'code-lang-badge';
        badge.textContent = m ? m[1].toLowerCase() : 'code';
        pre.appendChild(badge);
      }
    });
  }

  function ensureHljs() {
    if (window.hljs) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = window.loadHighlightJS()
      .then(() => console.log('✅ highlight.js loaded (lazy)'))
      .catch((e) => {
        console.warn('⚠️ highlight.js failed:', e);
        loadPromise = null;
      });
    return loadPromise;
  }

  function ensureAndHighlight(container) {
    ensureHljs().then(() => {
      applyHighlight(container);
      // أعد تلوين كل الرسائل الموجودة (لو كان هناك كود سابق)
      if (window.hljs) applyHighlight(document.getElementById('chatInner'));
    });
  }

  // Hook: addCopyButtons — كل مرة تُعرض رسالة جديدة
  if (typeof window.addCopyButtons === 'function' && !window.addCopyButtons.__hljsWrapped) {
    const orig = window.addCopyButtons;
    window.addCopyButtons = function(container) {
      const r = orig.apply(this, arguments);
      ensureAndHighlight(container);
      return r;
    };
    window.addCopyButtons.__hljsWrapped = true;
  }

  // عند التحميل — أضف الأيقونات الموجودة مسبقًا (بدون تحميل hljs فورًا)
  setTimeout(() => {
    const hasCode = document.querySelector('#chatInner pre code');
    if (hasCode) ensureAndHighlight(document.getElementById('chatInner'));
  }, 1500);

  console.log('🎨 Syntax highlighting ready (lazy mode)');
})();