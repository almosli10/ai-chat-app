// js/usage-limits.js — نظام حدود الاستخدام والباقات
(function usageLimits() {
  'use strict';

  // ═══ إعدادات الباقات ═══
    const PLAN_LIMITS = {
    free:    { tokens: 10000,     image: 1,        voice: 0,        agent: 5,        name: 'مجاني',   icon: '🆓' },
    pro:     { tokens: 50000,     image: 5,        voice: 60,       agent: 100,      name: 'احترافي', icon: '⭐' },
    premium: { tokens: 110000,    image: 15,       voice: 300,      agent: 500,      name: 'بريميوم', icon: '💎' },
    vip:     { tokens: Infinity,  image: Infinity, voice: Infinity, agent: Infinity, name: 'خاص',     icon: '👑' }
  };

  let currentPlan = 'free';
  let usageCache = { tokens: 0, image: 0, voice: 0, agent: 0 };
  let bonusTokens = 0;       // 🎁 مكافآت اليوم (توسّع الحد)
  let cacheDate = null;
  let warned70 = false;
  let warned90 = false;

  // ═══ تحميل خطة المستخدم ═══
  async function loadPlan() {
    if (!window.sbClient || !window.currentUserId) {
      currentPlan = 'free';
      return;
    }
    try {
      const { data, error } = await window.sbClient
        .from('subscriptions')
        .select('plan, status, expires_at')
        .eq('user_id', window.currentUserId)
        .maybeSingle();
      
      if (error || !data) {
        currentPlan = 'free';
      } else if (data.status === 'active' && 
                 (!data.expires_at || new Date(data.expires_at) > new Date())) {
        currentPlan = data.plan || 'free';
      } else {
        currentPlan = 'free';
      }
      console.log('💎 Plan loaded:', currentPlan);
    } catch (e) {
      currentPlan = 'free';
    }
    updatePlanBadge();
  }

  // ═══ تحميل الاستهلاك اليومي ═══
  async function loadUsage() {
    if (!window.sbClient || !window.currentUserId) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const { data, error } = await window.sbClient
        .from('usage_logs')
        .select('type, tokens')
        .eq('user_id', window.currentUserId)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      
      usageCache = { tokens: 0, image: 0, voice: 0, agent: 0 };
      bonusTokens = 0;
      (data || []).forEach(r => {
        if (r.type === 'tokens') {
          usageCache.tokens += Number(r.tokens) || 0;
        } else if (r.type === 'bonus') {
          bonusTokens += Number(r.tokens) || 0;  // 🎁 يُضاف للحد
        } else if (usageCache[r.type] !== undefined) {
          usageCache[r.type]++;
        }
      });
      
      // 🔄 إذا تغير اليوم، أعد تعيين الإشعارات
      const todayStr = new Date().toDateString();
      if (cacheDate && cacheDate !== todayStr) {
        resetWarnings();
      }
      cacheDate = todayStr;
      console.log('📊 Usage loaded:', usageCache);
    } catch (e) {
      console.warn('Usage load failed:', e);
    }
    updateUsageBadge();
    checkUsageWarnings();
  }

  // ═══ فحص الحد — سريع (بدون انتظار) ═══
  function checkLimit(type) {
    if (currentPlan === 'vip') return { allowed: true, remaining: Infinity };
    
    const baseLimit = PLAN_LIMITS[currentPlan]?.[type] || PLAN_LIMITS.free[type];
    // 🎁 للتوكنات فقط: أضف المكافأة للحد
    const limit = (type === 'tokens' && baseLimit !== Infinity) 
      ? baseLimit + bonusTokens 
      : baseLimit;
    const used = usageCache[type] || 0;
    const remaining = Math.max(0, limit - used);
    
    return {
      allowed: remaining > 0,
      remaining,
      used,
      limit,
      plan: currentPlan
    };
  }

    // ═══ اقتراح الترقية الذكي ═══
  const SUGGESTIONS_KEY = 'mishkat_upgrade_suggestions';
  const LOCKED_USES_KEY = 'mishkat_locked_feature_uses';
  const SUGGESTION_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 أيام
  
  function getSuggestionState() {
    try {
      return JSON.parse(localStorage.getItem(SUGGESTIONS_KEY) || '{}');
    } catch (e) { return {}; }
  }
  
  function saveSuggestionState(state) {
    try { localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  
  // تسجيل محاولة استخدام ميزة مقفلة
  window.usageLimits_recordLockedUse = function(featureName) {
    if (currentPlan !== 'free') return; // المدفوعون لا يحتاجون اقتراحات
    try {
      const data = JSON.parse(localStorage.getItem(LOCKED_USES_KEY) || '{}');
      data[featureName] = (data[featureName] || 0) + 1;
      data._lastUpdate = Date.now();
      localStorage.setItem(LOCKED_USES_KEY, JSON.stringify(data));
    } catch (e) {}
  };
  
  // فحص إذا كان يجب عرض اقتراح
  function shouldShowSuggestion() {
    if (currentPlan !== 'free') return null; // فقط للمجاني
    if (typeof toast !== 'function') return null;
    
    const state = getSuggestionState();
    const now = Date.now();
    
    // 1) تحقق من Cooldown (7 أيام)
    if (state.lastShown && (now - state.lastShown) < SUGGESTION_COOLDOWN) {
      return null;
    }
    
    // 2) اقتراح "ميزة مقفلة مستخدمة 3+ مرات"
    try {
      const lockedUses = JSON.parse(localStorage.getItem(LOCKED_USES_KEY) || '{}');
      for (const [feature, count] of Object.entries(lockedUses)) {
        if (feature.startsWith('_')) continue;
        if (count >= 3 && (!state.shownFeatures || !state.shownFeatures.includes(feature))) {
          return {
            type: 'locked-feature',
            feature,
            icon: '🔓',
            title: `عجبتك "${feature}"؟`,
            body: `افتحها مع الباقة الاحترافية — $10 فقط!`,
            actionLabel: 'اشترك الآن'
          };
        }
      }
    } catch (e) {}
    
    // 3) اقتراح "مستخدم ثقيل"
    const history = state.history || [];
    const today = new Date().toDateString();
    
    if (history.length >= 2) {
      // احسب آخر 3 أيام
      const lastThree = [...history.slice(-3), { date: today, percent: (usageCache.tokens / (PLAN_LIMITS.free.tokens + bonusTokens)) * 100 }];
      const heavyDays = lastThree.filter(d => d.percent >= 70).length;
      
      if (heavyDays >= 3) {
        return {
          type: 'heavy-user',
          icon: '📈',
          title: 'لاحظنا استخدامك المكثّف!',
          body: 'آخر 3 أيام اقتربت من حدّك. جرّب الاحترافي — 5 أضعاف الرصيد بـ $10/شهر.',
          actionLabel: 'اكتشف الباقات'
        };
      }
    }
    
    // 4) اقتراح "قرب 90%"
    const currentPercent = (usageCache.tokens / (PLAN_LIMITS.free.tokens + bonusTokens)) * 100;
    if (currentPercent >= 90 && !state.shownNearLimit) {
      return {
        type: 'near-limit',
        icon: '⚡',
        title: 'اقتربت من الحد اليومي',
        body: 'ترقية للاحترافي = 5 أضعاف الرصيد!',
        actionLabel: 'اكتشف',
        markShown: 'shownNearLimit'
      };
    }
    
    return null;
  }
  
  // عرض الاقتراح
  function showUpgradeSuggestion(sug) {
    const toast = document.createElement('div');
    toast.className = 'upgrade-suggestion';
    toast.id = 'upgradeSuggestion';
    toast.innerHTML = `
      <div class="usg-icon">${sug.icon}</div>
      <div class="usg-body">
        <div class="usg-title">${sug.title}</div>
        <div class="usg-text">${sug.body}</div>
        <div class="usg-actions">
          <button class="usg-go">${sug.actionLabel}</button>
          <button class="usg-later">لاحقًا</button>
        </div>
      </div>
      <button class="usg-x" aria-label="إغلاق">✕</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // حفظ حالة العرض
    const state = getSuggestionState();
    state.lastShown = Date.now();
    state.shownFeatures = state.shownFeatures || [];
    if (sug.type === 'locked-feature' && !state.shownFeatures.includes(sug.feature)) {
      state.shownFeatures.push(sug.feature);
    }
    if (sug.markShown) state[sug.markShown] = true;
    saveSuggestionState(state);
    
    // الأحداث
    toast.querySelector('.usg-go').onclick = () => {
      dismissSuggestion(toast);
      if (sug.type === 'heavy-user') {
        // افتح لوحة الاستهلاك مباشرة
        setTimeout(() => openUsagePanel(), 300);
      } else {
        // اذهب لصفحة الترقية مباشرة
        setTimeout(() => openUsagePanel(), 300);
      }
    };
    toast.querySelector('.usg-later').onclick = () => dismissSuggestion(toast);
    toast.querySelector('.usg-x').onclick = () => dismissSuggestion(toast);
  }
  
  function dismissSuggestion(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }
  
  // تحديث سجل الأيام (يُستدعى في init)
  function updateHistory() {
    const state = getSuggestionState();
    state.history = state.history || [];
    
    const today = new Date().toDateString();
    const limit = PLAN_LIMITS.free.tokens + bonusTokens;
    const percent = (usageCache.tokens / limit) * 100;
    
    // احذف سجلات اليوم السابق
    state.history = state.history.filter(h => h.date !== today);
    
    // أضف سجل اليوم
    state.history.push({ date: today, percent });
    
    // احتفظ بآخر 7 أيام فقط
    if (state.history.length > 7) state.history = state.history.slice(-7);
    
    saveSuggestionState(state);
  }

  // ═══ مكافأة الدخول اليومي (+500 توكن) ═══
  async function checkDailyReward() {
    if (!window.sbClient || !window.currentUserId) return;
    
    const today = new Date().toDateString();
    const lastReward = localStorage.getItem('lastDailyReward');
    
    if (lastReward === today) return; // حصل عليها اليوم بالفعل
    
    try {
      // 🔍 تحقق من Supabase: هل يوجد bonus اليوم؟
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: existing, error: checkErr } = await window.sbClient
        .from('usage_logs')
        .select('id')
        .eq('user_id', window.currentUserId)
        .eq('type', 'bonus')
        .gte('created_at', todayStart.toISOString())
        .limit(1);
      
      if (checkErr) throw checkErr;
      
      if (existing && existing.length > 0) {
        // ✅ موجود في السيرفر → احفظ في localStorage ولا تمنح مرة أخرى
        localStorage.setItem('lastDailyReward', today);
        console.log('🎁 Daily reward already granted today (from server)');
        return;
      }
      
      // 🎁 امنح المكافأة
      const BONUS = 500;
      await window.sbClient.from('usage_logs').insert({
        user_id: window.currentUserId,
        type: 'bonus',
        tokens: BONUS
      });
      
      // ✅ احفظ في localStorage فورًا (لمنع تكرار من نفس التبويب)
      localStorage.setItem('lastDailyReward', today);
      
      // 🎁 أضف المكافأة للحد (وليس خصم من الاستهلاك)
      bonusTokens = (bonusTokens || 0) + BONUS;
      updateUsageBadge();
      
      // إشعارات
      setTimeout(() => {
        if (typeof toast === 'function') {
          toast('🎁 مكافأة دخول يومي: +500 توكن!', 4000);
        }
        if (typeof playSound === 'function') playSound('notif');
        if (typeof fireConfetti === 'function') fireConfetti(30);
      }, 1500);
      
      console.log('🎁 Daily reward granted: +' + BONUS);
    } catch (e) {
      console.warn('Daily reward failed:', e);
    }
  }

    // ═══ فحص وإظهار إشعارات اقتراب النفاد ═══
  function checkUsageWarnings() {
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    if (plan.tokens === Infinity) return; // VIP — لا إشعارات
    
    const used = usageCache.tokens || 0;
    const limit = plan.tokens + bonusTokens;  // 🎁 الحد الموسّع
    const percent = (used / limit) * 100;
    
    // 70% — تحذير أول
    if (percent >= 70 && percent < 90 && !warned70) {
      warned70 = true;
      if (typeof toast === 'function') {
        toast('⚠️ استهلكت 70% من رصيدك اليومي', 4000);
      }
      const badge = document.getElementById('usageBadge');
      if (badge) {
        badge.style.animation = 'pulse 1.5s ease-in-out 3';
        setTimeout(() => badge.style.animation = '', 4500);
      }
    }
    
    // 90% — تحذير حاد
    if (percent >= 90 && percent < 100 && !warned90) {
      warned90 = true;
      if (typeof toast === 'function') {
        toast('🚨 بقي أقل من 10% من رصيدك!', 5000);
      }
      const badge = document.getElementById('usageBadge');
      if (badge) {
        badge.style.animation = 'pulse 1s ease-in-out 6';
        setTimeout(() => badge.style.animation = '', 6000);
      }
      // اهتزاز الشارة
      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100, 50, 100]); } catch (e) {}
      }
    }
  }

  // ═══ إعادة تعيين الإشعارات (يُستدعى عند تجدد اليوم) ═══
  function resetWarnings() {
    warned70 = false;
    warned90 = false;
  }

  // ═══ تسجيل الاستخدام ═══
  async function logUsage(type, amount = 1) {
    if (!window.sbClient || !window.currentUserId) return;
    
    usageCache[type] = (usageCache[type] || 0) + amount;
    updateUsageBadge();
    checkUsageWarnings();
    
    try {
      await window.sbClient.from('usage_logs').insert({
        user_id: window.currentUserId,
        type: type,
        tokens: type === 'tokens' ? amount : 0
      });
    } catch (e) {
      console.warn('Usage log failed:', e);
    }
  }

  // ═══ عرض شارة الباقة في بطاقة المستخدم ═══
  function updatePlanBadge() {
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    
    const oldBadge = document.getElementById('planBadge');
    if (oldBadge) oldBadge.remove();
    
    const userCard = document.getElementById('userCard');
    if (!userCard) return;
    
    const badge = document.createElement('div');
    badge.id = 'planBadge';
    badge.className = 'plan-badge';
    badge.innerHTML = `${plan.icon} <span>${plan.name}</span>`;
    badge.onclick = openUsagePanel;
    userCard.appendChild(badge);
  }

  // ═══ وضع البث: الشارة تنبض أثناء الرد ═══
  let isStreaming = false;
  
  function startStreamingBadge() {
    if (isStreaming) return;
    isStreaming = true;
    const badge = document.getElementById('usageBadge');
    if (badge) {
      badge.classList.add('streaming');
    }
  }
  
  function stopStreamingBadge() {
    isStreaming = false;
    const badge = document.getElementById('usageBadge');
    if (badge) {
      badge.classList.remove('streaming');
    }
  }

  // ═══ تحديث مباشر أثناء البث (يُستدعى من app.js) ═══
  window.usageLimits_updateStreaming = function(chars) {
    if (!chars || chars <= 0) return;
    const estimatedTokens = Math.ceil(chars / 3);
    const badge = document.getElementById('usageBadge');
    if (!badge) return;
    
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    if (plan.tokens === Infinity) return;
    
    const currentUsed = usageCache.tokens || 0;
    const projectedUsed = currentUsed + estimatedTokens;
    
    // تنسيق مختصر
    const fmt = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    
    // اعرض الرقم المُتوقَّع مؤقتًا (بشفافية)
    badge.innerHTML = `<span style="font-size:14px;">⚡</span><span style="opacity:0.7;">${fmt(projectedUsed)}/${fmt(plan.tokens)}</span>`;
  };

  // ═══ عرض شارة الاستهلاك — عائمة ثابتة ═══
  function updateUsageBadge() {
    let badge = document.getElementById('usageBadge');
    
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'usageBadge';
      badge.className = 'usage-float-badge';
      badge.title = 'الاستهلاك اليومي';
      badge.onclick = openUsagePanel;
      badge.style.cssText = [
        'position: fixed',
        'top: 80px',
        'right: 16px',
        'z-index: 900',
        'display: flex',
        'align-items: center',
        'gap: 6px',
        'padding: 7px 12px',
        'border-radius: 999px',
        'background: rgba(15, 23, 42, 0.88)',
        'backdrop-filter: blur(14px)',
        '-webkit-backdrop-filter: blur(14px)',
        'border: 1px solid rgba(16, 185, 129, 0.6)',
        'color: #fff',
        'font-family: inherit',
        'font-size: 12px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4)',
        'font-variant-numeric: tabular-nums',
        'transition: all 0.25s'
      ].join(';');
      document.body.appendChild(badge);
      console.log('✅ Usage badge created');
    }
    
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    const used = usageCache.tokens || 0;
    const limit = (plan.tokens === Infinity) ? Infinity : plan.tokens + bonusTokens;
    
    // تنسيق مختصر: 50000 → 50K
    const fmt = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    
    if (limit === Infinity) {
      badge.innerHTML = `<span style="font-size:14px;">👑</span><span>بلا حدود</span>`;
      badge.style.borderColor = 'rgba(251, 191, 36, 0.7)';
      badge.style.color = '#fbbf24';
      badge.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(236,72,153,0.1))';
    } else {
      const percent = Math.round((used / limit) * 100);
      let borderColor = 'rgba(16, 185, 129, 0.6)';
      let textColor = '#fff';
      let bg = 'rgba(15, 23, 42, 0.88)';
      
      if (percent >= 90) {
        borderColor = 'rgba(239, 68, 68, 0.8)';
        textColor = '#fca5a5';
        bg = 'rgba(60, 15, 15, 0.88)';
      } else if (percent >= 70) {
        borderColor = 'rgba(245, 158, 11, 0.7)';
        textColor = '#fbbf24';
        bg = 'rgba(60, 45, 15, 0.88)';
      }
      
      badge.style.borderColor = borderColor;
      badge.style.color = textColor;
      badge.style.background = bg;
      badge.innerHTML = `<span style="font-size:14px;">⚡</span><span>${fmt(used)}/${fmt(limit)}</span>`;
    }
  }

  // ═══ بناء قسم الترقية (منفصل لتجنب تداخل template literals) ═══
      function buildUpgradeSection() {
    // VIP: رسالة بلا حدود
    if (currentPlan === 'vip') {
      return '<div style="text-align:center; padding:16px; font-size:12px; opacity:0.7;">👑 أنت في الباقة الخاصة — بلا حدود!</div>';
    }
    
    // Premium: أعلى باقة
    if (currentPlan === 'premium') {
      return [
        '<div style="text-align:center; padding:18px 14px; background:linear-gradient(135deg, rgba(236,72,153,0.1), rgba(168,85,247,0.08)); border:1px solid rgba(236,72,153,0.35); border-radius:16px;">',
        '  <div style="font-size:32px; margin-bottom:8px;">💎</div>',
        '  <div style="font-size:14px; font-weight:800; color:#ec4899; margin-bottom:6px;">أنت في أعلى باقة</div>',
        '  <div style="font-size:12px; opacity:0.7; line-height:1.7;">استمتع بكل الميزات والحدود الكاملة ✨</div>',
        '</div>'
      ].join('');
    }
    
    const parts = [];
    parts.push('<div class="usage-upgrade-cta">');
    parts.push('  <div style="font-size:14px; font-weight:800; margin-bottom:14px; text-align:center; color:#fbbf24;">🚀 افتح ميزات أكثر مع باقة أعلى</div>');
    
    // ===== بطاقة احترافي (تظهر فقط إذا لم يكن المستخدم احترافيًا) =====
    if (currentPlan !== 'pro') {
      parts.push('  <div class="plan-full" onclick="window.upgradeToPlan(\'pro\')">');
      parts.push('    <div class="plan-full-header">');
      parts.push('      <div class="plan-full-icon">⭐</div>');
      parts.push('      <div style="flex:1; text-align:right;">');
      parts.push('        <div class="plan-full-title">احترافي</div>');
      parts.push('        <div class="plan-full-sub">للاستخدام اليومي</div>');
      parts.push('      </div>');
      parts.push('      <div class="plan-full-price">$10<span>/شهر</span></div>');
      parts.push('    </div>');
      parts.push('    <div class="plan-full-limits">');
      parts.push('      <span>⚡ 50K توكن/يوم</span>');
      parts.push('      <span>🖼️ 5 صور/يوم</span>');
      parts.push('      <span>📞 60 دقيقة/يوم</span>');
      parts.push('    </div>');
      parts.push('    <div class="plan-full-feat-title">✨ سيفتح لك:</div>');
      parts.push('    <ul class="plan-full-features">');
      parts.push('      <li>📞 مكالمة صوتية</li>');
      parts.push('      <li>🎨 وضع الرسم</li>');
      parts.push('      <li>🖼️ الخلفية اليومية</li>');
      parts.push('      <li>🕵️ وضع التخفي</li>');
      parts.push('      <li>🎵 قراءة الردود</li>');
      parts.push('      <li>📤 تصدير ومشاركة</li>');
      parts.push('      <li>📚 15 شخصية</li>');
      parts.push('      <li>😊 8 مزاجات</li>');
      parts.push('    </ul>');
      parts.push('    <div class="plan-full-cta">اشترك الآن — $10/شهر</div>');
      parts.push('  </div>');
    }
    
    // ===== بطاقة بريميوم =====
    parts.push('  <div class="plan-full featured" onclick="window.upgradeToPlan(\'premium\')">');
    parts.push('    <div class="plan-full-badge">💎 الأفضل قيمة</div>');
    parts.push('    <div class="plan-full-header">');
    parts.push('      <div class="plan-full-icon">💎</div>');
    parts.push('      <div style="flex:1; text-align:right;">');
    parts.push('        <div class="plan-full-title">بريميوم</div>');
    parts.push('        <div class="plan-full-sub">للمستخدم المحترف</div>');
    parts.push('      </div>');
    parts.push('      <div class="plan-full-price">$18<span>/شهر</span></div>');
    parts.push('    </div>');
    parts.push('    <div class="plan-full-limits">');
    parts.push('      <span>⚡ 110K توكن/يوم</span>');
    parts.push('      <span>🖼️ 15 صورة/يوم</span>');
    parts.push('      <span>📞 300 دقيقة/يوم</span>');
    parts.push('    </div>');
    parts.push('    <div class="plan-full-feat-title">✨ كل ميزات الاحترافي وأكثر:</div>');
    parts.push('    <ul class="plan-full-features">');
    parts.push('      <li>⚡ توكنات مضاعفة</li>');
    parts.push('      <li>🖼️ صور مضاعفة</li>');
    parts.push('      <li>📞 مكالمات أطول</li>');
    parts.push('      <li>📚 25 شخصية كاملة</li>');
    parts.push('      <li>😊 13 مزاج كامل</li>');
    parts.push('      <li>🤖 وكيل مكثّف (500)</li>');
    parts.push('    </ul>');
    parts.push('    <div class="plan-full-cta">اشترك الآن — $18/شهر</div>');
    parts.push('  </div>');
    
    parts.push('  <div style="font-size:11px; opacity:0.6; margin-top:14px; text-align:center; line-height:1.7;">');
    parts.push('    💰 الدفع بـ USDT (TRC20) مباشرة<br>');
    parts.push('    📋 <strong>سيتم التحقق يدوياً خلال 24 ساعة</strong>');
    parts.push('  </div>');
    parts.push('</div>');
    
    return parts.join('\n');
  }

  // ═══ نافذة الاستهلاك والباقات ═══
  function openUsagePanel() {
    let panel = document.getElementById('usagePanel');
    if (panel) { panel.remove(); return; }
    
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    
    const stats = [
      { key: 'tokens', icon: '⚡', name: 'التوكنات' },
      { key: 'image',  icon: '🖼️', name: 'الصور' },
      { key: 'voice',  icon: '📞', name: 'المكالمات (دقيقة)' },
      { key: 'agent',  icon: '🤖', name: 'الوكيل' }
    ];
    
    const statsHtml = stats.map(s => {
      const used = usageCache[s.key] || 0;
      // 🎁 للتوكنات: أضف المكافأة للحد
      const baseLimit = plan[s.key];
      const limit = (s.key === 'tokens' && baseLimit !== Infinity) 
        ? baseLimit + bonusTokens 
        : baseLimit;
      const isUnlimited = limit === Infinity;
      const percent = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
      const color = percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#10b981';
      
      let progressHtml = '';
      if (!isUnlimited) {
        progressHtml = '<div class="usage-progress"><div class="usage-progress-fill" style="width:' + percent + '%; background:' + color + ';"></div></div>';
      }
      
      return [
        '<div class="usage-stat-row">',
        '  <div class="usage-stat-head">',
        '    <span>' + s.icon + ' ' + s.name + '</span>',
        '    <span class="usage-stat-num">' + (isUnlimited ? '∞' : (used.toLocaleString('ar-EG') + ' / ' + limit.toLocaleString('ar-EG'))) + '</span>',
        '  </div>',
        progressHtml,
        '</div>'
      ].join('');
    }).join('');
    
    const upgradeHtml = buildUpgradeSection();
    
    panel = document.createElement('div');
    panel.id = 'usagePanel';
    panel.className = 'usage-panel';
    
    const headerHtml = '<div class="usage-panel-header"><span>📊 استهلاكك اليومي</span><div style="display:flex; gap:6px; align-items:center;"><button class="usage-stats-btn" onclick="window.usageLimits.openWeeklyStats()" title="إحصائيات الأسبوع">📈</button><button class="usage-stats-btn" onclick="window.usageLimits.openUsageHistory()" title="سجل الاستخدام">📜</button><button onclick="this.closest(\'.usage-panel\').remove()">✕</button></div></div>';
    
    const planInfoHtml = [
      '<div class="usage-plan-info">',
      '  <div class="usage-plan-current">',
      '    <span style="font-size:32px;">' + plan.icon + '</span>',
      '    <div>',
      '      <div style="font-size:16px; font-weight:800; color:#fbbf24;">باقة ' + plan.name + '</div>',
      '      <div style="font-size:11px; opacity:0.65;">تتجدد الحدود كل يوم عند منتصف الليل</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    
    panel.innerHTML = headerHtml 
      + planInfoHtml 
      + '<div class="usage-stats">' + statsHtml + '</div>' 
      + upgradeHtml;
    
    document.body.appendChild(panel);
  }

  // ═══ ربط مع دوال الإرسال — بدون تأخير ═══
  function hookFunctions() {
    const tryHook = (name, type) => {
      const orig = window[name];
      if (!orig || orig.__usageHooked) return false;
      
      window[name] = function() {
        const check = checkLimit(type);
        if (!check.allowed) {
          showLimitModal(type, check);
          return;
        }
        
        // ⚡ للتوكنات: التسجيل الفعلي يصير بعد اكتمال الرد (في app.js)
        const result = orig.apply(this, arguments);
        if (type !== 'tokens') {
          setTimeout(() => logUsage(type), 50);
        }
        return result;
      };
      window[name].__usageHooked = true;
      return true;
    };
    
    const hooked = [];
    if (tryHook('send', 'tokens')) hooked.push('send');
    if (tryHook('generateImage', 'image')) hooked.push('generateImage');
    
    console.log('✅ Usage hooks:', hooked.join(', ') || 'waiting...');
  }

  // ⚡ دالة عامة لتسجيل التوكنات (تُستدعى من app.js)
  window.logTokenUsage = function(chars) {
    if (!chars || chars <= 0) return;
    const tokens = Math.max(1, Math.ceil(chars / 3));
    logUsage('tokens', tokens);
  };

    // ═══ سجل الاستخدام المفصل ═══
  async function openUsageHistory() {
    // احذف أي نسخة سابقة
    const existing = document.getElementById('usageHistoryPanel');
    if (existing) { existing.remove(); return; }
    
    if (!window.sbClient || !window.currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولاً');
      return;
    }
    
    // اعرض النافذة مع حالة تحميل
    const overlay = document.createElement('div');
    overlay.id = 'usageHistoryPanel';
    overlay.className = 'weekly-stats-overlay show';
    overlay.innerHTML = `
      <div class="weekly-stats-modal">
        <div class="weekly-stats-header">
          <h3>📜 سجل الاستخدام</h3>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="usage-stats-btn" onclick="window.usageLimits.exportUsageHistoryCSV()" title="تصدير CSV">📥</button>
            <button onclick="document.getElementById('usageHistoryPanel').remove()">✕</button>
          </div>
        </div>
        <div id="usageHistoryBody" style="text-align:center; padding:40px 20px; color:rgba(255,255,255,0.5);">
          <div style="font-size:32px; margin-bottom:12px;">⏳</div>
          <div>جاري تحميل السجل...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const { data, error } = await window.sbClient
        .from('usage_logs')
        .select('type, tokens, created_at')
        .eq('user_id', window.currentUserId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const body = document.getElementById('usageHistoryBody');
      if (!body) return;
      body.style.padding = '0';
      body.style.textAlign = 'right';
      body.style.color = '#fff';
      
      if (!data || data.length === 0) {
        body.innerHTML = `
          <div class="weekly-empty" style="padding:50px 20px;">
            <div style="font-size:48px; margin-bottom:12px; opacity:0.4;">📭</div>
            <div style="font-size:14px;">لا يوجد استخدام خلال آخر 7 أيام</div>
          </div>
        `;
        return;
      }
      
      // رتّب حسب اليوم
      const groups = {};
      data.forEach(r => {
        const d = new Date(r.created_at);
        const dayKey = d.toDateString();
        if (!groups[dayKey]) {
          groups[dayKey] = { date: d, items: [] };
        }
        groups[dayKey].items.push(r);
      });
      
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      const dayLabels = {
        [today]: '📅 اليوم',
        [yesterday]: '📅 أمس'
      };
      
      // بناء السجل
      let html = '<div class="history-list">';
      
      Object.entries(groups).forEach(([dayKey, group]) => {
        const dateLabel = dayLabels[dayKey] || '📅 ' + group.date.toLocaleDateString('ar-EG', { 
          weekday: 'long', day: 'numeric', month: 'short' 
        });
        
        const dayTotal = group.items.reduce((sum, r) => {
          if (r.type === 'tokens') return sum + (Number(r.tokens) || 0);
          if (r.type === 'bonus') return sum - (Number(r.tokens) || 0);
          return sum;
        }, 0);
        
        html += `<div class="history-day">`;
        html += `<div class="history-day-header">`;
        html += `<span>${dateLabel}</span>`;
        if (dayTotal !== 0) {
          html += `<span class="history-day-total">${dayTotal > 0 ? dayTotal : dayTotal} توكن</span>`;
        }
        html += `</div>`;
        html += `<div class="history-items">`;
        
        group.items.forEach(r => {
          const time = new Date(r.created_at).toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit' 
          });
          
          let icon = '⚡';
          let label = 'توكن';
          let value = Number(r.tokens) || 0;
          let valueClass = 'normal';
          
          if (r.type === 'image') { icon = '🖼️'; label = 'صورة'; value = 1; }
          else if (r.type === 'voice') { icon = '📞'; label = 'دقيقة مكالمة'; value = 1; }
          else if (r.type === 'agent') { icon = '🤖'; label = 'استخدام وكيل'; value = 1; }
          else if (r.type === 'bonus') { 
            icon = '🎁'; label = 'مكافأة'; 
            value = '+' + value;
            valueClass = 'bonus';
          }
          else if (r.type === 'tokens') { value = '-' + value; valueClass = 'usage'; }
          
          html += `
            <div class="history-item">
              <span class="history-icon">${icon}</span>
              <span class="history-label">${label}</span>
              <span class="history-value ${valueClass}">${value}</span>
              <span class="history-time">${time}</span>
            </div>
          `;
        });
        
        html += `</div></div>`;
      });
      
      html += '</div>';
      body.innerHTML = html;
      
    } catch (err) {
      console.error('Usage history error:', err);
      const body = document.getElementById('usageHistoryBody');
      if (body) {
        body.innerHTML = `
          <div style="padding:30px 20px; color:#f87171;">
            <div style="font-size:36px; margin-bottom:10px;">❌</div>
            <div>فشل تحميل السجل</div>
            <div style="font-size:11px; opacity:0.7; margin-top:8px;">${err.message}</div>
          </div>
        `;
      }
    }
  }

    // ═══ لوحة الإحصائيات الأسبوعية ═══
  async function openWeeklyStats() {
    // احذف أي نسخة سابقة
    const existing = document.getElementById('weeklyStatsPanel');
    if (existing) { existing.remove(); return; }
    
    if (!window.sbClient || !window.currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولاً');
      return;
    }
    
    // اعرض النافذة مع حالة تحميل
    const overlay = document.createElement('div');
    overlay.id = 'weeklyStatsPanel';
    overlay.className = 'weekly-stats-overlay show';
    overlay.innerHTML = `
      <div class="weekly-stats-modal">
        <div class="weekly-stats-header">
          <h3>📊 إحصائيات الأسبوع</h3>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="usage-stats-btn" onclick="window.usageLimits.exportWeeklyStatsCSV()" title="تصدير CSV">📥</button>
            <button onclick="document.getElementById('weeklyStatsPanel').remove()">✕</button>
          </div>
        </div>
        <div id="weeklyStatsBody" style="text-align:center; padding:40px 20px; color:rgba(255,255,255,0.5);">
          <div style="font-size:32px; margin-bottom:12px;">⏳</div>
          <div>جاري تحميل الإحصائيات...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // اجلب البيانات
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const { data, error } = await window.sbClient
        .from('usage_logs')
        .select('type, tokens, created_at')
        .eq('user_id', window.currentUserId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // نظّم البيانات حسب اليوم
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        days.push({
          date: d,
          label: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
          tokens: 0,
          images: 0,
          voice: 0,
          agent: 0
        });
      }
      
      (data || []).forEach(r => {
        const rowDate = new Date(r.created_at);
        rowDate.setHours(0, 0, 0, 0);
        const day = days.find(d => d.date.getTime() === rowDate.getTime());
        if (!day) return;
        
        if (r.type === 'tokens') day.tokens += Number(r.tokens) || 0;
        else if (r.type === 'bonus') day.tokens -= Number(r.tokens) || 0;
        else if (r.type === 'image') day.images++;
        else if (r.type === 'voice') day.voice++;
        else if (r.type === 'agent') day.agent++;
      });
      
      // احسب الإجماليات
      const totalTokens = days.reduce((s, d) => s + Math.max(0, d.tokens), 0);
      const totalImages = days.reduce((s, d) => s + d.images, 0);
      const totalVoice = days.reduce((s, d) => s + d.voice, 0);
      const totalAgent = days.reduce((s, d) => s + d.agent, 0);
      const maxDay = days.reduce((max, d) => d.tokens > max.tokens ? d : max, days[0]);
      
      // ارسم الرسم البياني (SVG)
      const chartWidth = 500;
      const chartHeight = 180;
      const maxTokens = Math.max(...days.map(d => Math.max(0, d.tokens)), 1);
      const barWidth = chartWidth / days.length;
      
      const svg = `
        <svg viewBox="0 0 ${chartWidth} ${chartHeight + 40}" class="weekly-chart">
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>
            <linearGradient id="barGradDim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(251,191,36,0.3)"/>
              <stop offset="100%" stop-color="rgba(236,72,153,0.15)"/>
            </linearGradient>
          </defs>
          ${days.map((d, i) => {
            const val = Math.max(0, d.tokens);
            const barH = (val / maxTokens) * chartHeight;
            const x = i * barWidth + barWidth * 0.2;
            const w = barWidth * 0.6;
            const y = chartHeight - barH + 20;
            const isMax = d === maxDay;
            return `
              <rect x="${x}" y="${y}" width="${w}" height="${barH}" 
                    rx="6" fill="${isMax ? 'url(#barGrad)' : 'url(#barGradDim)'}"
                    class="weekly-bar" style="animation-delay: ${i * 80}ms">
                <title>${d.label}: ${val.toLocaleString('ar-EG')} توكن</title>
              </rect>
              <text x="${x + w/2}" y="${chartHeight + 45}" text-anchor="middle" 
                    fill="rgba(255,255,255,${isMax ? '0.95' : '0.55'})" 
                    font-size="12" font-weight="${isMax ? '700' : '500'}"
                    font-family="IBM Plex Sans Arabic">
                ${d.label}
              </text>
              ${val > 0 ? `<text x="${x + w/2}" y="${y - 6}" text-anchor="middle" 
                    fill="rgba(251,191,36,${isMax ? '1' : '0.6'})" 
                    font-size="10" font-weight="600"
                    font-family="IBM Plex Sans Arabic">
                ${val >= 1000 ? (val/1000).toFixed(1) + 'K' : val}
              </text>` : ''}
            `;
          }).join('')}
        </svg>
      `;
      
      // اعرض المحتوى
      const body = document.getElementById('weeklyStatsBody');
      if (!body) return;
      
      body.style.padding = '0';
      body.style.textAlign = 'right';
      body.style.color = '#fff';
      
      body.innerHTML = `
        <!-- الرسم البياني -->
        <div class="weekly-chart-wrap">
          ${svg}
        </div>
        
        <!-- الإجماليات -->
        <div class="weekly-totals">
          <div class="weekly-total-card">
            <div class="weekly-total-icon">⚡</div>
            <div class="weekly-total-value">${totalTokens.toLocaleString('ar-EG')}</div>
            <div class="weekly-total-label">إجمالي التوكنات</div>
          </div>
          <div class="weekly-total-card">
            <div class="weekly-total-icon">🖼️</div>
            <div class="weekly-total-value">${totalImages}</div>
            <div class="weekly-total-label">صورة</div>
          </div>
          <div class="weekly-total-card">
            <div class="weekly-total-icon">📞</div>
            <div class="weekly-total-value">${totalVoice}</div>
            <div class="weekly-total-label">دقيقة مكالمة</div>
          </div>
          <div class="weekly-total-card">
            <div class="weekly-total-icon">🤖</div>
            <div class="weekly-total-value">${totalAgent}</div>
            <div class="weekly-total-label">استخدام وكيل</div>
          </div>
        </div>
        
        <!-- أكثر يوم استخدامًا -->
        ${maxDay.tokens > 0 ? `
        <div class="weekly-highlight">
          <div style="font-size:12px; opacity:0.7; margin-bottom:6px;">🏆 أكثر يوم استخدامًا</div>
          <div style="font-size:18px; font-weight:800; color:#fbbf24;">
            ${maxDay.date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style="font-size:13px; opacity:0.75; margin-top:4px;">
            ${Math.max(0, maxDay.tokens).toLocaleString('ar-EG')} توكن
          </div>
        </div>
        ` : '<div class="weekly-empty">لا يوجد استخدام هذا الأسبوع</div>'}
      `;
      
    } catch (err) {
      console.error('Weekly stats error:', err);
      const body = document.getElementById('weeklyStatsBody');
      if (body) {
        body.innerHTML = `
          <div style="padding:30px 20px; color:#f87171;">
            <div style="font-size:36px; margin-bottom:10px;">❌</div>
            <div>فشل تحميل الإحصائيات</div>
            <div style="font-size:11px; opacity:0.7; margin-top:8px;">${err.message}</div>
          </div>
        `;
      }
    }
  }

    // ═══ 📥 تصدير سجل الاستخدام CSV ═══
  async function exportUsageHistoryCSV() {
    if (!window.sbClient || !window.currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولاً');
      return;
    }
    if (typeof window.downloadCSV !== 'function') {
      if (typeof toast === 'function') toast('⚠️ دالة التصدير غير متوفرة');
      return;
    }
    
    if (typeof toast === 'function') toast('⏳ جاري تحضير الملف...');
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const { data, error } = await window.sbClient
        .from('usage_logs')
        .select('type, tokens, created_at')
        .eq('user_id', window.currentUserId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        if (typeof toast === 'function') toast('📭 لا يوجد بيانات للتصدير');
        return;
      }
      
      // بناء الصفوف
      const rows = [
        ['التاريخ', 'الوقت', 'النوع', 'الكمية', 'الوحدة']
      ];
      
      const typeLabels = {
        tokens: 'توكن',
        bonus: 'مكافأة',
        image: 'صورة',
        voice: 'مكالمة (دقيقة)',
        agent: 'وكيل'
      };
      
      data.forEach(r => {
        const d = new Date(r.created_at);
        const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let value = Number(r.tokens) || 0;
        let unit = '';
        
        if (r.type === 'bonus') {
          value = '+' + value;
          unit = 'توكن';
        } else if (r.type === 'tokens') {
          value = '-' + value;
          unit = 'توكن';
        } else if (r.type === 'image') {
          value = 1;
          unit = 'صورة';
        } else if (r.type === 'voice') {
          value = 1;
          unit = 'دقيقة';
        } else if (r.type === 'agent') {
          value = 1;
          unit = 'استخدام';
        }
        
        rows.push([date, time, typeLabels[r.type] || r.type, value, unit]);
      });
      
      // احفظ الملف
      const filename = `mishkat-usage-${new Date().toISOString().slice(0,10)}.csv`;
      const ok = window.downloadCSV(filename, rows);
      
      if (ok && typeof toast === 'function') {
        toast(`✅ تم تصدير ${data.length} سجل`);
      } else if (typeof toast === 'function') {
        toast('❌ فشل التصدير');
      }
    } catch (err) {
      console.error('CSV export error:', err);
      if (typeof toast === 'function') toast('❌ ' + err.message);
    }
  }

  // ═══ 📥 تصدير الإحصائيات الأسبوعية CSV ═══
  async function exportWeeklyStatsCSV() {
    if (!window.sbClient || !window.currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولاً');
      return;
    }
    if (typeof window.downloadCSV !== 'function') {
      if (typeof toast === 'function') toast('⚠️ دالة التصدير غير متوفرة');
      return;
    }
    
    if (typeof toast === 'function') toast('⏳ جاري تحضير الملف...');
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const { data, error } = await window.sbClient
        .from('usage_logs')
        .select('type, tokens, created_at')
        .eq('user_id', window.currentUserId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // نظّم حسب اليوم
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        days.push({
          date: d,
          dateStr: d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          label: d.toLocaleDateString('ar-EG', { weekday: 'long' }),
          tokens: 0,
          images: 0,
          voice: 0,
          agent: 0,
          bonus: 0
        });
      }
      
      (data || []).forEach(r => {
        const rowDate = new Date(r.created_at);
        rowDate.setHours(0, 0, 0, 0);
        const day = days.find(d => d.date.getTime() === rowDate.getTime());
        if (!day) return;
        
        if (r.type === 'tokens') day.tokens += Number(r.tokens) || 0;
        else if (r.type === 'bonus') day.bonus += Number(r.tokens) || 0;
        else if (r.type === 'image') day.images++;
        else if (r.type === 'voice') day.voice++;
        else if (r.type === 'agent') day.agent++;
      });
      
      // بناء الصفوف
      const rows = [
        ['التاريخ', 'اليوم', 'التوكنات', 'المكافآت', 'الصور', 'المكالمات (دقيقة)', 'استخدام الوكيل']
      ];
      
      let totalTokens = 0, totalBonus = 0, totalImages = 0, totalVoice = 0, totalAgent = 0;
      
      days.forEach(d => {
        rows.push([
          d.dateStr,
          d.label,
          d.tokens,
          d.bonus,
          d.images,
          d.voice,
          d.agent
        ]);
        totalTokens += d.tokens;
        totalBonus += d.bonus;
        totalImages += d.images;
        totalVoice += d.voice;
        totalAgent += d.agent;
      });
      
      // صف الإجمالي
      rows.push([]);
      rows.push(['الإجمالي', '', totalTokens, totalBonus, totalImages, totalVoice, totalAgent]);
      
      // احفظ الملف
      const filename = `mishkat-weekly-${new Date().toISOString().slice(0,10)}.csv`;
      const ok = window.downloadCSV(filename, rows);
      
      if (ok && typeof toast === 'function') {
        toast(`✅ تم تصدير الأسبوع`);
      } else if (typeof toast === 'function') {
        toast('❌ فشل التصدير');
      }
    } catch (err) {
      console.error('CSV export error:', err);
      if (typeof toast === 'function') toast('❌ ' + err.message);
    }
  }

  // ═══ نافذة "انتهى الرصيد" ═══
  function showLimitModal(type, check) {
    let modal = document.getElementById('limitModal');
    if (modal) modal.remove();
    
    const typeNames = {
      tokens: 'توكن',
      image: 'صورة',
      voice: 'دقيقة',
      agent: 'استخدام'
    };
    
    modal = document.createElement('div');
    modal.id = 'limitModal';
    modal.className = 'limit-modal-overlay';
    modal.innerHTML = [
      '<div class="limit-modal">',
      '  <div class="limit-modal-icon">🚫</div>',
      '  <h3>انتهى رصيدك اليومي</h3>',
      '  <p>لقد استهلكت كل الـ <b>' + check.limit + '</b> ' + (typeNames[type] || type) + ' المتاحة لك اليوم.</p>',
      '  <p style="font-size:12px; opacity:0.7; margin-top:8px;">⏰ تتجدد الحدود تلقائياً غداً في الساعة 12:00 صباحاً</p>',
      '  <div class="limit-modal-actions">',
      '    <button class="limit-btn primary" onclick="document.getElementById(\'limitModal\').remove(); window.usageLimits.openPanel();">💎 ترقَّ لباقة أعلى</button>',
      '    <button class="limit-btn" onclick="document.getElementById(\'limitModal\').remove()">حسناً</button>',
      '  </div>',
      '</div>'
    ].join('');
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  // ═══ الترقية عبر NOWPayments ═══
    // ═══ الترقية عبر الدفع اليدوي ═══
  window.upgradeToPlan = async function(plan) {
    if (!window.currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولاً');
      return;
    }

    // اسأل عن TX ID عبر نافذة مخصصة
    const txId = await window.mkPrompt(
      `للباقة الـ${plan === 'pro' ? 'احترافية' : 'بريميوم'}:\n\n` +
      `1. أرسل ${plan === 'pro' ? '$10' : '$18'} USDT (TRC20) إلى:\n` +
      `TNatT4u4utHqv8qBUNjWNG4NrJpuk222T\n\n` +
      `2. انسخ TX ID والصقه هنا:`,
      '',
      {
        type: 'info',
        title: '💳 الدفع',
        icon: '💎',
        placeholder: 'TX ID هنا...',
        confirmLabel: 'إرسال الطلب',
        cancelLabel: 'إلغاء'
      }
    );

    if (!txId || txId.trim().length < 10) {
      if (typeof toast === 'function') toast('⚠️ TX ID مطلوب');
      return;
    }

    if (typeof toast === 'function') toast('⏳ يتم إرسال الطلب...');

    try {
      const userRes = await window.sbClient.auth.getUser();
      const email = userRes?.data?.user?.email || '';

      const res = await fetch('/api/manual-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan,
          userId: window.currentUserId,
          txId: txId.trim(),
          email: email
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      if (typeof toast === 'function') {
        toast('✅ تم استلام طلبك! سيتم التحقق خلال 24 ساعة');
      }
      
      // أغلق لوحة الاستهلاك
      const panel = document.getElementById('usagePanel');
      if (panel) panel.remove();
      
    } catch (err) {
      console.error('Upgrade error:', err);
      if (typeof toast === 'function') toast('❌ ' + err.message);
    }
  };

  // ═══ التهيئة ═══
  async function init() {
    await new Promise(resolve => {
      const check = (r = 60) => {
        if (window.currentUserId) return resolve();
        if (r > 0) return setTimeout(() => check(r - 1), 500);
        resolve();
      };
      check();
    });
    
    await loadPlan();
    await loadUsage();
    hookFunctions();
    await checkDailyReward();  // 🎁 المكافأة اليومية
    
    setTimeout(() => {
      updateUsageBadge();
      updatePlanBadge();
      console.log('🔄 Badges refreshed');
    }, 1000);
    
    setInterval(async () => {
      await loadPlan();
      await loadUsage();
    }, 5 * 60 * 1000);
    
    // 💡 حدّث السجل وافحص الاقتراحات (بعد 5 دقائق من الاستخدام)
    updateHistory();
    setTimeout(() => {
      const sug = shouldShowSuggestion();
      if (sug) showUpgradeSuggestion(sug);
    }, 5 * 60 * 1000);
    
    console.log('🎯 Usage limits ready');
  }

    // ═══ صلاحيات الميزات حسب الباقة ═══
  window.featureAccess = {
    voiceCall:    ['pro', 'premium', 'vip'],
    canvas:       ['pro', 'premium', 'vip'],
    wallpaper:    ['pro', 'premium', 'vip'],
    incognito:    ['pro', 'premium', 'vip'],
    export:       ['pro', 'premium', 'vip'],
    share:        ['pro', 'premium', 'vip'],
    tts:          ['pro', 'premium', 'vip'],
    fullPersonas: ['pro', 'premium', 'vip'],
    fullMoods:    ['pro', 'premium', 'vip'],
    aiSettings:   ['premium', 'vip']
    // encryption: متاح للجميع
  };

  window.canUse = function(feature) {
    const allowed = window.featureAccess[feature] || [];
    return allowed.includes(currentPlan);
  };

  window.requirePlan = function(feature, featureName) {
    if (window.canUse(feature)) return true;
    
    const planName = currentPlan === 'free' ? 'الاحترافية' : 'البريميوم';
    if (typeof toast === 'function') {
      toast(`🔒 "${featureName}" متاحة في الباقة الـ${planName} فقط`);
    }
    // 💡 سجّل محاولة الوصول لميزة مقفلة (للاقتراح الذكي لاحقًا)
    if (typeof window.usageLimits_recordLockedUse === 'function') {
      window.usageLimits_recordLockedUse(featureName);
    }
    // فتح لوحة الترقية تلقائيًا بعد لحظة
    setTimeout(() => openUsagePanel(), 1200);
    return false;
  };

  // ═══ الواجهة العامة ═══
  window.usageLimits = {
    check: checkLimit,
    log: logUsage,
    reload: async () => { await loadPlan(); await loadUsage(); },
    getPlan: () => currentPlan,
    getUsage: () => ({ ...usageCache }),
    openPanel: openUsagePanel,
    openWeeklyStats: openWeeklyStats,
    openUsageHistory: openUsageHistory,
    exportUsageHistoryCSV: exportUsageHistoryCSV,
    exportWeeklyStatsCSV: exportWeeklyStatsCSV,
    startStreaming: startStreamingBadge,
    stopStreaming: stopStreamingBadge,
    recordLockedUse: window.usageLimits_recordLockedUse,
    // ⚙️ للصيانة (اختياري)
    resetSuggestionState: () => {
      localStorage.removeItem('mishkat_upgrade_suggestions');
      localStorage.removeItem('mishkat_locked_feature_uses');
    },
    _testSetUsage: (tokens) => {
      usageCache.tokens = tokens;
      updateUsageBadge();
      checkUsageWarnings();
    }
  };

    // ═══ CSS لاقتراح الترقية ═══
  (function injectSuggestionCSS() {
    if (document.getElementById('upgrade-suggestion-css')) return;
    const style = document.createElement('style');
    style.id = 'upgrade-suggestion-css';
    style.textContent = `
      .upgrade-suggestion {
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 380px;
        width: calc(100% - 40px);
        background: linear-gradient(135deg, rgba(23,16,43,0.98), rgba(15,23,42,0.98));
        border: 1px solid rgba(251,191,36,0.4);
        border-radius: 20px;
        padding: 16px;
        display: flex;
        gap: 14px;
        align-items: flex-start;
        box-shadow: 0 24px 60px -14px rgba(0,0,0,0.75),
                    0 0 40px -10px rgba(251,191,36,0.35);
        backdrop-filter: blur(20px) saturate(1.5);
        -webkit-backdrop-filter: blur(20px) saturate(1.5);
        z-index: 100000;
        transform: translateY(140%);
        opacity: 0;
        transition: all 0.5s cubic-bezier(0.34, 1.3, 0.64, 1);
        direction: rtl;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
      }
      .upgrade-suggestion.show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .usg-icon {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: linear-gradient(135deg, #fbbf24, #ec4899);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
        box-shadow: 0 6px 20px rgba(251,191,36,0.5);
        animation: usgPulse 2s ease-in-out infinite;
      }
      @keyframes usgPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
      
      .usg-body {
        flex: 1;
        min-width: 0;
        color: #fff;
      }
      .usg-title {
        font-size: 14px;
        font-weight: 800;
        margin-bottom: 4px;
        color: #fbbf24;
      }
      .usg-text {
        font-size: 12.5px;
        color: rgba(255,255,255,0.75);
        line-height: 1.6;
        margin-bottom: 10px;
      }
      .usg-actions {
        display: flex;
        gap: 6px;
      }
      .usg-go {
        flex: 1;
        padding: 9px 14px;
        background: linear-gradient(135deg, #fbbf24, #ec4899);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 12.5px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(251,191,36,0.4);
        transition: all 0.2s;
      }
      .usg-go:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 22px rgba(251,191,36,0.55);
      }
      .usg-later {
        padding: 9px 14px;
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.8);
        border: none;
        border-radius: 10px;
        font-size: 12.5px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s;
      }
      .usg-later:hover {
        background: rgba(255,255,255,0.12);
      }
      .usg-x {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.4);
        cursor: pointer;
        font-size: 14px;
        padding: 4px 6px;
        border-radius: 6px;
        font-family: inherit;
        align-self: flex-start;
        transition: all 0.2s;
      }
      .usg-x:hover {
        color: #fff;
        background: rgba(255,255,255,0.1);
      }
      
      @media (max-width: 600px) {
        .upgrade-suggestion {
          left: 16px;
          right: 16px;
          bottom: 16px;
          max-width: none;
          padding: 14px;
        }
        .usg-icon { width: 40px; height: 40px; font-size: 20px; }
        .usg-title { font-size: 13px; }
        .usg-text { font-size: 11.5px; }
      }
    `;
    document.head.appendChild(style);
  })();

    // ═══ CSS لسجل الاستخدام ═══
  (function injectHistoryCSS() {
    if (document.getElementById('usage-history-css')) return;
    const style = document.createElement('style');
    style.id = 'usage-history-css';
    style.textContent = `
      .history-list {
        max-height: 60vh;
        overflow-y: auto;
        padding-left: 4px;
        scrollbar-width: thin;
        scrollbar-color: rgba(251,191,36,0.4) transparent;
      }
      .history-list::-webkit-scrollbar { width: 6px; }
      .history-list::-webkit-scrollbar-thumb {
        background: rgba(251,191,36,0.4);
        border-radius: 3px;
      }
      
      .history-day {
        margin-bottom: 16px;
      }
      .history-day-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: linear-gradient(135deg, rgba(251,191,36,0.12), rgba(236,72,153,0.08));
        border: 1px solid rgba(251,191,36,0.2);
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        color: #fbbf24;
        margin-bottom: 8px;
        position: sticky;
        top: 0;
        z-index: 2;
        backdrop-filter: blur(10px);
      }
      .history-day-total {
        font-size: 11px;
        background: rgba(251,191,36,0.15);
        padding: 3px 8px;
        border-radius: 999px;
        color: #fef3c7;
        font-weight: 600;
      }
      
      .history-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .history-item {
        display: grid;
        grid-template-columns: 26px 1fr auto auto;
        gap: 10px;
        align-items: center;
        padding: 8px 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        font-size: 12.5px;
        transition: all 0.18s;
      }
      .history-item:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(251,191,36,0.25);
        transform: translateX(-3px);
      }
      .history-icon {
        font-size: 16px;
        text-align: center;
      }
      .history-label {
        color: rgba(255,255,255,0.75);
        font-weight: 500;
      }
      .history-value {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        min-width: 55px;
        text-align: left;
        direction: ltr;
        font-size: 12px;
      }
      .history-value.usage { color: #fbbf24; }
      .history-value.bonus { color: #6ee7b7; }
      .history-value.normal { color: rgba(255,255,255,0.9); }
      .history-time {
        color: rgba(255,255,255,0.4);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        min-width: 55px;
        text-align: left;
        direction: ltr;
      }
      
      @media (max-width: 480px) {
        .history-item {
          grid-template-columns: 22px 1fr auto;
          gap: 8px;
          padding: 7px 10px;
          font-size: 11.5px;
        }
        .history-time {
          grid-column: 3;
          grid-row: 2;
          font-size: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  })();

    // ═══ CSS للإحصائيات الأسبوعية ═══
  (function injectWeeklyStatsCSS() {
    if (document.getElementById('weekly-stats-css')) return;
    const style = document.createElement('style');
    style.id = 'weekly-stats-css';
    style.textContent = `
      .weekly-stats-overlay {
        position: fixed; inset: 0; z-index: 100001;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 0.3s;
      }
      .weekly-stats-overlay.show { opacity: 1; }
      
      .weekly-stats-modal {
        background: linear-gradient(160deg, #1a0f33, #0d0819);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 24px;
        padding: 22px;
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 40px 100px -20px rgba(0,0,0,0.85),
                    0 0 60px -15px rgba(251, 191, 36, 0.2);
        animation: weeklyPop 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
        color: #fff;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        direction: rtl;
      }
      @keyframes weeklyPop {
        from { opacity: 0; transform: scale(0.9) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      
      .weekly-stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(251,191,36,0.2);
      }
      .weekly-stats-header h3 {
        font-size: 16px;
        font-weight: 800;
        color: #fbbf24;
        margin: 0;
      }
      .weekly-stats-header button {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 8px;
        font-family: inherit;
        transition: all 0.2s;
      }
      .weekly-stats-header button:hover {
        background: rgba(255,255,255,0.08);
        color: #fff;
      }
      
      .weekly-chart-wrap {
        background: linear-gradient(135deg, rgba(251,191,36,0.05), rgba(168,85,247,0.03));
        border: 1px solid rgba(251,191,36,0.15);
        border-radius: 16px;
        padding: 14px 8px 6px;
        margin-bottom: 16px;
      }
      .weekly-chart {
        width: 100%;
        height: auto;
        display: block;
      }
      .weekly-bar {
        transform-origin: bottom;
        animation: barGrow 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) backwards;
      }
      @keyframes barGrow {
        from { transform: scaleY(0); opacity: 0; }
        to { transform: scaleY(1); opacity: 1; }
      }
      
      .weekly-totals {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }
      .weekly-total-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 12px 6px;
        text-align: center;
        transition: all 0.2s;
      }
      .weekly-total-card:hover {
        border-color: rgba(251,191,36,0.4);
        transform: translateY(-2px);
      }
      .weekly-total-icon {
        font-size: 22px;
        margin-bottom: 6px;
      }
      .weekly-total-value {
        font-size: 18px;
        font-weight: 800;
        color: #fbbf24;
        font-variant-numeric: tabular-nums;
        margin-bottom: 2px;
      }
      .weekly-total-label {
        font-size: 10.5px;
        opacity: 0.65;
      }
      
      .weekly-highlight {
        background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(236,72,153,0.08));
        border: 1px solid rgba(251,191,36,0.3);
        border-radius: 16px;
        padding: 16px;
        text-align: center;
        margin-top: 4px;
      }
      .weekly-empty {
        text-align: center;
        padding: 30px 20px;
        color: rgba(255,255,255,0.4);
        font-size: 13px;
      }
      
      .usage-stats-btn {
        background: linear-gradient(135deg, #fbbf24, #ec4899) !important;
        color: #fff !important;
        border: none !important;
        padding: 4px 10px !important;
        border-radius: 8px !important;
        cursor: pointer;
        font-size: 14px !important;
        font-family: inherit;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(251, 191, 36, 0.35);
      }
      .usage-stats-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 18px rgba(251, 191, 36, 0.5);
      }
      
      @media (max-width: 480px) {
        .weekly-stats-modal { padding: 16px; border-radius: 20px; }
        .weekly-totals { grid-template-columns: repeat(2, 1fr); }
        .weekly-total-value { font-size: 15px; }
        .weekly-total-icon { font-size: 18px; }
        .weekly-total-label { font-size: 9.5px; }
      }
    `;
    document.head.appendChild(style);
  })();

    // ═══ CSS لإشعار المكافأة ═══
  (function injectBonusCSS() {
    if (document.getElementById('bonus-css')) return;
    const style = document.createElement('style');
    style.id = 'bonus-css';
    style.textContent = `
      @keyframes bonusGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.5); }
        50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.9); }
      }
    `;
    document.head.appendChild(style);
  })();

    // ═══ CSS للنبض أثناء البث ═══
  (function injectStreamingCSS() {
    if (document.getElementById('usage-streaming-css')) return;
    const style = document.createElement('style');
    style.id = 'usage-streaming-css';
    style.textContent = `
      .usage-float-badge.streaming {
        animation: usagePulse 1.2s ease-in-out infinite !important;
        border-color: rgba(139, 92, 246, 0.8) !important;
        box-shadow: 0 6px 24px rgba(139, 92, 246, 0.5) !important;
      }
      @keyframes usagePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
    `;
    document.head.appendChild(style);
  })();

    // ═══ CSS لبطاقات الترقية ═══
  (function injectPlanCardsCSS() {
    if (document.getElementById('plan-cards-css')) return;
    const style = document.createElement('style');
    style.id = 'plan-cards-css';
    style.textContent = `
      .plan-full {
        background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        padding: 18px 16px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
        position: relative;
        overflow: hidden;
      }
      .plan-full:hover {
        border-color: #fbbf24;
        background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(236,72,153,0.05));
        transform: translateY(-3px);
        box-shadow: 0 14px 32px -10px rgba(251, 191, 36, 0.45);
      }
      .plan-full.featured {
        border-color: rgba(236, 72, 153, 0.5);
        background: linear-gradient(135deg, rgba(236,72,153,0.1), rgba(168,85,247,0.06));
      }
      .plan-full.featured:hover {
        border-color: #ec4899;
        box-shadow: 0 14px 32px -10px rgba(236, 72, 153, 0.55);
      }
      .plan-full-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 4px 10px;
        background: linear-gradient(135deg, #ec4899, #a855f7);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        border-radius: 999px;
        letter-spacing: 0.3px;
        box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
      }
      .plan-full-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .plan-full-icon {
        font-size: 32px;
        flex-shrink: 0;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      }
      .plan-full-title {
        font-size: 16px;
        font-weight: 800;
        color: #fff;
        margin-bottom: 2px;
      }
      .plan-full-sub {
        font-size: 11px;
        color: rgba(255,255,255,0.55);
      }
      .plan-full-price {
        font-size: 22px;
        font-weight: 800;
        color: #fbbf24;
        white-space: nowrap;
      }
      .plan-full-price span {
        font-size: 11px;
        opacity: 0.7;
        font-weight: 500;
        margin-right: 2px;
      }
      .plan-full-limits {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .plan-full-limits span {
        padding: 5px 10px;
        background: rgba(255,255,255,0.06);
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
      }
      .plan-full-feat-title {
        font-size: 12px;
        font-weight: 700;
        color: #fbbf24;
        margin-bottom: 8px;
      }
      .plan-full-features {
        list-style: none;
        padding: 0;
        margin: 0 0 14px 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .plan-full-features li {
        font-size: 11.5px;
        color: rgba(255,255,255,0.88);
        padding: 4px 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .plan-full-cta {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #fbbf24, #ec4899);
        color: #fff;
        text-align: center;
        font-size: 13.5px;
        font-weight: 800;
        border-radius: 12px;
        box-shadow: 0 6px 18px rgba(251, 191, 36, 0.35);
      }
      .plan-full.featured .plan-full-cta {
        background: linear-gradient(135deg, #ec4899, #a855f7);
        box-shadow: 0 6px 18px rgba(236, 72, 153, 0.45);
      }
      @media (max-width: 480px) {
        .plan-full-features { grid-template-columns: 1fr; }
        .plan-full-price { font-size: 18px; }
        .plan-full-title { font-size: 14px; }
        .plan-full-icon { font-size: 26px; }
      }
    `;
    document.head.appendChild(style);
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();