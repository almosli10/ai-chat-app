// api/admin-confirm.js — تأكيد دفع وترقية المستخدم
import { verifyAdmin } from '../lib/admin-auth.js';

const PRICES = { pro: 30, premium: 30 }; // مدة الاشتراك بالأيام

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const { supabase, user: adminUser } = auth;

  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

  try {
    // جلب الطلب
    const { data: payment, error: fetchErr } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !payment) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (payment.status === 'confirmed') {
      return res.status(400).json({ error: 'الطلب مؤكد مسبقاً' });
    }

    // حساب تاريخ الانتهاء
    const durationDays = PRICES[payment.plan] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // 1) ترقية الباقة
    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: payment.user_id,
        plan: payment.plan,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'user_id' });

    if (subErr) throw subErr;

    // 2) تحديث حالة الطلب
    const { error: updErr } = await supabase
      .from('pending_payments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        notes: `تم التأكيد بواسطة المشرف`
      })
      .eq('id', paymentId);

    if (updErr) throw updErr;

    // 3) تسجيل الحدث
    await supabase.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'confirm_payment',
      target_user: payment.user_id,
      target_plan: payment.plan,
      details: { payment_id: paymentId, tx_id: payment.tx_id, amount: payment.amount_usd }
    }).then(() => {}).catch(() => {});

    return res.json({
      success: true,
      message: `تم ترقية المستخدم إلى ${payment.plan}`,
      user_id: payment.user_id
    });

  } catch (error) {
    console.error('Admin confirm error:', error);
    return res.status(500).json({ error: error.message });
  }
}