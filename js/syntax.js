// ═══════ SYNTAX HIGHLIGHTING ═══════
    (function syntaxHighlighting() {
      if (typeof hljs === 'undefined') { console.warn('⚠️ hljs missing'); return; }

      function highlightCodeBlocks(container) {
        if (!container) return;
        container.querySelectorAll('pre code').forEach(code => {
          if (code.dataset.highlighted === 'yes') return;
          try { hljs.highlightElement(code); } catch (e) {}
          const pre = code.parentElement;
          if (pre && !pre.querySelector('.code-lang-badge')) {
            const match = (code.className || '').match(/language-([\w-]+)/);
            const lang = match ? match[1].toLowerCase() : 'code';
            const badge = document.createElement('span');
            badge.className = 'code-lang-badge';
            badge.textContent = lang;
            pre.appendChild(badge);
          }
        });
      }

      if (typeof window.addCopyButtons === 'function' && !window.addCopyButtons.__hljsWrapped) {
        const orig = window.addCopyButtons;
        window.addCopyButtons = function(container) {
          const r = orig.apply(this, arguments);
          try { highlightCodeBlocks(container); } catch (e) {}
          return r;
        };
        window.addCopyButtons.__hljsWrapped = true;
      }

      setTimeout(() => highlightCodeBlocks(document.getElementById('chatInner')), 1000);
      console.log('🎨 Syntax highlighting ready');
    })();
