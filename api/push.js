// api/push.js — إرسال Web Push (يدعم device_id و user_id)
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID not configured' });
  }

  const { device_id, user_id, title, body, url, tag } = req.body || {};
  
  if ((!device_id && !user_id) || !title) {
    return res.status(400).json({ error: 'Missing fields: device_id/user_id and title required' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!SB_URL || !SB_SERVICE) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const supabase = createClient(SB_URL, SB_SERVICE);
    
    // 🔍 اجلب الاشتراكات
    let query = supabase.from('push_subscriptions').select('subscription, device_id, endpoint');
    
    if (user_id) {
      // للمستخدم: كل أجهزته
      query = query.eq('user_id', user_id);
    } else {
      // للجهاز: واحد فقط
      query = query.eq('device_id', device_id);
    }
    
    const { data: rows, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'DB query failed', details: error.message });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      url: url || '/',
      tag: tag || 'mishkat-' + Date.now()
    });

    let sent = 0;
    let failed = 0;
    const failedEndpoints = [];

    // 🚀 أرسل لكل اشتراك
    for (const row of rows) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (e) {
        failed++;
        failedEndpoints.push(row.endpoint);
        // إذا الاشتراك انتهى (410 Gone)، احذفه
        if (e.statusCode === 410 || e.statusCode === 404) {
          try {
            await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          } catch (delErr) {}
        }
      }
    }

    return res.status(200).json({ 
      sent, 
      failed, 
      total: rows.length,
      cleaned: failedEndpoints.length
    });

  } catch (e) {
    console.error('Push handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}