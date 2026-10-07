module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured', hint: 'أضف OPENROUTER_API_KEY في Vercel' });
    }

    const { messages, stream = true, model = 'deepseek/deepseek-r1:free' } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'HTTP-Referer': 'https://ai-chat-app-two-lime.vercel.app',
        'X-Title': 'AI Chat App'
      },
      body: JSON.stringify({ model, messages, stream })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'OpenRouter API error', 
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
    console.error('OpenRouter proxy error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};