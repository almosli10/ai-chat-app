// js/usage-limits.js — نظام حدود الاستخدام والباقات
(function usageLimits() {
  'use strict';

  // ═══ إعدادات الباقات ═══
  const PLAN_LIMITS = {
    free:    { chat: 30,   image: 3,   voice: 5,    agent: 5,    name: 'مجاني',   icon: '🆓' },
    pro:     { chat: 500,  image: 50,  voice: 60,   agent: 100,  name: 'احترافي', icon: '⭐' },
    premium: { chat: 2000, image: 200, voice: 300,  agent: 500,  name: 'بريميوم', icon: '💎' },
    vip:     { chat: Infinity, image: Infinity, voice: Infinity, agent: Infinity, name: 'خاص', icon: '👑' }
  };

  let currentPlan = 'free';
  let usageCache = { chat: 0, image: 0, voice: 0, agent: 0 };
  let cacheDate = null;

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
        .select('type')
        .eq('user_id', window.currentUserId)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      
      usageCache = { chat: 0, image: 0, voice: 0, agent: 0 };
      (data || []).forEach(r => {
        if (usageCache[r.type] !== undefined) usageCache[r.type]++;
      });
      
      cacheDate = new Date().toDateString();
      console.log('📊 Usage loaded:', usageCache);
    } catch (e) {
      console.warn('Usage load failed:', e);
    }
    updateUsageBadge();
  }

  // ═══ فحص الحد قبل العملية ═══
  async function checkLimit(type) {
    // VIP = بلا حدود
    if (currentPlan === 'vip') return { allowed: true, remaining: Infinity };
    
    // أعد التحميل إذا تغيّر اليوم
    const today = new Date().toDateString();
    if (cacheDate !== today) {
      await loadUsage();
    }
    
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

  // ═══ تسجيل الاستخدام ═══
  async function logUsage(type, tokens = 0) {
    if (!window.sbClient || !window.currentUserId) return;
    
    // زد العداد محلياً
    usageCache[type] = (usageCache[type] || 0) + 1;
    updateUsageBadge();
    
    // احفظ في Supabase
    try {
      await window.sbClient.from('usage_logs').insert({
        user_id: window.currentUserId,
        type,
        tokens
      });
    } catch (e) {
      console.warn('Usage log failed:', e);
    }
  }

  // ═══ عرض شارة الباقة في بطاقة المستخدم ═══
  function updatePlanBadge() {
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    
    // احذف أي شارة قديمة
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

  // ═══ عرض شارة الاستهلاك — عائمة ثابتة (مع styles مضمّنة) ═══
  function updateUsageBadge() {
    let badge = document.getElementById('usageBadge');
    
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'usageBadge';
      badge.className = 'usage-float-badge';
      badge.title = 'الاستهلاك اليومي';
      badge.onclick = openUsagePanel;
      // ستايلات مضمّنة لضمان الظهور دائماً
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
    const used = usageCache.chat || 0;
    const limit = plan.chat;
    
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
      badge.innerHTML = `<span style="font-size:14px;">📊</span><span>${used}/${limit}</span>`;
    }
  }

  // ═══ نافذة الاستهلاك والباقات ═══
  function openUsagePanel() {
    let panel = document.getElementById('usagePanel');
    if (panel) { panel.remove(); return; }
    
    const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    
    const stats = [
      { key: 'chat',   icon: '💬', name: 'الرسائل' },
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
      
      return `
        <div class="usage-stat-row">
          <div class="usage-stat-head">
            <span>${s.icon} ${s.name}</span>
            <span class="usage-stat-num">${isUnlimited ? '∞' : `${used} / ${limit}`}</span>
          </div>
          ${!isUnlimited ? `
            <div class="usage-progress">
              <div class="usage-progress-fill" style="width:${percent}%; background:${color};"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    panel = document.createElement('div');
    panel.id = 'usagePanel';
    panel.className = 'usage-panel';
    panel.innerHTML = `
      <div class="usage-panel-header">
        <span>📊 استهلاكك اليومي</span>
        <button onclick="this.closest('.usage-panel').remove()">✕</button>
      </div>
      
      <div class="usage-plan-info">
        <div class="usage-plan-current">
          <span style="font-size:32px;">${plan.icon}</span>
          <div>
            <div style="font-size:16px; font-weight:800; color:#fbbf24;">باقة ${plan.name}</div>
            <div style="font-size:11px; opacity:0.65;">تتجدد الحدود كل يوم عند منتصف الليل</div>
          </div>
        </div>
      </div>
      
      <div class="usage-stats">${statsHtml}</div>
      
      ${currentPlan !== 'vip' ? `
        <div class="usage-upgrade-cta">
          <div style="font-size:13px; font-weight:700; margin-bottom:8px;">🚀 ترقَّ لباقة أعلى</div>
          <div style="font-size:11.5px; opacity:0.7; margin-bottom:12px; line-height:1.6;">
            احصل على رسائل أكثر، صور أكثر، ومكالمات أطول بدون حدود.
          </div>
          <button class="usage-upgrade-btn" onclick="alert('قريباً! 🚀')">
            💎 عرض الباقات
          </button>
        </div>
      ` : `
        <div style="text-align:center; padding:16px; font-size:12px; opacity:0.7;">
          👑 أنت في الباقة الخاصة — بلا حدود!
        </div>
      `}
    `;
    document.body.appendChild(panel);
  }

  // ═══ ربط مع دوال الإرسال ═══
  function hookFunctions() {
    const tryHook = (name, type) => {
      const orig = window[name];
      if (!orig || orig.__usageHooked) return false;
      
      window[name] = async function() {
        const check = await checkLimit(type);
        if (!check.allowed) {
          showLimitModal(type, check);
          return;
        }
        const result = await orig.apply(this, arguments);
        logUsage(type);
        return result;
      };
      window[name].__usageHooked = true;
      return true;
    };
    
    const hooked = [];
    if (tryHook('send', 'chat')) hooked.push('send');
    if (tryHook('generateImage', 'image')) hooked.push('generateImage');
    
    console.log('✅ Usage hooks:', hooked.join(', ') || 'waiting...');
  }

  // ═══ نافذة "انتهى الرصيد" ═══
  function showLimitModal(type, check) {
    let modal = document.getElementById('limitModal');
    if (modal) modal.remove();
    
    const typeNames = {
      chat: 'الرسائل',
      image: 'الصور',
      voice: 'المكالمات',
      agent: 'الوكيل'
    };
    
    modal = document.createElement('div');
    modal.id = 'limitModal';
    modal.className = 'limit-modal-overlay';
    modal.innerHTML = `
      <div class="limit-modal">
        <div class="limit-modal-icon">🚫</div>
        <h3>انتهى رصيدك اليومي</h3>
        <p>لقد استهلكت كل الـ <b>${check.limit}</b> ${typeNames[type] || type} المتاحة لك اليوم.</p>
        <p style="font-size:12px; opacity:0.7; margin-top:8px;">
          ⏰ تتجدد الحدود تلقائياً غداً في الساعة 12:00 صباحاً
        </p>
        <div class="limit-modal-actions">
          <button class="limit-btn primary" onclick="alert('قريباً! 🚀');">
            💎 ترقَّ للباقة الاحترافية
          </button>
          <button class="limit-btn" onclick="document.getElementById('limitModal').remove()">
            حسناً
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  // ═══ التهيئة ═══
  async function init() {
    // انتظر حتى يُحمّل المستخدم
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
    
    // 🔥 استدعاء قسري بعد التهيئة
    setTimeout(() => {
      updateUsageBadge();
      updatePlanBadge();
      console.log('🔄 Badges refreshed');
    }, 1000);
    
    // كل 5 دقائق — أعد التحميل
    setInterval(async () => {
      await loadPlan();
      await loadUsage();
    }, 5 * 60 * 1000);
    
    console.log('🎯 Usage limits ready');
  }

  // ═══ الواجهة العامة ═══
  window.usageLimits = {
    check: checkLimit,
    log: logUsage,
    reload: async () => { await loadPlan(); await loadUsage(); },
    getPlan: () => currentPlan,
    getUsage: () => ({ ...usageCache }),
    openPanel: openUsagePanel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();