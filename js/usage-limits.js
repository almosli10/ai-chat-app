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
      let bonusTotal = 0;
      (data || []).forEach(r => {
        if (r.type === 'tokens') {
          usageCache.tokens += Number(r.tokens) || 0;
        } else if (r.type === 'bonus') {
          bonusTotal += Number(r.tokens) || 0;
        } else if (usageCache[r.type] !== undefined) {
          usageCache[r.type]++;
        }
      });
      // 🎁 اخصم المكافآت من الاستهلاك الفعلي
      usageCache.tokens = Math.max(0, usageCache.tokens - bonusTotal);
      
      // 🔄 إذا تغير اليوم، أعد تعيين الإشعارات
      const today = new Date().toDateString();
      if (cacheDate && cacheDate !== today) {
        resetWarnings();
      }
      cacheDate = today;
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
    
    const limit = PLAN_LIMITS[currentPlan]?.[type] || PLAN_LIMITS.free[type];
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
      
      // حدّث العرض مباشرة
      usageCache.tokens = Math.max(0, (usageCache.tokens || 0) - BONUS);
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
    const limit = plan.tokens;
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
    const limit = plan.tokens;
    
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
      const limit = plan[s.key];
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
    
    const headerHtml = '<div class="usage-panel-header"><span>📊 استهلاكك اليومي</span><button onclick="this.closest(\'.usage-panel\').remove()">✕</button></div>';
    
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

    // اسأل عن TX ID
    const txId = prompt(
      `💳 للاشتراك في الباقة الـ${plan === 'pro' ? 'احترافية' : 'بريميوم'}:\n\n` +
      `1. أرسل ${plan === 'pro' ? '$10' : '$18'} USDT (TRC20) إلى:\n` +
      `TNatT4u4utHqv8qBUNjWNG4NrJpuk222T\n\n` +
      `2. انسخ TX ID من محفظتك والصقه هنا:`
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
    fullMoods:    ['pro', 'premium', 'vip']
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
    startStreaming: startStreamingBadge,
    stopStreaming: stopStreamingBadge,
    // 🧪 أداة اختبار (يمكن حذفها لاحقًا)
    _testSetUsage: (tokens) => {
      usageCache.tokens = tokens;
      updateUsageBadge();
      checkUsageWarnings();
    }
  };

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