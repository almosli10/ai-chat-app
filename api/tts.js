// api/tts.js — Fish Audio + Google TTS Fallback
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { text, userId } = req.query;
  
  if (!text) return res.status(400).json({ error: 'text required' });

  const clean = String(text).substring(0, 200).trim();
  if (!clean) return res.status(400).json({ error: 'text empty' });

  // ═══════════════════════════════════════════
  // 1) حاول استخدام Fish Audio (صوت المستخدم)
  // ═══════════════════════════════════════════
  const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
  
  if (FISH_API_KEY && userId) {
    try {
      // اجلب voice_id الخاص بالمستخدم
      let voiceId = null;
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (SUPABASE_URL && SERVICE_KEY) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: profile } = await supabase
          .from('profiles')
          .select('voice_id')
          .eq('id', userId)
          .maybeSingle();
        
        if (profile?.voice_id) voiceId = profile.voice_id;
      }

      if (voiceId) {
        const body = {
          text: clean,
          format: 'mp3',
          mp3_bitrate: 128,
          latency: 'normal',
          reference_id: voiceId
        };

        const fishRes = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FISH_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (fishRes.ok) {
          const audioBuffer = Buffer.from(await fishRes.arrayBuffer());
          console.log('🎙️ Fish Audio: Success');
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.send(audioBuffer);
        } else {
          const errText = await fishRes.text();
          console.warn('⚠️ Fish Audio failed:', fishRes.status, errText.substring(0, 200));
          // سقط للـ fallback (Google)
        }
      }
    } catch (fishErr) {
      console.warn('⚠️ Fish Audio exception:', fishErr.message);
      // سقط للـ fallback (Google)
    }
  }

  // ═══════════════════════════════════════════
  // 2) Fallback: Google Translate TTS (مجاني، يعمل دائمًا)
  // ═══════════════════════════════════════════
  try {
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=ar&client=tw-ob&ttsspeed=0.9`;
    
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return res.status(response.status).json({ error: `TTS failed ${response.status}` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('🔊 Google TTS: Fallback used');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}