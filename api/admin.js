// api/admin.js — كل عمليات لوحة التحكم في ملف واحد
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyTransaction } from '../lib/tron-verify.js';

const WALLET = 'TNatT4u4utHqv8qBUNjWNG4NrJpuk222T';

// ═══ التحقق من المشرف ═══
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) return { ok: false, error: 'No token', code: 401 };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_USER_ID) {
    return { ok: false, error: 'Server config missing', code: 500 };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return { ok: false, error: 'Invalid token', code: 401 };
  if (user.id !== ADMIN_USER_ID) return { ok: false, error: 'Not admin', code: 403 };

  return { ok: true, user, supabase };
}

// ═══ الموزّع الرئيسي ═══
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const { supabase, user: adminUser } = auth;
  const action = req.query.action || (req.body && req.body.action);

  try {
    // ═══════════ LIST ═══════════
    if (action === 'list') {
      const { data: pending } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*')
        .order('started_at', { ascending: false });

      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 100 });

      const { data: confirmed } = await supabase
        .from('pending_payments')
        .select('amount_usd, created_at, confirmed_at')
        .eq('status', 'confirmed');

      const usersMap = {};
      (usersData?.users || []).forEach(u => {
        usersMap[u.id] = {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in: u.last_sign_in_at
        };
      });

      const enrichedPending = (pending || []).map(p => ({
        ...p,
        user_email: usersMap[p.user_id]?.email || p.email || 'غير معروف'
      }));

      const enrichedSubs = (subscriptions || []).map(s => ({
        ...s,
        user_email: usersMap[s.user_id]?.email || 'غير معروف'
      }));

      const totalRevenue = (confirmed || []).reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0);
      const activePro = (subscriptions || []).filter(s => s.plan === 'pro' && s.status === 'active').length;
      const activePremium = (subscriptions || []).filter(s => s.plan === 'premium' && s.status === 'active').length;

      // بيانات الرسم البياني (آخر 30 يوم)
      const chartData = buildChartData(confirmed || []);

      return res.json({
        success: true,
        pending: enrichedPending,
        subscriptions: enrichedSubs,
        users: Object.values(usersMap),
        chartData,
        stats: {
          totalRevenue: totalRevenue.toFixed(2),
          pendingCount: (pending || []).length,
          activePro,
          activePremium,
          totalUsers: (usersData?.users || []).length
        }
      });
    }

    // ═══════════ VERIFY ═══════════
    if (action === 'verify') {
      const { paymentId } = req.body || {};
      if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

      const { data: payment } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) return res.status(404).json({ error: 'الطلب غير موجود' });

      const result = await verifyTransaction(payment.tx_id, WALLET, Number(payment.amount_usd));

      await supabase
        .from('pending_payments')
        .update({ notes: `تحقق تلقائي: ${result.ok ? '✅ صحيح' : '❌ ' + result.error}` })
        .eq('id', paymentId);

      return res.json({ success: true, verification: result });
    }

    // ═══════════ CONFIRM ═══════════
    if (action === 'confirm') {
      const { paymentId, skipVerify } = req.body || {};
      if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

      const { data: payment } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (payment.status === 'confirmed') return res.status(400).json({ error: 'مؤكد مسبقاً' });

      // التحقق التلقائي (اختياري)
      if (!skipVerify) {
        const verification = await verifyTransaction(payment.tx_id, WALLET, Number(payment.amount_usd));
        if (!verification.ok) {
          return res.status(400).json({ 
            error: 'فشل التحقق التلقائي: ' + verification.error,
            verification,
            canSkip: true
          });
        }
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from('subscriptions').upsert({
        user_id: payment.user_id,
        plan: payment.plan,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'user_id' });

      await supabase.from('pending_payments').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      }).eq('id', paymentId);

      await supabase.from('admin_logs').insert({
        admin_id: adminUser.id,
        action: 'confirm_payment',
        target_user: payment.user_id,
        target_plan: payment.plan,
        details: { payment_id: paymentId, tx_id: payment.tx_id }
      }).then(() => {}).catch(() => {});

      return res.json({ success: true, message: `تم ترقية المستخدم إلى ${payment.plan}` });
    }

    // ═══════════ REJECT ═══════════
    if (action === 'reject') {
      const { paymentId, reason } = req.body || {};
      if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

      await supabase.from('pending_payments').update({
        status: 'rejected',
        notes: reason || 'تم الرفض',
        confirmed_at: new Date().toISOString()
      }).eq('id', paymentId);

      await supabase.from('admin_logs').insert({
        admin_id: adminUser.id,
        action: 'reject_payment',
        details: { payment_id: paymentId, reason }
      }).then(() => {}).catch(() => {});

      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'action غير معروف: ' + action });

  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═══ بناء بيانات الرسم البياني ═══
function buildChartData(confirmedPayments) {
  const days = 30;
  const labels = [];
  const data = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayTotal = confirmedPayments
      .filter(p => {
        const d = new Date(p.confirmed_at || p.created_at);
        return d >= day && d < nextDay;
      })
      .reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);

    labels.push(day.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
    data.push(dayTotal);
  }

  return { labels, data };
}