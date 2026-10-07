// ═══════════════════════════════════════════════════════
// MISHKAT EVOLUTION — مستويات + إنجازات + تطوّر بصري
// ═══════════════════════════════════════════════════════
(function mishkatEvolution() {
  'use strict';

  // ───── مستويات مِشكاة ─────
  const LEVELS = [
    { n: 1, name: 'بذرة النور', icon: '🌱', xp: 0 },
    { n: 2, name: 'شرارة', icon: '✨', xp: 100 },
    { n: 3, name: 'لهب', icon: '🔥', xp: 300 },
    { n: 4, name: 'مصباح', icon: '💡', xp: 600 },
    { n: 5, name: 'مشعل', icon: '🏮', xp: 1000 },
    { n: 6, name: 'نجم', icon: '⭐', xp: 1500 },
    { n: 7, name: 'قمر', icon: '🌙', xp: 2200 },
    { n: 8, name: 'شمس صغيرة', icon: '☀️', xp: 3000 },
    { n: 9, name: 'فجر', icon: '🌅', xp: 4000 },
    { n: 10, name: 'نور', icon: '🌟', xp: 5500 },
  ];

  // ───── الإنجازات ─────
  const ACHIEVEMENTS = [
    { id: 'first_chat', icon: '🌱', name: 'البداية', desc: 'أول محادثة' },
    { id: 'msgs_10', icon: '💬', name: 'متحدّث', desc: '10 رسائل' },
    { id: 'msgs_50', icon: '🗣️', name: 'ثَرثار', desc: '50 رسالة' },
    { id: 'msgs_100', icon: '📢', name: 'خطيب', desc: '100 رسالة' },
    { id: 'msgs_500', icon: '🎙️', name: 'إذاعي', desc: '500 رسالة' },
    { id: 'chats_5', icon: '📚', name: 'منظّم', desc: '5 محادثات' },
    { id: 'chats_20', icon: '📖', name: 'أمين مكتبة', desc: '20 محادثة' },
    { id: 'streak_3', icon: '🔥', name: 'مواظب', desc: '3 أيام متتالية' },
    { id: 'streak_7', icon: '💪', name: 'ملتزم', desc: '7 أيام متتالية' },
    { id: 'streak_30', icon: '🏆', name: 'أسطورة', desc: '30 يومًا متتاليًا' },
    { id: 'agent_10', icon: '🤖', name: 'وكيل', desc: '10 استخدامات للوكيل' },
    { id: 'agent_50', icon: '🕵️', name: 'محقّق', desc: '50 استخدام للوكيل' },
    { id: 'files_10', icon: '📎', name: 'مرفق', desc: '10 ملفات مرفقة' },
    { id: 'memory_5', icon: '🧠', name: 'ذاكرة', desc: '5 حقائق محفوظة' },
    { id: 'memory_20', icon: '🎓', name: 'عارف', desc: '20 حقيقة' },
    { id: 'upvotes_20', icon: '❤️', name: 'محبوب', desc: '20 إعجاب' },
    { id: 'encryption', icon: '🔐', name: 'آمن', desc: 'تفعيل التشفير E2E' },
    { id: 'night_owl', icon: '🦉', name: 'بومة الليل', desc: 'استخدام بين 2-5 صباحًا' },
    { id: 'theme_master', icon: '🎨', name: 'فنّان', desc: 'تجربة 5 ثيمات' },
    { id: 'level_5', icon: '🏮', name: 'مشعل', desc: 'الوصول للمستوى 5' },
    { id: 'level_10', icon: '🌟', name: 'النور الكامل', desc: 'الوصول للمستوى 10' },
  ];

  // ───── الحالة ─────
  const STORAGE_KEY = 'mishkat_evolution_v1';
  let state = loadState();

  function defaultState() {
    return {
      xp: 0,
      level: 1,
      achievements: [],
      stats: {
        messages: 0,
        chats: 0,
        agentUses: 0,
        files: 0,
        memoryCount: 0,
        upvotes: 0,
        themesUsed: [],
        lastDay: null,
        streak: 0,
      },
      firstSeen: Date.now(),
      lastXpGain: 0,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return { ...defaultState(), ...s, stats: { ...defaultState().stats, ...(s.stats || {}) } };
    } catch { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ───── XP ─────
  const XP_REWARDS = {
    message: 5,
    reply: 3,
    agent_use: 8,
    file: 5,
    upvote: 2,
    new_chat: 2,
    daily_streak: 20,
  };

  function addXP(amount, reason = '') {
    if (amount <= 0) return;
    // حد أقصى للـ XP اليومي لتجنب السبام (5000/يوم)
    const today = new Date().toDateString();
    if (state.lastDay !== today) {
      state.lastDay = today;
      state.xpToday = 0;
    }
    state.xpToday = (state.xpToday || 0);
    if (state.xpToday >= 5000) return;
    state.xpToday += amount;

    state.xp += amount;
    const newLevel = computeLevel(state.xp);
    if (newLevel > state.level) {
      state.level = newLevel;
      saveState();
      updateVisual();
      setTimeout(() => onLevelUp(newLevel), 400);
    } else {
      saveState();
      updateBadge();
    }
    updateProgressBar();
  }

  function computeLevel(xp) {
    let lv = 1;
    for (const l of LEVELS) if (xp >= l.xp) lv = l.n;
    return lv;
  }

  function levelInfo(n = state.level) {
    return LEVELS.find(l => l.n === n) || LEVELS[0];
  }
  function nextLevelInfo() {
    return LEVELS.find(l => l.n === state.level + 1) || null;
  }

  // ───── الإنجازات ─────
  function unlockAchievement(id) {
    if (!id || state.achievements.includes(id)) return;
    state.achievements.push(id);
    saveState();
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) showAchievementToast(ach);
    // +50 XP مكافأة
    state.xp += 50;
    const newLevel = computeLevel(state.xp);
    if (newLevel > state.level) {
      state.level = newLevel;
      saveState();
      updateVisual();
      setTimeout(() => onLevelUp(newLevel), 800);
    }
  }

  function checkAchievements() {
    const s = state.stats;
    if (s.messages >= 1) unlockAchievement('first_chat');
    if (s.messages >= 10) unlockAchievement('msgs_10');
    if (s.messages >= 50) unlockAchievement('msgs_50');
    if (s.messages >= 100) unlockAchievement('msgs_100');
    if (s.messages >= 500) unlockAchievement('msgs_500');
    if (s.chats >= 5) unlockAchievement('chats_5');
    if (s.chats >= 20) unlockAchievement('chats_20');
    if (s.streak >= 3) unlockAchievement('streak_3');
    if (s.streak >= 7) unlockAchievement('streak_7');
    if (s.streak >= 30) unlockAchievement('streak_30');
    if (s.agentUses >= 10) unlockAchievement('agent_10');
    if (s.agentUses >= 50) unlockAchievement('agent_50');
    if (s.files >= 10) unlockAchievement('files_10');
    if (s.memoryCount >= 5) unlockAchievement('memory_5');
    if (s.memoryCount >= 20) unlockAchievement('memory_20');
    if (s.upvotes >= 20) unlockAchievement('upvotes_20');
    if (s.themesUsed && s.themesUsed.length >= 5) unlockAchievement('theme_master');
    if (state.level >= 5) unlockAchievement('level_5');
    if (state.level >= 10) unlockAchievement('level_10');
  }

  // ───── Streak يومي ─────
  function updateDailyStreak() {
    const today = new Date().toDateString();
    if (state.stats.lastDay === today) return;
    if (state.stats.lastDay) {
      const prev = new Date(state.stats.lastDay);
      const now = new Date(today);
      const diff = Math.floor((now - prev) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        state.stats.streak = (state.stats.streak || 0) + 1;
        addXP(XP_REWARDS.daily_streak, 'streak');
      } else if (diff > 1) {
        state.stats.streak = 1;
      }
    } else {
      state.stats.streak = 1;
    }
    state.stats.lastDay = today;
    saveState();
    checkAchievements();
  }

  // ───── التطوّر البصري ─────
  function updateVisual() {
    const mk = document.getElementById('mishkat');
    if (!mk) return;
    mk.setAttribute('data-level', state.level);
    updateBadge();
    updateProgressBar();
  }

  function updateBadge() {
    let badge = document.getElementById('mk-level-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'mk-level-badge';
      badge.className = 'mk-level-badge';
      badge.title = 'مستوى مِشكاة — انقر للتفاصيل';
      badge.onclick = (e) => { e.stopPropagation(); openEvolutionPanel(); };
      const mk = document.getElementById('mishkat');
      if (mk) mk.appendChild(badge);
    }
    const info = levelInfo();
    badge.innerHTML = `<span class="mk-lv-num">${state.level}</span><span class="mk-lv-icon">${info.icon}</span>`;
  }

  function updateProgressBar() {
    const bar = document.getElementById('mk-xp-bar');
    if (!bar) return;
    const cur = levelInfo().xp;
    const nxt = nextLevelInfo();
    if (!nxt) {
      bar.querySelector('.mk-xp-fill').style.width = '100%';
      bar.querySelector('.mk-xp-text').textContent = 'النور الكامل ✨';
      return;
    }
    const range = nxt.xp - cur;
    const gained = state.xp - cur;
    const pct = Math.min(100, (gained / range) * 100);
    bar.querySelector('.mk-xp-fill').style.width = pct + '%';
    bar.querySelector('.mk-xp-text').textContent = `${state.xp} / ${nxt.xp} XP`;
  }

  // ───── Level Up Modal ─────
  function onLevelUp(newLevel) {
    const info = levelInfo(newLevel);
    // أصوات + شرارات
    if (typeof playSound === 'function') {
      playSound('receive');
      setTimeout(() => playSound('notif'), 300);
    }
    if (typeof fireConfetti === 'function') fireConfetti(80);

    // فقاعة
    const bubble = document.querySelector('.mk-bubble-text');
    if (bubble) {
      bubble.textContent = `🎉 وصلت للمستوى ${newLevel} — ${info.name}!`;
    }

    // نافذة
    setTimeout(() => showLevelModal(newLevel), 600);
  }

  function showLevelModal(level) {
    const info = levelInfo(level);
    const modal = document.createElement('div');
    modal.className = 'mk-level-modal-overlay show';
    modal.innerHTML = `
      <div class="mk-level-modal">
        <div class="mk-level-halo"></div>
        <div class="mk-level-icon">${info.icon}</div>
        <div class="mk-level-tag">مستوى جديد</div>
        <h2 class="mk-level-title">${info.name}</h2>
        <p class="mk-level-sub">المستوى ${level} من 10</p>
        <div class="mk-level-progress">
          <div class="mk-level-progress-fill" style="width: ${(level / 10) * 100}%"></div>
        </div>
        <div class="mk-level-buttons">
          <button class="mk-level-continue">متابعة الرحلة ✨</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.mk-level-continue').onclick = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 400);
    };
    setTimeout(() => {
      if (modal.parentNode) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 400);
      }
    }, 6500);
  }

  // ───── Achievement Toast ─────
  function showAchievementToast(ach) {
    const toast = document.createElement('div');
    toast.className = 'mk-ach-toast';
    toast.innerHTML = `
      <div class="mk-ach-icon">${ach.icon}</div>
      <div class="mk-ach-body">
        <div class="mk-ach-tag">🏆 إنجاز جديد</div>
        <div class="mk-ach-name">${ach.name}</div>
        <div class="mk-ach-desc">${ach.desc}</div>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    if (typeof playSound === 'function') playSound('notif');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    }, 4500);
  }

  // ───── Evolution Panel ─────
  function openEvolutionPanel() {
    let panel = document.getElementById('mk-evolution-panel');
    if (panel) { panel.remove(); return; }

    panel = document.createElement('div');
    panel.id = 'mk-evolution-panel';
    panel.className = 'mk-evo-overlay show';

    const info = levelInfo();
    const nxt = nextLevelInfo();
    const curXP = info.xp;
    const gained = state.xp - curXP;
    const range = nxt ? nxt.xp - curXP : 1;
    const pct = nxt ? Math.min(100, (gained / range) * 100) : 100;

    const levelsHTML = LEVELS.map(l => {
      const done = state.level >= l.n;
      const cur = state.level === l.n;
      return `
        <div class="mk-evo-level ${done ? 'done' : ''} ${cur ? 'current' : ''}">
          <div class="mk-evo-level-icon">${l.icon}</div>
          <div class="mk-evo-level-num">مستوى ${l.n}</div>
          <div class="mk-evo-level-name">${l.name}</div>
          <div class="mk-evo-level-xp">${l.xp} XP</div>
        </div>
      `;
    }).join('');

    const achsHTML = ACHIEVEMENTS.map(a => {
      const unlocked = state.achievements.includes(a.id);
      return `
        <div class="mk-evo-ach ${unlocked ? 'unlocked' : 'locked'}">
          <div class="mk-evo-ach-icon">${unlocked ? a.icon : '🔒'}</div>
          <div class="mk-evo-ach-name">${a.name}</div>
          <div class="mk-evo-ach-desc">${a.desc}</div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="mk-evo-modal">
        <button class="mk-evo-close">✕</button>
        <div class="mk-evo-header">
          <div class="mk-evo-current-icon">${info.icon}</div>
          <h2>${info.name}</h2>
          <p>المستوى ${state.level} · ${state.xp} XP</p>
        </div>
        <div class="mk-evo-progress">
          <div class="mk-evo-progress-fill" style="width: ${pct}%"></div>
          <div class="mk-evo-progress-text">
            ${nxt ? `${state.xp} / ${nxt.xp} XP — التالي: ${nxt.icon} ${nxt.name}` : 'وصلت للنور الكامل ✨'}
          </div>
        </div>
        <div class="mk-evo-stats">
          <div class="mk-evo-stat"><span>${state.stats.messages}</span><label>رسالة</label></div>
          <div class="mk-evo-stat"><span>${state.stats.chats}</span><label>محادثة</label></div>
          <div class="mk-evo-stat"><span>${state.stats.streak || 0}</span><label>يوم متتالي</label></div>
          <div class="mk-evo-stat"><span>${state.achievements.length}/${ACHIEVEMENTS.length}</span><label>إنجاز</label></div>
        </div>
        <div class="mk-evo-section">
          <h3>🏮 رحلة النور</h3>
          <div class="mk-evo-levels">${levelsHTML}</div>
        </div>
        <div class="mk-evo-section">
          <h3>🏆 الإنجازات</h3>
          <div class="mk-evo-achs">${achsHTML}</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.mk-evo-close').onclick = () => {
      panel.classList.remove('show');
      setTimeout(() => panel.remove(), 300);
    };
    panel.onclick = (e) => {
      if (e.target === panel) {
        panel.classList.remove('show');
        setTimeout(() => panel.remove(), 300);
      }
    };
  }

  // ═══════════════════════════════════════════════════════
  // HOOKS — ربط الأحداث بالـ XP
  // ═══════════════════════════════════════════════════════

  // 1) إرسال رسالة
  function hookSend(retries = 30) {
    if (typeof window.send !== 'function') {
      if (retries > 0) return setTimeout(() => hookSend(retries - 1), 250);
      return;
    }
    if (window.send.__evoWrapped) return;
    const orig = window.send;
    window.send = function (...args) {
      try {
        const input = document.getElementById('msg');
        const text = (input?.value || '').trim();
        if (text) {
          state.stats.messages++;
          addXP(XP_REWARDS.message, 'message');
          checkAchievements();
        }
      } catch (e) {}
      return orig.apply(this, args);
    };
    window.send.__evoWrapped = true;
  }
  hookSend();

  // 2) عند إرفاق ملفات
  function hookFiles(retries = 30) {
    if (typeof window.handleFiles !== 'function') {
      if (retries > 0) return setTimeout(() => hookFiles(retries - 1), 250);
      return;
    }
    if (window.handleFiles.__evoWrapped) return;
    const orig = window.handleFiles;
    window.handleFiles = function (files) {
      try {
        const n = files?.length || 0;
        if (n > 0) {
          state.stats.files += n;
          addXP(XP_REWARDS.file * n, 'file');
          checkAchievements();
        }
      } catch (e) {}
      return orig.apply(this, args);
    };
    window.handleFiles.__evoWrapped = true;
  }
  hookFiles();

  // 3) عند إنشاء محادثة جديدة
  function hookCreateNewChat(retries = 30) {
    if (typeof window.createNewChat !== 'function') {
      if (retries > 0) return setTimeout(() => hookCreateNewChat(retries - 1), 250);
      return;
    }
    if (window.createNewChat.__evoWrapped) return;
    const orig = window.createNewChat;
    window.createNewChat = function (...args) {
      try {
        state.stats.chats++;
        addXP(XP_REWARDS.new_chat, 'new_chat');
        checkAchievements();
      } catch (e) {}
      return orig.apply(this, args);
    };
    window.createNewChat.__evoWrapped = true;
  }
  hookCreateNewChat();

  // 4) عند تبديل الثيمات
  function hookThemeApply(retries = 30) {
    if (typeof window.applyTheme !== 'function') {
      if (retries > 0) return setTimeout(() => hookThemeApply(retries - 1), 250);
      return;
    }
    if (window.applyTheme.__evoWrapped) return;
    const orig = window.applyTheme;
    window.applyTheme = function (name, ...rest) {
      try {
        if (name && !state.stats.themesUsed.includes(name)) {
          state.stats.themesUsed.push(name);
          checkAchievements();
        }
      } catch (e) {}
      return orig.apply(this, [name, ...rest]);
    };
    window.applyTheme.__evoWrapped = true;
  }
  hookThemeApply();

  // 5) عند تفعيل الوكيل
  function hookAgentToggle(retries = 30) {
    if (typeof window.toggleAgentMode !== 'function') {
      if (retries > 0) return setTimeout(() => hookAgentToggle(retries - 1), 250);
      return;
    }
    if (window.toggleAgentMode.__evoWrapped) return;
    const orig = window.toggleAgentMode;
    window.toggleAgentMode = function (...args) {
      try {
        if (typeof agentMode !== 'undefined' && !agentMode) {
          // يُفعّل الآن
          state.stats.agentUses++;
          addXP(XP_REWARDS.agent_use, 'agent');
          checkAchievements();
        }
      } catch (e) {}
      return orig.apply(this, args);
    };
    window.toggleAgentMode.__evoWrapped = true;
  }
  hookAgentToggle();

  // 6) عند تقييم الردود 👍
  function hookRating(retries = 30) {
    if (typeof window.setRating !== 'function') {
      if (retries > 0) return setTimeout(() => hookRating(retries - 1), 250);
      return;
    }
    if (window.setRating.__evoWrapped) return;
    const orig = window.setRating;
    window.setRating = function (mi, r, ...rest) {
      try {
        if (r === 'up') {
          state.stats.upvotes++;
          addXP(XP_REWARDS.upvote, 'upvote');
          checkAchievements();
        }
      } catch (e) {}
      return orig.apply(this, [mi, r, ...rest]);
    };
    window.setRating.__evoWrapped = true;
  }
  hookRating();

  // 7) عداد الذاكرة
  function hookMemory(retries = 30) {
    if (typeof window.extractMemoryFromChat !== 'function') {
      if (retries > 0) return setTimeout(() => hookMemory(retries - 1), 250);
      return;
    }
    if (window.extractMemoryFromChat.__evoWrapped) return;
    const orig = window.extractMemoryFromChat;
    window.extractMemoryFromChat = function (...args) {
      return orig.apply(this, args).then(() => {
        try {
          if (typeof userMemory !== 'undefined') {
            state.stats.memoryCount = userMemory.length;
            checkAchievements();
          }
        } catch (e) {}
      });
    };
    window.extractMemoryFromChat.__evoWrapped = true;
  }
  hookMemory();

  // 8) كشف الردود (reply)
  function hookReplies(retries = 30) {
    const ci = document.getElementById('chatInner');
    if (!ci) {
      if (retries > 0) return setTimeout(() => hookReplies(retries - 1), 250);
      return;
    }
    if (ci.__evoObserved) return;
    ci.__evoObserved = true;
    const obs = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList?.contains('msg') && n.classList?.contains('assistant')) {
          setTimeout(() => {
            if (n.isConnected) {
              addXP(XP_REWARDS.reply, 'reply');
            }
          }, 1200);
        }
      }));
    });
    obs.observe(ci, { childList: true });
  }
  hookReplies();

  // 9) التشفير
  function hookEncryption(retries = 30) {
    if (typeof window.enableEncryption !== 'function') {
      if (retries > 0) return setTimeout(() => hookEncryption(retries - 1), 250);
      return;
    }
    if (window.enableEncryption.__evoWrapped) return;
    const orig = window.enableEncryption;
    window.enableEncryption = function (...args) {
      return orig.apply(this, args).then(() => {
        try { unlockAchievement('encryption'); } catch (e) {}
      });
    };
    window.enableEncryption.__evoWrapped = true;
  }
  hookEncryption();

  // 10) بومة الليل
  function checkNightOwl() {
    const h = new Date().getHours();
    if (h >= 2 && h < 5) unlockAchievement('night_owl');
  }
  setInterval(checkNightOwl, 60000);
  checkNightOwl();

  // ═══════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════
  function init() {
    state.level = computeLevel(state.xp);
    saveState();
    updateVisual();
    updateDailyStreak();
    checkAchievements();

    // افتح اللوحة عند الضغط على badge (فوق mishkat)
    const mk = document.getElementById('mishkat');
    if (mk && !mk.__evoBadgeBound) {
      mk.__evoBadgeBound = true;
    }

    console.log(`🏮 Mishkat Evolution ready — Level ${state.level} (${state.xp} XP)`);
  }

  // انتظر حتى يظهر مشكاة
  function waitForMishkat(retries = 30) {
    if (!document.getElementById('mishkat')) {
      if (retries > 0) return setTimeout(() => waitForMishkat(retries - 1), 250);
    }
    init();
  }
  waitForMishkat();

  // API عام (للاختبار)
  window.mishkatEvo = {
    get state() { return state; },
    addXP,
    openPanel: openEvolutionPanel,
    unlock: unlockAchievement,
    reset: () => { state = defaultState(); saveState(); updateVisual(); },
  };
})();