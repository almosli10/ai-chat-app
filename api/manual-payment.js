// api/manual-payment.js — طلب دفع يدوي (USDT TRC20)
import { sendAdminEmail, buildNewPaymentEmail } from '../lib/send-email.js';
import { createClient } from '@supabase/supabase-js';

const WALLET_ADDRESS = 'TNatT4u4utHqv8qBUNjWNG4NrJpuk222T';

const PRICES = {
  pro: 5,
  premium: 15
};

export default async function handler(req, res) {
  // ردّ دائماً بـ JSON حتى في حالة الأخطاء
  res.setHeader('Content-Type', 'application/json');

  try {
    // فحص المتغيرات البيئية
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('Missing env vars:', {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_KEY
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing Supabase credentials in Vercel env'
      });
    }

    // إنشاء العميل داخل handler (lazy)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ==================== GET ====================
    if (req.method === 'GET') {
      return res.status(200).json({
        wallet: WALLET_ADDRESS,
        network: 'TRC20',
        prices: PRICES
      });
    }

    // ==================== POST ====================
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { plan, userId, txId, email } = req.body || {};

    if (!plan || !userId || !txId) {
      return res.status(400).json({ error: 'plan, userId, txId مطلوبة' });
    }

    if (!PRICES[plan]) {
      return res.status(400).json({ error: 'باقة غير صحيحة' });
    }

    if (txId.trim().length < 10) {
      return res.status(400).json({ error: 'TX ID غير صالح (طويل جداً أو قصير)' });
    }

    const orderId = `manual_${userId}_${plan}_${Date.now()}`;

    const { error: dbError } = await supabase.from('pending_payments').insert({
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

    if (dbError) {
      console.error('DB insert error:', dbError);
      return res.status(500).json({ 
        error: 'Database error',
        details: dbError.message 
      });
    }

    // ✅ إرسال إشعار بالبريد بعد نجاح الحفظ (في الخلفية، بدون انتظار)
    const emailTemplate = buildNewPaymentEmail({
      plan,
      amount: PRICES[plan],
      email: email || 'غير معروف',
      txId: txId.trim(),
      orderId
    });
    sendAdminEmail(emailTemplate).catch(e => console.warn('Email failed:', e));

    return res.status(200).json({
      success: true,
      order_id: orderId,
      message: 'تم استلام طلبك. سيتم التحقق خلال 24 ساعة.'
    });

  } catch (error) {
    console.error('Manual payment fatal error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}