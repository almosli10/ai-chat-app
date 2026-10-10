// api/nowpayments-create.js — إنشاء فاتورة دفع عبر NOWPayments
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, userId, email } = req.body;
  if (!plan || !userId) {
    return res.status(400).json({ error: 'plan and userId required' });
  }

  // أسعار الباقات بالدولار
  const PRICES = {
    pro: 5,
    premium: 15
  };

  const price = PRICES[plan];
  if (!price) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: price,
        price_currency: 'usd',
        pay_currency: 'usdttrc20',
        order_id: `${userId}_${plan}_${Date.now()}`,
        order_description: `Mishkat ${plan} subscription - 1 month`,
        ipn_callback_url: `${process.env.APP_URL}/api/nowpayments-webhook`,
        success_url: `${process.env.APP_URL}/?payment=success&plan=${plan}`,
        cancel_url: `${process.env.APP_URL}/?payment=cancelled`,
        customer_email: email
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('NOWPayments error:', data);
      return res.status(response.status).json({ error: data.message || 'Payment creation failed' });
    }

    return res.json({
      invoice_url: data.invoice_url,
      invoice_id: data.id
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ error: error.message });
  }
}