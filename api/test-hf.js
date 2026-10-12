// api/test-hf.js — اختبار النطاق الجديد مع نموذج TTS عربي
export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;

  if (!HF_TOKEN) {
    return res.status(500).json({ ok: false, error: 'HF_TOKEN not found' });
  }

  const result = { tests: {} };

  // ═══ Test 1: النطاق الجديد مع نموذج TTS عربي ═══
  try {
    const r = await fetch(
      'https://router.huggingface.co/hf-inference/models/facebook/mms-tts-ara',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'مرحباً، هذا اختبار للصوت العربي.' }),
        signal: AbortSignal.timeout(30000)
      }
    );
    const contentType = r.headers.get('content-type') || '';
    if (r.ok && contentType.includes('audio')) {
      const buf = await r.arrayBuffer();
      result.tests.mms_tts_ara = {
        ok: true,
        status: r.status,
        contentType,
        audioSize: buf.byteLength,
        message: '✅ نجح! هذا النموذج يعمل'
      };
    } else {
      const text = await r.text();
      result.tests.mms_tts_ara = {
        ok: false,
        status: r.status,
        contentType,
        bodyPreview: text.substring(0, 300)
      };
    }
  } catch (e) {
    result.tests.mms_tts_ara = { ok: false, error: e.message };
  }

  // ═══ Test 2: نموذج XTTS-v2 عبر النطاق الجديد ═══
  try {
    const r = await fetch(
      'https://router.huggingface.co/hf-inference/models/coqui/XTTS-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: 'مرحباً',
          parameters: { language: 'ar' }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );
    const contentType = r.headers.get('content-type') || '';
    if (r.ok && contentType.includes('audio')) {
      const buf = await r.arrayBuffer();
      result.tests.xtts_v2 = {
        ok: true,
        status: r.status,
        audioSize: buf.byteLength,
        message: '✅ XTTS-v2 يعمل'
      };
    } else {
      const text = await r.text();
      result.tests.xtts_v2 = {
        ok: false,
        status: r.status,
        bodyPreview: text.substring(0, 300)
      };
    }
  } catch (e) {
    result.tests.xtts_v2 = { ok: false, error: e.message };
  }

  result.summary = {
    mms_tts_ara: result.tests.mms_tts_ara?.ok ? '✅' : '❌',
    xtts_v2: result.tests.xtts_v2?.ok ? '✅' : '❌',
  };

  return res.status(200).json(result);
}