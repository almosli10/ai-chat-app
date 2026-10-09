// api/image.js — توليد الصور عبر Cloudflare Workers AI
export default async function handler(req, res) {
  const { prompt } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const API_TOKEN = process.env.CF_API_TOKEN;

  if (!ACCOUNT_ID || !API_TOKEN) {
    return res.status(500).json({ error: 'Cloudflare keys missing in Vercel env' });
  }

  const model = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        steps: 4
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Cloudflare error:', response.status, errText);
      return res.status(response.status).json({ 
        error: `Cloudflare error ${response.status}: ${errText.substring(0, 200)}` 
      });
    }

    const data = await response.json();
    
    if (!data.result || !data.result.image) {
      return res.status(500).json({ error: 'No image in Cloudflare response', details: data });
    }

    const buffer = Buffer.from(data.result.image, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
}