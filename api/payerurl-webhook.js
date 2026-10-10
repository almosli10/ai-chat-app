// api/payerurl-webhook.js — استقبال إشعارات الدفع من Payerurl
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const signature = req.headers['x-payerurl-signature'];
    const secret = process.env.PAYERURL_SECRET_KEY;

    // التحقق من التوقيع (إذا كانت الخدمة تدعمه)
    if (signature && secret) {
      const hmac = crypto.createHmac('sha512', secret);
      hmac.update(JSON.stringify(req.body));
      const expected = hmac.digest('hex');
      if (signature !== expected) {
        console.warn('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { status, invoice_id } = req.body;
    console.log('📩 Webhook received:', { status, invoice_id });

    // نعالج فقط الدفعات المكتملة
    if (status !== 'completed' && status !== 'success') {
      return res.json({ ok: true, status: 'ignored' });
    }

    // استخراج userId و plan من invoice_id
    const parts = (invoice_id || '').split('_');
    if (parts.length < 3) {
      console.error('Invalid invoice_id:', invoice_id);
      return res.status(400).json({ error: 'Invalid invoice_id' });
    }

    const userId = parts[0];
    const plan = parts[1];

    if (!['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // حساب تاريخ الانتهاء (30 يوم)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // تحديث الاشتراك
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

    console.log(`✅ Payment successful for user ${userId}, plan: ${plan}`);
    return res.json({ ok: true, plan, userId });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}