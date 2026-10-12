// js/dialogs.js — نظام نوافذ مخصص (بديل alert/confirm/prompt)
(function dialogs() {
  'use strict';

  // ═══ CSS ═══
  (function injectCSS() {
    if (document.getElementById('mishkat-dialogs-css')) return;
    const style = document.createElement('style');
    style.id = 'mishkat-dialogs-css';
    style.textContent = `
      .mk-dialog-overlay {
        position: fixed; inset: 0; z-index: 1000000;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(14px) saturate(1.3);
        -webkit-backdrop-filter: blur(14px) saturate(1.3);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .mk-dialog-overlay.show { opacity: 1; }
      
      .mk-dialog {
        background: linear-gradient(160deg, #1a0f33, #0d0819);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 24px;
        padding: 26px 24px 20px;
        width: 100%;
        max-width: 440px;
        color: #fff;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        direction: rtl;
        box-shadow: 
          0 40px 100px -20px rgba(0,0,0,0.9),
          0 0 60px -15px rgba(251, 191, 36, 0.25),
          inset 0 1px 0 rgba(255,255,255,0.08);
        transform: scale(0.9) translateY(20px);
        opacity: 0;
        transition: all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
      }
      .mk-dialog-overlay.show .mk-dialog {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
      
      .mk-dialog-icon {
        width: 60px; height: 60px;
        margin: 0 auto 14px;
        border-radius: 20px;
        display: flex; align-items: center; justify-content: center;
        font-size: 30px;
        position: relative;
      }
      .mk-dialog-icon.info {
        background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15));
        border: 1px solid rgba(99,102,241,0.4);
        box-shadow: 0 8px 30px -10px rgba(99,102,241,0.6);
      }
      .mk-dialog-icon.success {
        background: linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15));
        border: 1px solid rgba(16,185,129,0.4);
        box-shadow: 0 8px 30px -10px rgba(16,185,129,0.6);
      }
      .mk-dialog-icon.warning {
        background: linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15));
        border: 1px solid rgba(245,158,11,0.4);
        box-shadow: 0 8px 30px -10px rgba(245,158,11,0.6);
      }
      .mk-dialog-icon.danger {
        background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15));
        border: 1px solid rgba(239,68,68,0.4);
        box-shadow: 0 8px 30px -10px rgba(239,68,68,0.6);
      }
      .mk-dialog-icon.question {
        background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(139,92,246,0.15));
        border: 1px solid rgba(168,85,247,0.4);
        box-shadow: 0 8px 30px -10px rgba(168,85,247,0.6);
      }
      
      .mk-dialog-title {
        font-size: 17px;
        font-weight: 800;
        text-align: center;
        margin-bottom: 10px;
        color: #fbbf24;
      }
      .mk-dialog-message {
        font-size: 13.5px;
        color: rgba(255,255,255,0.85);
        line-height: 1.7;
        text-align: center;
        margin-bottom: 18px;
        white-space: pre-line;
      }
      
      .mk-dialog-input {
        width: 100%;
        padding: 12px 14px;
        background: rgba(255,255,255,0.06);
        border: 1.5px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        color: #fff;
        font-family: inherit;
        font-size: 14px;
        outline: none;
        margin-bottom: 16px;
        transition: all 0.2s;
        direction: rtl;
      }
      .mk-dialog-input:focus {
        border-color: #fbbf24;
        background: rgba(251,191,36,0.08);
        box-shadow: 0 0 0 4px rgba(251,191,36,0.15);
      }
      .mk-dialog-input::placeholder { color: rgba(255,255,255,0.35); }
      
      .mk-dialog-actions {
        display: flex;
        gap: 10px;
        margin-top: 4px;
      }
      .mk-dialog-btn {
        flex: 1;
        padding: 12px 18px;
        border: none;
        border-radius: 12px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.34, 1.3, 0.64, 1);
      }
      .mk-dialog-btn:active { transform: scale(0.96); }
      
      .mk-dialog-btn.primary {
        background: linear-gradient(135deg, #fbbf24, #ec4899);
        color: #fff;
        box-shadow: 0 6px 20px rgba(251,191,36,0.4);
      }
      .mk-dialog-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(251,191,36,0.55);
      }
      
      .mk-dialog-btn.danger {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #fff;
        box-shadow: 0 6px 20px rgba(239,68,68,0.4);
      }
      .mk-dialog-btn.danger:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(239,68,68,0.55);
      }
      
      .mk-dialog-btn.success {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff;
        box-shadow: 0 6px 20px rgba(16,185,129,0.4);
      }
      .mk-dialog-btn.success:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(16,185,129,0.55);
      }
      
      .mk-dialog-btn.cancel {
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.85);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .mk-dialog-btn.cancel:hover {
        background: rgba(255,255,255,0.14);
        color: #fff;
      }
      
      @media (max-width: 480px) {
        .mk-dialog { padding: 22px 18px 16px; border-radius: 20px; }
        .mk-dialog-icon { width: 54px; height: 54px; font-size: 26px; }
        .mk-dialog-title { font-size: 15.5px; }
        .mk-dialog-message { font-size: 13px; }
        .mk-dialog-actions { flex-direction: column-reverse; }
      }
    `;
    document.head.appendChild(style);
  })();

  // ═══ النواة ═══
  function createDialog({ type = 'info', icon, title, message, input = null, buttons = [] }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'mk-dialog-overlay';
      
      const iconEmoji = icon || {
        info: '💬', success: '✅', warning: '⚠️', danger: '🗑️', question: '❓'
      }[type] || '💬';
      
      let inputHTML = '';
      if (input) {
        inputHTML = `<input type="${input.type || 'text'}" class="mk-dialog-input" 
          placeholder="${input.placeholder || ''}" 
          value="${input.value || ''}" 
          ${input.maxLength ? `maxlength="${input.maxLength}"` : ''} />`;
      }
      
      const buttonsHTML = buttons.map((btn, i) => 
        `<button class="mk-dialog-btn ${btn.style || 'cancel'}" data-idx="${i}">${btn.label}</button>`
      ).join('');
      
      overlay.innerHTML = `
        <div class="mk-dialog" role="dialog" aria-modal="true" 
             ${title ? `aria-labelledby="mkDialogTitle_${Date.now()}"` : ''}
             aria-describedby="mkDialogMsg">
          <div class="mk-dialog-icon ${type}" aria-hidden="true">${iconEmoji}</div>
          ${title ? `<div class="mk-dialog-title" id="mkDialogTitle_${Date.now()}">${title}</div>` : ''}
          ${message ? `<div class="mk-dialog-message" id="mkDialogMsg">${message}</div>` : ''}
          ${inputHTML}
          <div class="mk-dialog-actions">${buttonsHTML}</div>
        </div>
      `;
      
      // 🎯 احفظ العنصر الذي كان مفتوحًا (لإعادة التركيز إليه)
      const previousActive = document.activeElement;
      
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      
      // 🎯 Focus Trap — يمنع Tab من الخروج من النافذة
      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const trapHandler = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = overlay.querySelectorAll(focusableSelector);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      overlay.addEventListener('keydown', trapHandler);
      
      const inputEl = overlay.querySelector('.mk-dialog-input');
      if (inputEl) {
        setTimeout(() => {
          inputEl.focus();
          if (input.select !== false) inputEl.select();
        }, 200);
      }
      
      function close(result) {
        overlay.removeEventListener('keydown', trapHandler);
        overlay.classList.remove('show');
        setTimeout(() => {
          overlay.remove();
          // 🎯 أعِد التركيز للعنصر الأصلي
          if (previousActive && typeof previousActive.focus === 'function' && document.body.contains(previousActive)) {
            previousActive.focus();
          }
        }, 250);
        resolve(result);
      }
      
      overlay.querySelectorAll('.mk-dialog-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const btnDef = buttons[idx];
          if (btnDef.value !== undefined) {
            // return value directly
            close(typeof btnDef.value === 'function' ? btnDef.value(inputEl?.value) : btnDef.value);
          } else if (inputEl) {
            close(inputEl.value);
          } else {
            close(btnDef.action || null);
          }
        };
      });
      
      // Enter → أول زر أساسي
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const primary = overlay.querySelector('.mk-dialog-btn.primary, .mk-dialog-btn.success, .mk-dialog-btn.danger');
          if (primary) primary.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const cancel = overlay.querySelector('.mk-dialog-btn.cancel');
          if (cancel) cancel.click();
          else close(null);
        }
      });
      
      overlay.onclick = (e) => {
        if (e.target === overlay) close(null);
      };
      
      // Play sound
      if (typeof playSound === 'function') {
        try { playSound(type === 'danger' ? 'error' : 'click'); } catch (err) {}
      }
    });
  }

  // ═══ الواجهات العامة ═══
  window.mkAlert = function(message, options = {}) {
    return createDialog({
      type: options.type || 'info',
      icon: options.icon,
      title: options.title || 'مِشكاة',
      message,
      buttons: [{ label: options.buttonLabel || 'حسناً', style: 'primary', value: true }]
    });
  };

  window.mkConfirm = function(message, options = {}) {
    const dangerMode = options.type === 'danger';
    return createDialog({
      type: options.type || 'question',
      icon: options.icon,
      title: options.title || (dangerMode ? 'تأكيد' : 'هل أنت متأكد؟'),
      message,
      buttons: [
        { label: options.cancelLabel || 'إلغاء', style: 'cancel', value: false },
        { label: options.confirmLabel || 'تأكيد', style: dangerMode ? 'danger' : 'primary', value: true }
      ]
    });
  };

  window.mkPrompt = function(message, defaultValue = '', options = {}) {
    return createDialog({
      type: options.type || 'question',
      icon: options.icon,
      title: options.title || 'مِشكاة',
      message,
      input: {
        type: options.inputType || 'text',
        placeholder: options.placeholder || '',
        value: defaultValue,
        maxLength: options.maxLength,
        select: options.select !== false
      },
      buttons: [
        { label: options.cancelLabel || 'إلغاء', style: 'cancel', value: null },
        { label: options.confirmLabel || 'تأكيد', style: 'primary' }
      ]
    });
  };

  console.log('💎 Custom dialogs ready');
})();