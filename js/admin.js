// js/admin.js — منطق لوحة تحكم المشرف
(function adminPanel() {
  'use strict';

  const SUPABASE_URL = 'https://cxdwgzdwwexgfdfhaknx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_n2GJfENoUb1s58bDEB7zAg_bDWUc9rw';

  let supabase = null;
  let currentSession = null;
  let dataCache = null;
  let rejectPaymentId = null;

  // ═══ التهيئة ═══
  async function init() {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        return showAccessDenied();
      }

      currentSession = data.session;
      
      // جلب بيانات المشرف
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        document.getElementById('adminEmail').textContent = user.email;
      }

      // جرب جلب البيانات
      await loadData();
      
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
      
      wireEvents();
      
    } catch (error) {
      console.error('Init error:', error);
      if (error.message.includes('403') || error.message.includes('admin')) {
        showAccessDenied();
      } else {
        alert('خطأ في التحميل: ' + error.message);
      }
    }
  }

  function showAccessDenied() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'flex';
  }

  // ═══ جلب البيانات من API ═══
  async function loadData() {
    const token = currentSession.access_token;
    
    const res = await fetch('/api/admin-list', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (res.status === 403) throw new Error('admin access denied');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل جلب البيانات');
    }

    dataCache = await res.json();
    render();
  }

  // ═══ العرض ═══
  function render() {
    if (!dataCache) return;

    // الإحصائيات
    document.getElementById('statRevenue').textContent = '$' + dataCache.stats.totalRevenue;
    document.getElementById('statPending').textContent = dataCache.stats.pendingCount;
    document.getElementById('statPro').textContent = dataCache.stats.activePro;
    document.getElementById('statPremium').textContent = dataCache.stats.activePremium;
    document.getElementById('statUsers').textContent = dataCache.stats.totalUsers;
    document.getElementById('pendingBadge').textContent = dataCache.stats.pendingCount;

    renderPending();
    renderSubscriptions();
    renderUsers();
  }

  // ═══ الطلبات المعلقة ═══
  function renderPending() {
    const list = document.getElementById('paymentsList');
    const empty = document.getElementById('pendingEmpty');
    const pending = dataCache.pending || [];

    if (pending.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = pending.map(p => {
      const planName = p.plan === 'pro' ? 'احترافي ⭐' : 'بريميوم 💎';
      const planClass = p.plan === 'pro' ? 'pro' : 'premium';
      const date = new Date(p.created_at).toLocaleString('ar-EG');
      
      return `
        <div class="payment-card ${planClass}">
          <div class="payment-header">
            <div class="payment-plan">${planName}</div>
            <div class="payment-amount">$${p.amount_usd}</div>
          </div>
          <div class="payment-body">
            <div class="payment-row">
              <span class="label">البريد:</span>
              <span class="value">${escapeHtml(p.user_email || 'غير معروف')}</span>
            </div>
            <div class="payment-row">
              <span class="label">TX ID:</span>
              <span class="value mono" title="${escapeHtml(p.tx_id)}">${escapeHtml(p.tx_id.substring(0, 20))}...</span>
            </div>
            <div class="payment-row">
              <span class="label">التاريخ:</span>
              <span class="value">${date}</span>
            </div>
          </div>
          <div class="payment-actions">
            <button onclick="window.confirmPayment(${p.id})" class="btn-confirm">
              ✅ تأكيد الدفع
            </button>
            <button onclick="window.openRejectModal(${p.id})" class="btn-reject">
              ❌ رفض
            </button>
            <button onclick="window.openTronscan('${escapeHtml(p.tx_id)}')" class="btn-view">
              🔍 التحقق
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ═══ الاشتراكات ═══
  function renderSubscriptions() {
    const tbody = document.getElementById('subscriptionsTable');
    const subs = dataCache.subscriptions || [];

    if (subs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">لا توجد اشتراكات</td></tr>';
      return;
    }

    tbody.innerHTML = subs.map(s => {
      const planIcon = { free: '🆓', pro: '⭐', premium: '💎', vip: '👑' }[s.plan] || '🆓';
      const planName = { free: 'مجاني', pro: 'احترافي', premium: 'بريميوم', vip: 'خاص' }[s.plan] || s.plan;
      const statusColor = s.status === 'active' ? 'green' : 'red';
      const startDate = s.started_at ? new Date(s.started_at).toLocaleDateString('ar-EG') : '—';
      const endDate = s.expires_at ? new Date(s.expires_at).toLocaleDateString('ar-EG') : '—';
      
      return `
        <tr>
          <td>${escapeHtml(s.user_email)}</td>
          <td>${planIcon} ${planName}</td>
          <td><span class="status-badge ${statusColor}">${s.status}</span></td>
          <td>${startDate}</td>
          <td>${endDate}</td>
        </tr>
      `;
    }).join('');
  }

  // ═══ المستخدمون ═══
  function renderUsers() {
    const tbody = document.getElementById('usersTable');
    const users = dataCache.users || [];

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">لا يوجد مستخدمون</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const created = new Date(u.created_at).toLocaleDateString('ar-EG');
      const lastLogin = u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('ar-EG') : 'لم يدخل بعد';
      
      return `
        <tr>
          <td>${escapeHtml(u.email || '—')}</td>
          <td><code class="mono">${u.id.substring(0, 8)}...</code></td>
          <td>${created}</td>
          <td>${lastLogin}</td>
        </tr>
      `;
    }).join('');
  }

  // ═══ تأكيد الدفع ═══
  window.confirmPayment = async function(paymentId) {
    if (!confirm('هل أنت متأكد من تأكيد هذا الدفع؟\n\nسيتم ترقية المستخدم فوراً.')) return;

    try {
      const res = await fetch('/api/admin-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentSession.access_token
        },
        body: JSON.stringify({ paymentId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التأكيد');

      showToast('✅ تم تأكيد الدفع وترقية المستخدم', 'success');
      await loadData();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  // ═══ نافذة الرفض ═══
  window.openRejectModal = function(paymentId) {
    rejectPaymentId = paymentId;
    document.getElementById('rejectReason').value = '';
    document.getElementById('rejectModal').style.display = 'flex';
  };

  window.closeRejectModal = function() {
    rejectPaymentId = null;
    document.getElementById('rejectModal').style.display = 'none';
  };

  window.confirmReject = async function() {
    if (!rejectPaymentId) return;
    const reason = document.getElementById('rejectReason').value.trim();

    try {
      const res = await fetch('/api/admin-reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentSession.access_token
        },
        body: JSON.stringify({ paymentId: rejectPaymentId, reason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الرفض');

      closeRejectModal();
      showToast('✅ تم رفض الطلب', 'success');
      await loadData();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  // ═══ التحقق على TRONSCAN ═══
  window.openTronscan = function(txId) {
    window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');
  };

  // ═══ تحديث ═══
  window.refreshData = async function() {
    try {
      await loadData();
      showToast('🔄 تم التحديث', 'success');
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  // ═══ الأحداث ═══
  function wireEvents() {
    // التبويبات
    document.querySelectorAll('.tab').forEach(tab => {
      tab.onclick = () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tab-content').forEach(c => {
          c.classList.toggle('active', c.id === 'tab-' + target);
        });
      };
    });
  }

  // ═══ Toast ═══
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.className = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'admin-toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // ═══ Helpers ═══
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // ═══ ابدأ ═══
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();