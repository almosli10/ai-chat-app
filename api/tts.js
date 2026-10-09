// api/tts.js — وسيط لخدمة StreamElements TTS (صوت عربي طبيعي)
export default async function handler(req, res) {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });
  
  const voice = 'ar-XA-Standard-A'; // صوت عربي أنثوي طبيعي
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TTS HTTP ' + response.status);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}