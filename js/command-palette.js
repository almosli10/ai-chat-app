// ═══════════════════════════════════════════════════════
// COMMAND PALETTE — Ctrl+K للسرعة القصوى
// ═══════════════════════════════════════════════════════
(function commandPalette() {
  'use strict';

  // ═══════ الأوامر المتاحة ═══════
  const COMMANDS = [
    // محادثة
    { id: 'new', icon: '💬', cat: 'محادثة', title: 'محادثة جديدة', hint: 'Ctrl+N',
      keywords: 'new chat محادثة جديدة إنشاء',
      run: () => typeof createNewChat === 'function' && createNewChat() },
    { id: 'search', icon: '🔍', cat: 'محادثة', title: 'بحث في المحادثات', hint: 'Ctrl+K',
      keywords: 'search بحث محادثات',
      run: () => document.getElementById('searchInput')?.focus() },
    { id: 'agent', icon: '🤖', cat: 'محادثة', title: 'تفعيل/إيقاف الوكيل', hint: 'Ctrl+B',
      keywords: 'agent وكيل بحث انترنت',
      run: () => typeof toggleAgentMode === 'function' && toggleAgentMode() },
    { id: 'focus', icon: '🎯', cat: 'محادثة', title: 'وضع التركيز (Pomodoro)',
      keywords: 'focus pomodoro تركيز بومودورو',
      run: () => window.toggleFocusMode && window.toggleFocusMode() },

    // عرض
    { id: 'themes', icon: '🎨', cat: 'عرض', title: 'فتح الثيمات والألوان',
      keywords: 'theme ثيم لون لون مظهر',
      run: () => typeof openThemes === 'function' && openThemes() },
    { id: 'personas-lib', icon: '🎭', cat: 'عرض', title: 'مكتبة الشخصيات (25)',
      keywords: 'personas library شخصيات مكتبة',
      run: () => window.openPersonasLibrary && window.openPersonasLibrary() },
    { id: 'personas', icon: '👤', cat: 'عرض', title: 'تخصيص شخصية المساعد',
      keywords: 'persona شخصية مساعد تخصيص',
      run: () => typeof openPersonas === 'function' && openPersonas() },
    { id: 'mood', icon: '😊', cat: 'عرض', title: 'تبديل مزاج مِشكاة',
      keywords: 'mood مزاج مزاجي شخصية',
      run: () => document.getElementById('mood-indicator')?.click() },

    // معلومات
    { id: 'stats', icon: '📊', cat: 'معلومات', title: 'عرض الإحصائيات',
      keywords: 'stats إحصائيات تقارير',
      run: () => typeof openStats === 'function' && openStats() },
    { id: 'memory', icon: '🧠', cat: 'معلومات', title: 'ذاكرة المساعد',
      keywords: 'memory ذاكرة معلومات مساعد',
      run: () => typeof openMemory === 'function' && openMemory() },
    { id: 'evolution', icon: '🏆', cat: 'معلومات', title: 'إنجازات ومستويات مِشكاة',
      keywords: 'evolution إنجازات مستويات تطور رحلة',
      run: () => window.mishkatEvo?.openPanel() },
    { id: 'tests', icon: '🧪', cat: 'معلومات', title: 'تشغيل اختبارات التطبيق',
      keywords: 'tests اختبارات فحص',
      run: () => window.showTestsUI && window.showTestsUI() },

    // إعدادات
    { id: 'settings', icon: '⚙️', cat: 'إعدادات', title: 'إعدادات الذكاء الاصطناعي',
      keywords: 'settings إعدادات نظام prompt',
      run: () => typeof openSettings === 'function' && openSettings() },
    { id: 'sounds', icon: '🔊', cat: 'إعدادات', title: 'إعدادات الأصوات',
      keywords: 'sounds أصوات صوت',
      run: () => typeof openSounds === 'function' && openSounds() },
    { id: 'notifications', icon: '🔔', cat: 'إعدادات', title: 'إعدادات الإشعارات',
      keywords: 'notifications إشعارات تنبيهات',
      run: () => typeof openNotifications === 'function' && openNotifications() },
    { id: 'encryption', icon: '🔐', cat: 'إعدادات', title: 'التشفير من طرف لطرف',
      keywords: 'encryption تشفير أمان خصوصية',
      run: () => typeof openEncryption === 'function' && openEncryption() },
    { id: 'shortcuts', icon: '⌨️', cat: 'إعدادات', title: 'عرض الاختصارات',
      keywords: 'shortcuts اختصارات كيبورد',
      run: () => typeof openShortcuts === 'function' && openShortcuts() },
    { id: 'quick-settings', icon: '📋', cat: 'إعدادات', title: 'الإعدادات والقائمة',
      keywords: 'quick settings قائمة إعدادات سريعة',
      run: () => window.openQuickSettings && window.openQuickSettings() },

    // بيانات
    { id: 'share', icon: '🔗', cat: 'بيانات', title: 'مشاركة المحادثة الحالية',
      keywords: 'share مشاركة رابط',
      run: () => typeof shareCurrentChat === 'function' && shareCurrentChat() },
    { id: 'export-chat', icon: '📄', cat: 'بيانات', title: 'تصدير المحادثة (Markdown)',
      keywords: 'export تصدير markdown md',
      run: () => typeof exportCurrentChat === 'function' && exportCurrentChat() },
    { id: 'export-all', icon: '📤', cat: 'بيانات', title: 'تصدير كل البيانات',
      keywords: 'export backup تصدير نسخ احتياطي',
      run: () => typeof exportAllData === 'function' && exportAllData() },
    { id: 'import', icon: '📥', cat: 'بيانات', title: 'استيراد بيانات',
      keywords: 'import استيراد استعادة',
      run: () => document.getElementById('importInput')?.click() },
    { id: 'sync', icon: '☁️', cat: 'بيانات', title: 'مزامنة مع السحابة',
      keywords: 'sync مزامنة سحابة cloud',
      run: () => typeof syncWithCloud === 'function' && syncWithCloud() },
  ];

  // ═══════ State ═══════
  let overlay = null;
  let input = null;
  let listEl = null;
  let filtered = [];
  let selectedIdx = 0;

  // ═══════ Build UI ═══════
  function build() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'cmd-palette-overlay';
    overlay.className = 'cmd-palette-overlay';
    overlay.innerHTML = `
      <div class="cmd-palette" role="dialog" aria-label="لوحة الأوامر">
        <div class="cmd-palette-search">
          <span class="cmd-palette-icon">🔍</span>
          <input type="text" class="cmd-palette-input" placeholder="اكتب أمراً..." autocomplete="off" />
          <kbd class="cmd-palette-esc">Esc</kbd>
        </div>
        <div class="cmd-palette-list" role="listbox"></div>
        <div class="cmd-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span>
          <span><kbd>↵</kbd> تنفيذ</span>
          <span><kbd>Esc</kbd> إغلاق</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    input = overlay.querySelector('.cmd-palette-input');
    listEl = overlay.querySelector('.cmd-palette-list');

    input.addEventListener('input', () => filter(input.value));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  // ═══════ Normalize Arabic ═══════
  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '') // tashkeel
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  }

  // ═══════ Filter ═══════
  function filter(query) {
    const q = normalize(query.trim());
    const all = COMMANDS.slice();
    if (!q) {
      filtered = all;
    } else {
      const words = q.split(/\s+/).filter(Boolean);
      filtered = all.filter(cmd => {
        const haystack = normalize(`${cmd.title} ${cmd.cat} ${cmd.keywords || ''}`);
        return words.every(w => haystack.includes(w));
      });
    }
    selectedIdx = 0;
    render();
  }

  // ═══════ Render ═══════
  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="cmd-palette-empty">لا نتائج</div>';
      return;
    }
    let lastCat = '';
    filtered.forEach((cmd, i) => {
      if (cmd.cat !== lastCat) {
        const sep = document.createElement('div');
        sep.className = 'cmd-palette-cat';
        sep.textContent = cmd.cat;
        listEl.appendChild(sep);
        lastCat = cmd.cat;
      }
      const item = document.createElement('div');
      item.className = 'cmd-palette-item' + (i === selectedIdx ? ' selected' : '');
      item.dataset.idx = i;
      item.innerHTML = `
        <span class="cmd-palette-item-icon">${cmd.icon}</span>
        <span class="cmd-palette-item-title">${cmd.title}</span>
        ${cmd.hint ? `<kbd class="cmd-palette-item-hint">${cmd.hint}</kbd>` : ''}
      `;
      item.onclick = () => execute(i);
      item.onmouseenter = () => { selectedIdx = i; updateSelection(); };
      listEl.appendChild(item);
    });
    scrollIntoView();
  }

  function updateSelection() {
    listEl.querySelectorAll('.cmd-palette-item').forEach((el) => {
      const i = parseInt(el.dataset.idx, 10);
      el.classList.toggle('selected', i === selectedIdx);
    });
    scrollIntoView();
  }

  function scrollIntoView() {
    const sel = listEl.querySelector('.cmd-palette-item.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ═══════ Execute ═══════
  function execute(i) {
    const cmd = filtered[i];
    if (!cmd) return;
    close();
    // تأخير بسيط ليكون الإغلاق سلِس
    setTimeout(() => {
      try { cmd.run(); } catch (e) { console.warn('Command failed:', e); }
      if (typeof playSound === 'function') playSound('click');
    }, 50);
  }

  // ═══════ Open / Close ═══════
  function open() {
    build();
    filter('');
    overlay.classList.add('show');
    setTimeout(() => input.focus(), 60);
    if (typeof playSound === 'function') playSound('click');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('show');
  }

  function isOpen() {
    return overlay && overlay.classList.contains('show');
  }

  // ═══════ Keyboard ═══════
  document.addEventListener('keydown', (e) => {
    // Ctrl+K أو Cmd+K
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      // تعطيل سلوك Ctrl+K الافتراضي (البحث)
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close();
      else open();
      return;
    }
    if (!isOpen()) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
      updateSelection();
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      updateSelection();
    }
    else if (e.key === 'Enter') {
      e.preventDefault();
      execute(selectedIdx);
    }
    else if (e.key === 'Home') {
      e.preventDefault();
      selectedIdx = 0;
      updateSelection();
    }
    else if (e.key === 'End') {
      e.preventDefault();
      selectedIdx = filtered.length - 1;
      updateSelection();
    }
  }, true);

  // Public API
  window.openCommandPalette = open;
  window.closeCommandPalette = close;

  console.log('⌨️ Command Palette ready — اضغط Ctrl+K');
})();