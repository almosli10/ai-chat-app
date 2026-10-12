// api/tts-free.js — توليد الصوت العربي مجاناً عبر Microsoft Edge TTS
export default async function handler(req, res) {
  const { text, voice = 'ar-EG-SalmaNeural' } = req.query;

  if (!text) return res.status(400).json({ error: 'text required' });

  const clean = String(text).substring(0, 500).trim();
  if (!clean) return res.status(400).json({ error: 'text empty' });

  try {
    const hfSpaceUrl = `https://innoai-edge-tts.hf.space/api/tts?text=${encodeURIComponent(clean)}&voice=${voice}`;

    const response = await fetch(hfSpaceUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      console.warn('Edge TTS Space failed:', response.status);
      return await fallbackGoogleTTS(clean, res);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);

  } catch (error) {
    console.error('TTS error:', error);
    return await fallbackGoogleTTS(clean, res);
  }
}

async function fallbackGoogleTTS(text, res) {
  try {
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ar&client=tw-ob&ttsspeed=0.9`;
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `TTS failed ${response.status}` });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}