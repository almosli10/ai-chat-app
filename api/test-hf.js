// api/test-hf.js — ملف اختبار مؤقت للتأكد من عمل HF_TOKEN
export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;
  
  if (!HF_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'HF_TOKEN not found',
      hint: 'تأكد من إضافته في Vercel Environment Variables'
    });
  }

  try {
    // 1) تحقق من هوية المفتاح
    const whoamiRes = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` }
    });
    const whoami = await whoamiRes.json();

    // 2) اختبر Inference API بنموذج بسيط
    const inferRes = await fetch(
      'https://api-inference.huggingface.co/models/gpt2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'Hello' })
      }
    );
    const inferText = await inferRes.text();

    return res.status(200).json({
      ok: true,
      tokenValid: whoamiRes.ok,
      userName: whoami.name || null,
      tokenRole: whoami.auth?.accessToken?.role || null,
      inferenceStatus: inferRes.status,
      inferenceResponse: inferText.substring(0, 300),
      message: 'إذا رأيت tokenValid: true فهذا يعني أن المفتاح يعمل ✅'
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}