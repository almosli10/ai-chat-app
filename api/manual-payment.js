// api/manual-payment.js — طلب دفع يدوي (USDT TRC20)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const WALLET_ADDRESS = 'TNatT4u4utHqv8qBUNjWNG4NrJpuk222T'; // ← محفظتك

const PRICES = {
  pro: 5,
  premium: 15
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // عرض عناوين الباقات المتاحة
    return res.json({
      wallet: WALLET_ADDRESS,
      network: 'TRC20',
      prices: PRICES
    });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { plan, userId, txId, email } = req.body;

  if (!plan || !userId || !txId) {
    return res.status(400).json({ error: 'plan, userId, txId مطلوبة' });
  }

  if (!PRICES[plan]) {
    return res.status(400).json({ error: 'باقة غير صحيحة' });
  }

  try {
    const orderId = `manual_${userId}_${plan}_${Date.now()}`;

    const { error } = await supabase.from('pending_payments').insert({
      user_id: userId,
      plan: plan,
      amount_usd: PRICES[plan],
      tx_id: txId.trim(),
      wallet_address: WALLET_ADDRESS,
      email: email || '',
      order_id: orderId,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    return res.json({
      success: true,
      order_id: orderId,
      message: 'تم استلام طلبك. سيتم التحقق خلال 24 ساعة.'
    });
  } catch (error) {
    console.error('Manual payment error:', error);
    return res.status(500).json({ error: error.message });
  }
}