// api/clone-voice.js — استنساخ الصوت عبر Fish Audio
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // نحتاج raw body للـ multipart
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
  if (!FISH_API_KEY) {
    return res.status(500).json({ error: 'FISH_AUDIO_API_KEY not configured in Vercel' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase config missing' });
  }

  try {
    // 1) اقرأ النص والـ user_id من query
    const { userId, audioUrl } = req.query;
    
    if (!userId || !audioUrl) {
      return res.status(400).json({ error: 'userId and audioUrl are required' });
    }

    // 2) اجلب ملف الصوت من Supabase Storage
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return res.status(400).json({ error: 'Failed to fetch audio from storage' });
    }
    const audioBuffer = await audioRes.arrayBuffer();
    
    if (audioBuffer.byteLength < 10000) {
      return res.status(400).json({ error: 'الصوت قصير جدًا. سجل على الأقل 10 ثواني.' });
    }

    // 3) أرسل الطلب إلى Fish Audio لإنشاء النموذج
    const formData = new FormData();
    formData.append('type', 'tts');
    formData.append('title', `Mishkat Voice - ${userId.substring(0, 8)}`);
    formData.append('train_mode', 'fast');
    formData.append('visibility', 'private');
    
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('voices', blob, 'sample.wav');

    const fishRes = await fetch('https://api.fish.audio/model', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
      },
      body: formData,
    });

    const fishData = await fishRes.json();
    
    if (!fishRes.ok) {
      console.error('Fish Audio error:', fishData);
      return res.status(fishRes.status).json({ 
        error: 'Fish Audio: ' + (fishData.message || fishData.error || 'Unknown error'),
        details: fishData
      });
    }

    const voiceId = fishData._id || fishData.id;
    if (!voiceId) {
      return res.status(500).json({ error: 'No voice_id in Fish Audio response', details: fishData });
    }

    // 4) احفظ voice_id في profiles
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ voice_id: voiceId })
      .eq('id', userId);

    if (dbError) {
      console.error('DB update error:', dbError);
      return res.status(500).json({ error: 'DB update failed: ' + dbError.message });
    }

    return res.status(200).json({
      success: true,
      voice_id: voiceId,
      state: fishData.state || 'training',
      message: 'تم إنشاء صوتك! قد يستغرق التدريب دقائق قليلة.'
    });

  } catch (error) {
    console.error('Clone voice error:', error);
    return res.status(500).json({ error: error.message });
  }
}