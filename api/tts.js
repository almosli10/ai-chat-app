// api/tts.js — وسيط لـ Google Translate TTS
export default async function handler(req, res) {
  const { text, lang } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const targetLang = lang || 'ar';
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${targetLang}&client=tw-ob&ttsspeed=0.9`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    });
    
    if (!response.ok) throw new Error('TTS HTTP ' + response.status);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('TTS proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}