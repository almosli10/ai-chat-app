// api/test-hf.js — نسخة تشخيصية مفصّلة
export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;
  
  const result = {
    timestamp: new Date().toISOString(),
    tokenExists: !!HF_TOKEN,
    tokenPrefix: HF_TOKEN ? HF_TOKEN.substring(0, 8) + '...' : null,
    tokenLength: HF_TOKEN ? HF_TOKEN.length : 0,
    tests: {}
  };

  if (!HF_TOKEN) {
    return res.status(500).json({
      ...result,
      ok: false,
      error: 'HF_TOKEN not found in env'
    });
  }

  // ═══ Test 1: الاتصال بـ huggingface.co بشكل عام ═══
  try {
    const r = await fetch('https://huggingface.co/', { 
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    });
    result.tests.connectivity = { ok: true, status: r.status };
  } catch (e) {
    result.tests.connectivity = { 
      ok: false, 
      error: e.message,
      cause: e.cause ? String(e.cause) : null,
      code: e.cause?.code || e.code || null
    };
  }

  // ═══ Test 2: whoami-v2 ═══
  try {
    const r = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
      signal: AbortSignal.timeout(8000)
    });
    const text = await r.text();
    result.tests.whoami = {
      ok: r.ok,
      status: r.status,
      bodyPreview: text.substring(0, 200)
    };
  } catch (e) {
    result.tests.whoami = { 
      ok: false, 
      error: e.message,
      cause: e.cause ? String(e.cause) : null,
      code: e.cause?.code || e.code || null
    };
  }

  // ═══ Test 3: Inference API (نموذج بسيط) ═══
  try {
    const r = await fetch(
      'https://api-inference.huggingface.co/models/gpt2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'Hello' }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const text = await r.text();
    result.tests.inference = {
      ok: r.ok,
      status: r.status,
      bodyPreview: text.substring(0, 200)
    };
  } catch (e) {
    result.tests.inference = { 
      ok: false, 
      error: e.message,
      cause: e.cause ? String(e.cause) : null,
      code: e.cause?.code || e.code || null
    };
  }

  // ═══ Test 4: Router API الجديد (قد يكون الأنسب) ═══
  try {
    const r = await fetch(
      'https://router.huggingface.co/hf-inference/models/gpt2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'Hello' }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const text = await r.text();
    result.tests.router = {
      ok: r.ok,
      status: r.status,
      bodyPreview: text.substring(0, 200)
    };
  } catch (e) {
    result.tests.router = { 
      ok: false, 
      error: e.message,
      cause: e.cause ? String(e.cause) : null,
      code: e.cause?.code || e.code || null
    };
  }

  // ═══ الخلاصة ═══
  result.ok = result.tests.whoami?.ok || false;
  result.summary = {
    connectivity: result.tests.connectivity?.ok ? '✅' : '❌',
    whoami: result.tests.whoami?.ok ? '✅' : '❌',
    inference: result.tests.inference?.ok ? '✅' : '❌',
    router: result.tests.router?.ok ? '✅' : '❌',
  };

  return res.status(200).json(result);
}