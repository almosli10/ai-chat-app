// api/admin-verify.js — التحقق التلقائي من TX ID
import { verifyAdmin } from '../lib/admin-auth.js';
import { verifyTransaction } from '../lib/tron-verify.js';

const WALLET = 'TNatT4u4utHqv8qBUNjWNG4NrJpuk222T';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const { supabase } = auth;
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

  try {
    // جلب الطلب
    const { data: payment, error } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // التحقق من البلوكتشين
    const result = await verifyTransaction(
      payment.tx_id,
      WALLET,
      Number(payment.amount_usd)
    );

    // سجّل نتيجة التحقق في notes
    await supabase
      .from('pending_payments')
      .update({ notes: `تحقق تلقائي: ${result.ok ? '✅ صحيح' : '❌ ' + result.error}` })
      .eq('id', paymentId);

    return res.json({
      success: true,
      verification: result
    });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
}