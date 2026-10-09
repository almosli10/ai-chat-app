// api/image.js — توليد الصور عبر Hugging Face (مجاني)
export default async function handler(req, res) {
  const { prompt } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) return res.status(500).json({ error: 'HF_TOKEN missing in Vercel env' });

  // نستخدم موديل FLUX.1-schnell (سريع ومجاني)
  const model = 'black-forest-labs/FLUX.1-schnell';
  const url = `https://api-inference.huggingface.co/models/${model}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true' // انتظر تحميل الموديل إذا كان بارداً
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 1024,
          height: 1024,
          num_inference_steps: 4 // FLUX schnell يحتاج خطوات قليلة
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('HF error:', response.status, errText);
      return res.status(response.status).json({ 
        error: `HuggingFace error ${response.status}: ${errText.substring(0, 200)}` 
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
}