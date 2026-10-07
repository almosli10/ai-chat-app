// Vercel Serverless Function — إرسال Web Push
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: 'VAPID not configured' });

  const { device_id, title, body, url } = req.body || {};
  if (!device_id || !title) return res.status(400).json({ error: 'Missing fields' });

  // جلب الاشتراكات من Supabase
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?device_id=eq.${encodeURIComponent(device_id)}&select=subscription`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(200).json({ sent: 0 });

    const payload = JSON.stringify({ title, body, url: url || '/' });
    let sent = 0, failed = 0;
    for (const row of rows) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (e) { failed++; }
    }
    return res.status(200).json({ sent, failed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}