// api/tts.js — TTS بصوت المستخدم عبر Fish Audio
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { text, userId } = req.query;
  
  if (!text) return res.status(400).json({ error: 'text required' });

  const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
  if (!FISH_API_KEY) {
    return res.status(500).json({ error: 'FISH_AUDIO_API_KEY not configured' });
  }

  const clean = String(text).substring(0, 200).trim();
  if (!clean) return res.status(400).json({ error: 'text empty' });

  try {
    // 1) اجلب voice_id الخاص بالمستخدم (إن وُجد)
    let voiceId = null;
    if (userId) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (SUPABASE_URL && SERVICE_KEY) {
        try {
          const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
          const { data: profile } = await supabase
            .from('profiles')
            .select('voice_id')
            .eq('id', userId)
            .maybeSingle();
          
          if (profile?.voice_id) {
            voiceId = profile.voice_id;
            console.log('🎙️ Using custom voice:', voiceId);
          }
        } catch (dbErr) {
          console.warn('Could not fetch voice_id:', dbErr.message);
        }
      }
    }

    // 2) ابني جسم الطلب لـ Fish Audio
    const body = {
      text: clean,
      format: 'mp3',
      mp3_bitrate: 128,
      latency: 'normal',
    };
    
    // إذا عند المستخدم صوت مخصص، استخدمه
    if (voiceId) {
      body.reference_id = voiceId;
    } else {
      // صوت افتراضي (صوت أنثوي عربي من Fish)
      body.reference_id = 'default-ar-female';
    }

    // 3) أرسل الطلب إلى Fish Audio
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Fish TTS error:', response.status, errText);
      return res.status(response.status).json({ 
        error: `Fish TTS ${response.status}`,
        details: errText.substring(0, 300)
      });
    }

    // 4) أرجع ملف الصوت
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audioBuffer);

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}