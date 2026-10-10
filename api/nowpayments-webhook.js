// api/nowpayments-webhook.js — استقبال إشعارات الدفع من NOWPayments
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // التحقق من التوقيع
    const signature = req.headers['x-nowpayments-sig'];
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (signature && ipnSecret) {
      const sortedBody = JSON.stringify(sortObject(req.body));
      const hmac = crypto.createHmac('sha512', ipnSecret);
      hmac.update(sortedBody);
      const expectedSig = hmac.digest('hex');

      if (signature !== expectedSig) {
        console.warn('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { payment_status, order_id, price_amount, pay_amount } = req.body;
    console.log('📩 Webhook:', { payment_status, order_id });

    // نعالج فقط الدفعات المكتملة
    if (payment_status !== 'finished' && payment_status !== 'confirmed') {
      return res.json({ ok: true, status: 'ignored' });
    }

    // استخراج userId و plan من order_id
    // order_id = userId_plan_timestamp
    const parts = (order_id || '').split('_');
    if (parts.length < 3) {
      console.error('Invalid order_id:', order_id);
      return res.status(400).json({ error: 'Invalid order_id' });
    }

    const userId = parts[0];
    const plan = parts[1];

    // التحقق من الباقة
    if (!['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // حساب تاريخ الانتهاء (30 يوم من الآن)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // تحديث أو إنشاء الاشتراك
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan: plan,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return res.status(500).json({ error: 'Database error' });
    }

    // تسجيل الدفعة في جدول منفصل (اختياري)
    await supabase.from('payments').insert({
      user_id: userId,
      plan: plan,
      amount_usd: price_amount,
      amount_usdt: pay_amount,
      order_id: order_id,
      status: 'completed',
      created_at: new Date().toISOString()
    }).then(() => {}).catch(() => {});

    console.log(`✅ Payment successful for user ${userId}, plan: ${plan}`);
    return res.json({ ok: true, plan, userId });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ترتيب المفاتيح أبجدياً (مطلوب من NOWPayments)
function sortObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObject(obj[key]);
    return sorted;
  }, {});
}