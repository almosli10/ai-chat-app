// js/admin.js — منطق لوحة تحكم المشرف (نسخة محدثة)
(function adminPanel() {
  'use strict';

  const SUPABASE_URL = 'https://cxdwgzdwwexgfdfhaknx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_n2GJfENoUb1s58bDEB7zAg_bDWUc9rw';

  let supabase = null;
  let currentSession = null;
  let dataCache = null;
  let rejectPaymentId = null;
  let revenueChart = null;
  let userSearchQuery = '';

  async function init() {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return showAccessDenied();
      currentSession = data.session;

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) document.getElementById('adminEmail').textContent = user.email;

      await loadData();
      
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
      
      wireEvents();
    } catch (error) {
      console.error('Init error:', error);
      if (error.message.includes('admin')) showAccessDenied();
      else alert('خطأ: ' + error.message);
    }
  }

  function showAccessDenied() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'flex';
  }

  async function loadData() {
    const token = currentSession.access_token;
    const res = await fetch('/api/admin?action=list', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 403) throw new Error('admin access denied');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل جلب البيانات');
    }

    dataCache = await res.json();
    render();
  }

  function render() {
    if (!dataCache) return;

    document.getElementById('statRevenue').textContent = '$' + dataCache.stats.totalRevenue;
    document.getElementById('statPending').textContent = dataCache.stats.pendingCount;
    document.getElementById('statPro').textContent = dataCache.stats.activePro;
    document.getElementById('statPremium').textContent = dataCache.stats.activePremium;
    document.getElementById('statUsers').textContent = dataCache.stats.totalUsers;
    document.getElementById('pendingBadge').textContent = dataCache.stats.pendingCount;

    renderPending();
    renderSubscriptions();
    renderUsers();
    renderRevenueChart();
  }

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
      const shortTx = p.tx_id.substring(0, 20) + '...';
      
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
              <span class="value mono" title="${escapeHtml(p.tx_id)}">${escapeHtml(shortTx)}</span>
            </div>
            <div class="payment-row">
              <span class="label">التاريخ:</span>
              <span class="value">${date}</span>
            </div>
            ${p.notes ? `<div class="payment-row"><span class="label">ملاحظات:</span><span class="value">${escapeHtml(p.notes)}</span></div>` : ''}
          </div>
          <div class="payment-actions">
            <button onclick="window.verifyPayment(${p.id})" class="btn-verify">🔍 تحقق</button>
            <button onclick="window.confirmPayment(${p.id})" class="btn-confirm">✅ تأكيد</button>
            <button onclick="window.openRejectModal(${p.id})" class="btn-reject">❌ رفض</button>
            <button onclick="window.openTronscan('${escapeHtml(p.tx_id)}')" class="btn-view">🌐</button>
          </div>
        </div>
      `;
    }).join('');
  }

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

  function renderUsers() {
    const tbody = document.getElementById('usersTable');
    let users = dataCache.users || [];

    if (userSearchQuery) {
      const q = userSearchQuery.toLowerCase();
      users = users.filter(u => (u.email || '').toLowerCase().includes(q));
    }

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">لا يوجد مستخدمون</td></tr>';
      return;
    }

    // اجلب باقة كل مستخدم
    const subs = dataCache.subscriptions || [];
    const subMap = {};
    subs.forEach(s => { subMap[s.user_id] = s.plan; });

    tbody.innerHTML = users.map(u => {
      const created = new Date(u.created_at).toLocaleDateString('ar-EG');
      const plan = subMap[u.id] || 'free';
      const planIcon = { free: '🆓', pro: '⭐', premium: '💎', vip: '👑' }[plan] || '🆓';
      const planName = { free: 'مجاني', pro: 'احترافي', premium: 'بريميوم', vip: 'خاص' }[plan] || plan;
      
      return `
        <tr>
          <td>${escapeHtml(u.email || '—')}</td>
          <td><code class="mono">${u.id.substring(0, 8)}...</code></td>
          <td>${planIcon} ${planName}</td>
          <td>${created}</td>
        </tr>
      `;
    }).join('');
  }

  // ═══ رسم بياني للإيرادات ═══
  function renderRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas || !window.Chart) return;

    const chart = dataCache.chartData || { labels: [], data: [] };

    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chart.labels,
        datasets: [{
          label: 'الإيرادات ($)',
          data: chart.data,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#fbbf24',
          pointBorderColor: '#0d0819',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 8, 25, 0.95)',
            titleColor: '#fbbf24',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(251, 191, 36, 0.3)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (ctx) => '$' + ctx.parsed.y.toFixed(2)
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => '$' + v },
            beginAtZero: true
          }
        }
      }
    });
  }

  // ═══ التحقق التلقائي ═══
  window.verifyPayment = async function(paymentId) {
    try {
      showToast('🔍 جاري التحقق من البلوكتشين...', 'success');
      
      const res = await fetch('/api/admin?action=verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentSession.access_token
        },
        body: JSON.stringify({ paymentId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const v = data.verification;
      if (v.ok) {
        showToast(`✅ صحيح! استلمت ${v.amount} USDT`, 'success');
      } else {
        showToast(`❌ ${v.error}`, 'error');
      }
      
      await loadData();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  window.confirmPayment = async function(paymentId) {
    if (!confirm('تأكيد الدفع وترقية المستخدم؟')) return;
    try {
      const res = await fetch('/api/admin?action=confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentSession.access_token
        },
        body: JSON.stringify({ paymentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل');
      showToast('✅ تم تأكيد الدفع', 'success');
      await loadData();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

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
      const res = await fetch('/api/admin?action=reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentSession.access_token
        },
        body: JSON.stringify({ paymentId: rejectPaymentId, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      closeRejectModal();
      showToast('✅ تم رفض الطلب', 'success');
      await loadData();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  window.openTronscan = function(txId) {
    window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');
  };

  window.refreshData = async function() {
    try {
      await loadData();
      showToast('🔄 تم التحديث', 'success');
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  // ═══ تصدير CSV ═══
  window.exportUsersCSV = function() {
    const users = dataCache.users || [];
    if (users.length === 0) return showToast('⚠️ لا يوجد مستخدمون', 'error');

    const headers = ['البريد', 'المعرّف', 'تاريخ التسجيل', 'آخر دخول'];
    const rows = users.map(u => [
      u.email || '',
      u.id,
      u.created_at || '',
      u.last_sign_in || ''
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mishkat-users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 تم التصدير', 'success');
  };

  function wireEvents() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.onclick = () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tab-content').forEach(c => {
          c.classList.toggle('active', c.id === 'tab-' + target);
        });
      };
    });

    const search = document.getElementById('userSearch');
    if (search) {
      search.oninput = (e) => {
        userSearchQuery = e.target.value.trim();
        renderUsers();
      };
    }
  }

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

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();