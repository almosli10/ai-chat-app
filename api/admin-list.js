// api/admin-list.js — جلب بيانات لوحة التحكم
import { verifyAdmin } from './admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const { supabase } = auth;

  try {
    // 1) الطلبات المعلقة
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingErr) throw pendingErr;

    // 2) كل الاشتراكات مع بيانات المستخدم
    const { data: subscriptions, error: subErr } = await supabase
      .from('subscriptions')
      .select('*')
      .order('started_at', { ascending: false });

    if (subErr) throw subErr;

    // 3) بيانات المستخدمين من auth.users (عبر Admin API)
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({
      perPage: 100
    });

    if (usersErr) throw usersErr;

    // دمج البيانات
    const usersMap = {};
    (usersData?.users || []).forEach(u => {
      usersMap[u.id] = {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at
      };
    });

    // 4) الطلبات المؤكدة (للإحصائيات)
    const { data: confirmed, error: confErr } = await supabase
      .from('pending_payments')
      .select('amount_usd, created_at')
      .eq('status', 'confirmed');

    if (confErr) throw confErr;

    // حساب الإحصائيات
    const totalRevenue = (confirmed || []).reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0);
    const activePro = (subscriptions || []).filter(s => s.plan === 'pro' && s.status === 'active').length;
    const activePremium = (subscriptions || []).filter(s => s.plan === 'premium' && s.status === 'active').length;

    // دمج الطلبات المعلقة مع بيانات المستخدم
    const enrichedPending = (pending || []).map(p => ({
      ...p,
      user_email: usersMap[p.user_id]?.email || p.email || 'غير معروف'
    }));

    // دمج الاشتراكات مع بيانات المستخدم
    const enrichedSubs = (subscriptions || []).map(s => ({
      ...s,
      user_email: usersMap[s.user_id]?.email || 'غير معروف'
    }));

    return res.json({
      success: true,
      pending: enrichedPending,
      subscriptions: enrichedSubs,
      users: Object.values(usersMap),
      stats: {
        totalRevenue: totalRevenue.toFixed(2),
        pendingCount: (pending || []).length,
        activePro,
        activePremium,
        totalUsers: (usersData?.users || []).length
      }
    });

  } catch (error) {
    console.error('Admin list error:', error);
    return res.status(500).json({ error: error.message });
  }
}