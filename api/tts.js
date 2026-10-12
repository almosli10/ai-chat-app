// api/tts.js — Edge TTS (مجاني) + Google TTS fallback
export default async function handler(req, res) {
  const { text } = req.query;

  if (!text) return res.status(400).json({ error: 'text required' });

  const clean = String(text).substring(0, 500).trim();
  if (!clean) return res.status(400).json({ error: 'text empty' });

  // ═══ 1) Edge TTS (Microsoft) — مجاني وجودة عالية ═══
  try {
    const hfSpaceUrl = `https://innoai-edge-tts.hf.space/api/tts?text=${encodeURIComponent(clean)}&voice=ar-EG-SalmaNeural`;
    const response = await fetch(hfSpaceUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(25000)
    });

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      console.log('🎙️ Edge TTS: Success');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    }
    console.warn('⚠️ Edge TTS failed:', response.status);
  } catch (e) {
    console.warn('⚠️ Edge TTS exception:', e.message);
  }

  // ═══ 2) Fallback: Google Translate TTS ═══
  try {
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=ar&client=tw-ob&ttsspeed=0.9`;
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      }
    });

    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return res.status(response.status).json({ error: `TTS failed ${response.status}` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('🔊 Google TTS: Fallback used');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}