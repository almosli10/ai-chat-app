// api/chat.js — مع معالجة أفضل للأخطاء وتقصير المحادثة
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const API_KEY = process.env.NOTRACK_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const { messages, stream = true } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // ═══ ✂️ تقصير المحادثة: احتفظ بـ system + آخر 20 رسالة فقط ═══
    const MAX_HISTORY = 20;
    let trimmedMessages = messages;

    if (messages.length > MAX_HISTORY + 1) {
      const systemMsgs = messages.filter(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');
      const recentMsgs = nonSystemMsgs.slice(-MAX_HISTORY);
      trimmedMessages = [...systemMsgs, ...recentMsgs];
      console.log(`✂️ Trimmed: ${messages.length} → ${trimmedMessages.length} messages`);
    }

    // ═══ 📏 قصّ الرسائل الفردية الطويلة جداً (أكثر من 8000 حرف) ═══
    const MAX_MSG_CHARS = 8000;
    trimmedMessages = trimmedMessages.map(m => {
      if (typeof m.content === 'string' && m.content.length > MAX_MSG_CHARS) {
        return { ...m, content: m.content.substring(0, MAX_MSG_CHARS) + '\n\n[...تم اختصار الرسالة الطويلة...]' };
      }
      return m;
    });

    // ═══ إرسال الطلب إلى Notrack ═══
    const response = await fetch('https://api.notrack.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
  model: 'notrack-uncensored',
  messages: trimmedMessages,
  stream: stream,
  max_tokens: 4096
})
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Notrack error:', response.status, errorText);

      // استخرج تفاصيل الخطأ إن كان JSON
      let errorDetail = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorDetail = parsed.error?.message || parsed.message || parsed.detail || errorText;
      } catch (e) {}

      return res.status(response.status).json({
        error: 'Notrack API error',
        status: response.status,
        details: errorDetail.substring(0, 500),
        hint: response.status === 400
          ? 'قد تكون المحادثة طويلة جداً، أو الرسالة تحتوي على محتوى مرفوض.'
          : null
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
        message: error.message
      });
    }
  }
}