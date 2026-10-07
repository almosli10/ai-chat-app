// ═══════════════════════════════════════════
// ICONS — SVG icons (lazy loaded)
// ═══════════════════════════════════════════
(function initIcons() {
  const ICON_MAP = {
    '⚙️': 'settings', '🎨': 'palette', '🎭': 'venetian-mask',
    '📊': 'bar-chart-3', '🔊': 'volume-2', '🔐': 'lock',
    '🔔': 'bell', '☁️': 'cloud', '📤': 'upload',
    '📥': 'download', '🧠': 'brain', '⌨️': 'keyboard',
    '🤖': 'bot', '🔗': 'link', '📄': 'file-text',
    '📎': 'paperclip', '🎤': 'mic',
  };

  function replaceInElement(el) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach(node => {
      const text = node.textContent;
      for (const [emoji, iconName] of Object.entries(ICON_MAP)) {
        if (!text.includes(emoji)) continue;
        const parts = text.split(emoji);
        const frag = document.createDocumentFragment();
        parts.forEach((part, idx) => {
          if (part) frag.appendChild(document.createTextNode(part));
          if (idx < parts.length - 1) {
            const wrap = document.createElement('span');
            wrap.className = 'ui-icon-wrap';
            const i = document.createElement('i');
            i.setAttribute('data-lucide', iconName);
            wrap.appendChild(i);
            frag.appendChild(wrap);
          }
        });
        node.parentNode.replaceChild(frag, node);
        return;
      }
    });
  }

  async function applyIcons() {
    // حمّل lucide عند الحاجة فقط
    if (!window.lucide) {
      try {
        await window.loadLucide();
        console.log('✅ lucide loaded (lazy)');
      } catch (e) {
        console.warn('⚠️ lucide failed:', e);
        return;
      }
    }
    const selectors = [
      '.sidebar-footer button',
      '.top-actions button',
      '.input-wrapper .icon-btn',
      '.new-chat-btn',
      '.quick-settings-grid button',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => replaceInElement(el));
    });
    if (window.lucide && lucide.createIcons) {
      try { lucide.createIcons(); } catch (e) {}
    }
  }

  function tryInit(retries) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => tryInit(retries), { once: true });
      return;
    }
    // تأخير بسيط عشان الصفحة تكون جاهزة
    setTimeout(() => {
      applyIcons();
      console.log('🎯 SVG icons ready');
    }, 400);
  }
  tryInit(20);
})();