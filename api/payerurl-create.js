// api/payerurl-create.js — إنشاء فاتورة عبر Payerurl
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

  const orderId = `${userId}_${plan}_${Date.now()}`;

  try {
    const response = await fetch('https://api.payerurl.com/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Key': process.env.PAYERURL_PUBLIC_KEY,
        'X-Secret-Key': process.env.PAYERURL_SECRET_KEY
      },
      body: JSON.stringify({
        invoice_id: orderId,
        amount: price,
        currency: 'USD',
        items: [
          {
            name: `Mishkat ${plan} subscription`,
            qty: '1',
            price: price.toString()
          }
        ],
        data: {
          first_name: 'Mishkat',
          last_name: 'User',
          email: email || 'user@mishkat.app'
        },
        redirect_url: `${process.env.APP_URL}/?payment=success&plan=${plan}`,
        cancel_url: `${process.env.APP_URL}/?payment=cancelled`,
        notify_url: `${process.env.APP_URL}/api/payerurl-webhook`
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Payerurl error:', data);
      return res.status(response.status).json({ error: data.message || 'Payment creation failed' });
    }

    return res.json({
      invoice_url: data.payment_url,
      invoice_id: data.invoice_id
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ error: error.message });
  }
}