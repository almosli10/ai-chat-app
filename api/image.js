// api/image.js — وسيط ذكي لجلب الصور من Pollinations
export default async function handler(req, res) {
  const { prompt } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const models = ['flux', 'turbo'];
  const maxRetries = 3;

  for (const model of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=${model}&seed=${Date.now()}`;
        
        const response = await fetch(imgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buffer);
        }
        
        console.log(`[image] Model ${model} attempt ${i + 1} failed: ${response.status}`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // تأخير متصاعد
      } catch (err) {
        console.log(`[image] Model ${model} attempt ${i + 1} error:`, err.message);
      }
    }
  }

  res.status(500).json({ error: 'Pollinations unavailable after all retries' });
}