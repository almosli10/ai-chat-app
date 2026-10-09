// api/tts.js — Google Translate TTS (مجرّب، مجاني، صوت عربي طبيعي)
export default async function handler(req, res) {
  const { text, rate } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const clean = text.substring(0, 200);
  const speed = rate || '0.9';
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=ar&client=tw-ob&ttsspeed=${speed}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': '*/*'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Google TTS ${response.status}` });
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}