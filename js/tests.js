// ═══════════════════════════════════════════════════════
// SMOKE TESTS — اختبارات سريعة للتأكد من سلامة التطبيق
// ═══════════════════════════════════════════════════════
(function smokeTests() {
  'use strict';
  const results = [];
  let passed = 0, failed = 0;

  function test(name, fn) {
    try {
      const r = fn();
      if (r === true || r === undefined) { passed++; results.push({ ok: true, name }); }
      else { failed++; results.push({ ok: false, name, err: String(r) }); }
    } catch (e) {
      failed++;
      results.push({ ok: false, name, err: e.message });
    }
  }

  function waitFor(cond, timeout = 3000) {
    return new Promise((res) => {
      const start = Date.now();
      const check = () => {
        try { if (cond()) return res(true); } catch (e) {}
        if (Date.now() - start > timeout) return res(false);
        setTimeout(check, 100);
      };
      check();
    });
  }

  async function runAll() {
    // انتظر تحميل التطبيق
    await waitFor(() => typeof window.allChats === 'object' && document.getElementById('chatInner'));

    test('الوظائف الأساسية موجودة', () => {
      const fns = ['send', 'createNewChat', 'switchChat', 'addMessage', 'renderSidebar'];
      for (const f of fns) if (typeof window[f] !== 'function') return `missing: ${f}`;
      return true;
    });

    test('HTMLElement الأساسية موجودة', () => {
      const ids = ['chat', 'chatInner', 'msg', 'sendBtn', 'sidebar', 'chatList'];
      for (const id of ids) if (!document.getElementById(id)) return `missing #${id}`;
      return true;
    });

    test('allChats كائن', () => typeof allChats === 'object' && allChats !== null);

    test('currentChatId موجود', () => !!currentChatId);

    test('مشكاة ظهرت', () => !!document.getElementById('mishkat'));

    test('SVG icons فعّالة', () => !!document.querySelector('.ui-icon-wrap svg'));

    test('localStorage يعمل', () => {
      localStorage.setItem('__test', '1');
      const v = localStorage.getItem('__test');
      localStorage.removeItem('__test');
      return v === '1';
    });

    test('API_URL محدد', () => typeof API_URL === 'string' && API_URL.startsWith('/'));

    test('THEMES يحتوي 9+', () => Object.keys(THEMES).length >= 9);

    test('مِشكاة evolution محمّل', () => !!window.mishkatEvo);

    test('Lazy loader جاهز', () => typeof window.loadScript === 'function');

    test('PWA hooks جاهزة', () => typeof window.openQuickSettings === 'function');

    // Report
    const total = passed + failed;
    const pct = Math.round((passed / total) * 100);
    const color = failed === 0 ? '#10b981' : failed < 3 ? '#f59e0b' : '#ef4444';

    console.group(`%c🧪 Tests: ${passed}/${total} passed (${pct}%)`, `color:${color};font-weight:bold;font-size:14px`);
    results.forEach(r => {
      if (r.ok) console.log(`%c✓ ${r.name}`, 'color:#10b981');
      else console.log(`%c✗ ${r.name} — ${r.err}`, 'color:#ef4444');
    });
    console.groupEnd();

    return { passed, failed, total, results };
  }

  // شغّل بعد 3 ثوان
  setTimeout(runAll, 3000);
  window.runSmokeTests = runAll;

  // UI صغير لإظهار النتائج
  window.showTestsUI = async function () {
    const r = await runAll();
    const el = document.createElement('div');
    el.className = 'modal-overlay show';
    el.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <h3>🧪 نتائج الاختبار</h3>
        <div style="font-size:36px; font-weight:800; color:${r.failed === 0 ? '#10b981' : '#f59e0b'}; text-align:center; margin:16px 0;">
          ${r.passed}/${r.total}
        </div>
        <div style="max-height:340px; overflow-y:auto; padding:8px; background:var(--bg-tertiary); border-radius:12px;">
          ${r.results.map(x => `
            <div style="padding:6px 10px; font-size:13px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border-light);">
              <span style="color:${x.ok ? '#10b981' : '#ef4444'}; font-weight:700;">${x.ok ? '✓' : '✗'}</span>
              <span>${x.name}</span>
              ${x.err ? `<span style="color:#94a3b8; font-size:11px; margin-right:auto;">${x.err}</span>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="modal-buttons">
          <button class="save" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) el.remove(); };
  };
})();