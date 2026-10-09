// api/edge-tts.js — StreamElements TTS (صوت عربي طبيعي، مجاني)
export default async function handler(req, res) {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });

  const clean = text.substring(0, 500);
  
  // جرب Zeina (Amazon Polly Arabic) أولاً
  const voices = ['Zeina', 'Hala'];
  
  for (const voice of voices) {
    try {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(clean)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
        }
      });
      
      if (!response.ok) {
        console.log(`Voice ${voice} failed: ${response.status}`);
        continue;
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100) continue;
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    } catch (err) {
      console.log(`Voice ${voice} error:`, err.message);
    }
  }
  
  res.status(500).json({ error: 'All TTS voices failed' });
}