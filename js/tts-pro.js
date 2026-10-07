// ═══════════════════════════════════════════════════════
// TTS PRO — قراءة ذكية بنبرات متعددة لكل جملة
// ═══════════════════════════════════════════════════════
(function ttsPro() {
  'use strict';

  let voices = [];
  function loadVoices() {
    voices = window.speechSynthesis.getVoices() || [];
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickArabicVoice() {
    const pref = ['ar-SA', 'ar-EG', 'ar'];
    for (const lang of pref) {
      const v = voices.find(x => x.lang.startsWith(lang));
      if (v) return v;
    }
    return voices[0] || null;
  }

  // تصنيف كل جملة حسب المحتوى
  function classifySegment(text) {
    const t = text.trim();
    let rate = 1.0, pitch = 1.0, volume = 1.0;

    // أسئلة → نبرة أعلى
    if (/[؟?]\s*$/.test(t)) { pitch += 0.12; rate -= 0.03; }
    // تعجب → سريع وأعلى
    else if (/[!]/.test(t)) { pitch += 0.15; rate += 0.05; }
    // اقتباس → أبطأ وأهدأ
    else if (/^["«]/.test(t) || /^>/.test(t)) { rate -= 0.08; pitch -= 0.03; }
    // تحذير
    else if (/تحذير|احذر|خطر|مهم جداً|ملاحظة/ .test(t)) { rate -= 0.08; pitch -= 0.05; }
    // قوائم (نقاط)
    else if (/^[\-\*•]\s/.test(t)) { rate -= 0.05; }

    // طول الجملة → تعبير
    if (t.length > 100) rate += 0.03;
    if (t.length < 20) rate -= 0.03;

    return { rate: clamp(rate, 0.75, 1.3), pitch: clamp(pitch, 0.8, 1.3), volume };
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // تنظيف النص العربي من markdown
  function cleanForTTS(text) {
    return text
      .replace(/```[\s\S]*?```/g, ' (كود) ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_~#>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // تقسيم النص إلى جمل
  function splitSentences(text) {
    return text
      .split(/(?<=[.!؟?])\s+|(?<=[،,])\s+(?=[أ-يA-Z])/g)
      .map(s => s.trim())
      .filter(s => s.length > 2);
  }

  let currentUtterance = null;
  let stopFlag = false;

  function speakPro(text, btn) {
    if (!('speechSynthesis' in window)) { if (typeof toast === 'function') toast('⚠️ TTS غير مدعوم'); return; }
    if (window.speechSynthesis.speaking) {
      stopFlag = true;
      window.speechSynthesis.cancel();
      if (btn) { btn.classList.remove('speaking'); btn.textContent = '🔊'; }
      setTimeout(() => { stopFlag = false; }, 200);
      return;
    }

    const clean = cleanForTTS(text);
    if (!clean) return;
    const segments = splitSentences(clean);
    if (segments.length === 0) return;

    const voice = pickArabicVoice();

    let idx = 0;
    if (btn) { btn.classList.add('speaking'); btn.textContent = '⏹️'; }

    function speakNext() {
      if (stopFlag || idx >= segments.length) {
        if (btn) { btn.classList.remove('speaking'); btn.textContent = '🔊'; }
        return;
      }
      const seg = segments[idx++];
      const u = new SpeechSynthesisUtterance(seg);
      u.lang = voice?.lang || 'ar-SA';
      if (voice) u.voice = voice;

      const { rate, pitch } = classifySegment(seg);
      u.rate = rate;
      u.pitch = pitch;
      u.volume = 1;

      u.onend = () => speakNext();
      u.onerror = () => { if (btn) { btn.classList.remove('speaking'); btn.textContent = '🔊'; } };

      currentUtterance = u;
      window.speechSynthesis.speak(u);
    }
    speakNext();
  }

  // استبدل speakMessage بالنسخة الاحترافية
  const hook = (r = 30) => {
    if (typeof window.speakMessage !== 'function') {
      if (r > 0) return setTimeout(() => hook(r - 1), 300);
      return;
    }
    window.speakMessage = speakPro;
    console.log('🎵 TTS Pro ready');
  };
  hook();

  window.ttsSpeakPro = speakPro;
})();