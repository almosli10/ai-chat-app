// api/admin-reject.js — رفض طلب دفع
import { verifyAdmin } from './admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const { supabase, user: adminUser } = auth;
  const { paymentId, reason } = req.body || {};

  if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

  try {
    const { error: updErr } = await supabase
      .from('pending_payments')
      .update({
        status: 'rejected',
        notes: reason || 'تم الرفض',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updErr) throw updErr;

    await supabase.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'reject_payment',
      details: { payment_id: paymentId, reason }
    }).then(() => {}).catch(() => {});

    return res.json({ success: true });

  } catch (error) {
    console.error('Admin reject error:', error);
    return res.status(500).json({ error: error.message });
  }
}