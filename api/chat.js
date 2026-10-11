// Vercel Serverless Function - Backend Proxy (CommonJS)
// يحتفظ بمفتاح API في السيرفر ولا يكشفه للمتصفح

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ محليًا: يستخدم المفتاح مباشرة | عند النشر: يستخدم Environment Variable
    const API_KEY = process.env.NOTRACK_API_KEY;

    // ✅ تشخيص: أرجع تفاصيل واضحة إذا كان المفتاح مفقودًا
    if (!API_KEY) {
      return res.status(500).json({
        error: 'API key not configured',
        hint: 'تأكد من وجود .env.local مع NOTRACK_API_KEY',
        envKeys: Object.keys(process.env).filter(k => k.includes('NOTRACK') || k.includes('API'))
      });
    }

    const { messages, stream = true } = req.body;

    const response = await fetch('https://api.notrack.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: 'notrack-uncensored',
        messages: messages,
        stream: stream
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Notrack API error',
        status: response.status,
        details: errorText.substring(0, 500)
      });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const data = await response.json();
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy exception',
        message: error.message,
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : null
      });
    }
  }
};