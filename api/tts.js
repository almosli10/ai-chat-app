// api/tts.js — وسيط Google Translate TTS (صوت عربي طبيعي، مجاني)
export default async function handler(req, res) {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const clean = text.substring(0, 200);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=ar&client=tw-ob&ttsspeed=0.9`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': '*/*'
      }
    });
    
    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return res.status(response.status).json({ error: `Google TTS ${response.status}` });
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}