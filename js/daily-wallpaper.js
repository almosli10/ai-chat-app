// js/daily-wallpaper.js — الخلفية اليومية من مِشكاة
(function dailyWallpaper() {
  'use strict';

  const CACHE_KEY = 'mishkat_wallpaper_v1';
  const GEO_KEY = 'mishkat_geo_v1';

  // ═══ تحويل كود الطقس ═══
  function getWeatherCondition(code) {
    if (code === 0) return 'clear-sky';
    if (code <= 3) return 'partly-cloudy';
    if (code <= 48) return 'foggy';
    if (code <= 57) return 'drizzle';
    if (code <= 67) return 'rainy';
    if (code <= 77) return 'snowy';
    if (code <= 82) return 'rain-showers';
    if (code <= 86) return 'snow-showers';
    return 'thunderstorm';
  }

  function getTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 4 && h < 7) return 'dawn';
    if (h >= 7 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    if (h >= 20 && h < 23) return 'night';
    return 'midnight';
  }

  // ═══ وصف المزاج بالإنجليزية ═══
  const MOOD_STYLE = {
    cheerful:    'warm golden tones, hopeful atmosphere, gentle sunlight, uplifting',
    academic:    'library aesthetic, warm scholarly light, vintage atmosphere, refined',
    calm:        'soft pastel colors, minimalist serene, misty morning, peaceful',
    fast:        'dynamic motion, neon streaks, energetic urban, vibrant contrast',
    angry:       'dramatic red-orange sky, storm brewing, powerful intense atmosphere',
    sad:         'melancholic rain, blue-grey tones, lonely atmosphere, muted',
    enthusiastic:'explosive vibrant colors, fireworks energy, bright dynamic',
    philosophical:'cosmic deep space, stars, infinity, meditative abstract',
    sarcastic:   'art deco style, retro-futuristic, ironic elegance, sophisticated',
    mysterious:  'dark mystical atmosphere, moonlight, fog, deep shadows',
    elegant:     'art nouveau, gold ornaments, luxurious marble, royal palace',
    ancientSage: 'ancient desert ruins, mystical sandstone, eternal wisdom',
    villain:     'dark gothic castle, crimson moon, dramatic shadows, theatrical'
  };

  const TIME_STYLE = {
    dawn:      'soft pink and orange dawn, first light',
    morning:   'bright fresh morning light, dew, morning mist',
    afternoon: 'warm bright daylight, golden hour approaching',
    evening:   'golden sunset, warm orange and pink sky',
    night:     'deep blue starry night, moonlight',
    midnight:  'dark midnight sky, milky way, aurora'
  };

  const WEATHER_STYLE = {
    'clear-sky':     'clear blue sky, no clouds, sunny',
    'partly-cloudy': 'soft clouds, partial sunlight',
    'foggy':         'thick mystical fog, ethereal',
    'drizzle':       'light rain, wet reflections',
    'rainy':         'heavy rain, dramatic rainclouds',
    'snowy':         'snow falling, white winter wonderland',
    'rain-showers':  'rainbow after shower, dramatic clouds',
    'snow-showers':  'light snow, winter twilight',
    'thunderstorm':  'dramatic lightning, stormy sky'
  };

  // ═══ بناء الوصف ═══
  function buildPrompt(weather, mood, time) {
    const moodStyle = MOOD_STYLE[mood] || MOOD_STYLE.cheerful;
    const timeStyle = TIME_STYLE[time] || TIME_STYLE.morning;
    const weatherStyle = WEATHER_STYLE[weather] || WEATHER_STYLE['clear-sky'];
    
    const themes = [
      'vast mystical mountains with mirror lakes',
      'ancient desert dunes under dramatic sky',
      'coastal cliffs and ocean waves',
      'misty forest with tall pine trees',
      'cherry blossom garden path',
      'futuristic cyberpunk city skyline',
      'cosmic nebula and stars'
    ];
    const theme = themes[new Date().getDay()];

    return `Breathtaking cinematic wallpaper of ${theme}, ${moodStyle}, ${timeStyle}, ${weatherStyle}, ultra HD, artistic photography, atmospheric lighting, no text, no watermark, no people, wide panoramic, painterly masterpiece`;
  }

  // ═══ الموقع ═══
  async function getLocation() {
    const cached = localStorage.getItem(GEO_KEY);
    if (cached) {
      try {
        const g = JSON.parse(cached);
        if (Date.now() - g.ts < 86400000) return g;
      } catch (e) {}
    }
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve({ lat: 24.7136, lon: 46.6753, ts: Date.now() });
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const g = { lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now() };
          localStorage.setItem(GEO_KEY, JSON.stringify(g));
          resolve(g);
        },
        () => resolve({ lat: 24.7136, lon: 46.6753, ts: Date.now() }),
        { timeout: 5000, maximumAge: 600000 }
      );
    });
  }

  // ═══ الطقس (Open-Meteo مجاني) ═══
  async function fetchWeather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather failed');
      const data = await res.json();
      return {
        code: data.current?.weather_code ?? 0,
        temp: Math.round(data.current?.temperature_2m ?? 25)
      };
    } catch (e) {
      return { code: 0, temp: 25 };
    }
  }

  // ═══ توليد الخلفية (تلقائي) ═══
  async function generateWallpaper(force = false) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && !force) {
      try {
        const w = JSON.parse(cached);
        if (w.date === new Date().toDateString()) return w;
      } catch (e) {}
    }

    if (typeof toast === 'function') toast('🎨 يجهّز خلفيتك اليومية...');

    const geo = await getLocation();
    const weather = await fetchWeather(geo.lat, geo.lon);
    const weatherCond = getWeatherCondition(weather.code);
    const time = getTimeOfDay();
    const mood = window.currentMood || 'cheerful';
    
    const prompt = buildPrompt(weatherCond, mood, time);
    console.log('🎨 Wallpaper prompt:', prompt);
    
    const imageUrl = `/api/image?prompt=${encodeURIComponent(prompt)}`;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const data = {
          date: new Date().toDateString(),
          url: imageUrl,
          prompt,
          weather: weatherCond,
          time,
          mood,
          temp: weather.temp,
          ts: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        resolve(data);
      };
      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      img.src = imageUrl;
      setTimeout(() => reject(new Error('انتهت المهلة')), 30000);
    });
  }

  // ═══ تطبيق الخلفية ═══
  function applyWallpaper(data) {
    if (!data || !data.url) return;
    let layer = document.getElementById('daily-wallpaper-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'daily-wallpaper-layer';
      layer.className = 'daily-wallpaper-layer';
      document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.style.backgroundImage = `url("${data.url}")`;
    document.body.classList.add('has-daily-wallpaper');
    console.log('✅ Wallpaper applied');
  }

  function removeWallpaper() {
    const layer = document.getElementById('daily-wallpaper-layer');
    if (layer) layer.remove();
    document.body.classList.remove('has-daily-wallpaper');
    localStorage.removeItem(CACHE_KEY);
    if (typeof toast === 'function') toast('🗑️ تم إزالة الخلفية');
  }

  // ═══ زر في الشريط العلوي ═══
  function addButton() {
    const topActions = document.querySelector('.top-actions');
    if (!topActions || document.getElementById('wallpaperBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'wallpaperBtn';
    btn.className = 'agent-btn';
    btn.innerHTML = '🖼️ <span class="label">خلفية</span>';
    btn.title = 'الخلفية اليومية من مشكاة';
    btn.onclick = openPanel;
    topActions.insertBefore(btn, topActions.firstChild);
  }

  // ═══ اللوحة ═══
  function openPanel() {
    let panel = document.getElementById('wallpaperPanel');
    if (panel) { panel.remove(); return; }
    
    const cached = localStorage.getItem(CACHE_KEY);
    let data = null;
    try { data = cached ? JSON.parse(cached) : null; } catch (e) {}
    
    const weatherLabels = {
      'clear-sky': '☀️ صافٍ', 'partly-cloudy': '⛅ غائم جزئياً',
      'foggy': '🌫️ ضباب', 'drizzle': '🌦️ رذاذ',
      'rainy': '🌧️ ممطر', 'snowy': '❄️ ثلجي',
      'rain-showers': '🌦️ زخات مطر', 'snow-showers': '🌨️ زخات ثلج',
      'thunderstorm': '⛈️ عاصف'
    };
    const timeLabels = {
      dawn: '🌅 فجر', morning: '🌄 صباح', afternoon: '☀️ ظهر',
      evening: '🌇 مساء', night: '🌙 ليل', midnight: '🌌 منتصف الليل'
    };
    
    panel = document.createElement('div');
    panel.id = 'wallpaperPanel';
    panel.className = 'wallpaper-panel';
    panel.innerHTML = `
      <div class="wallpaper-panel-header">
        <span>🖼️ الخلفية اليومية</span>
        <button onclick="this.closest('.wallpaper-panel').remove()">✕</button>
      </div>
      
      <div class="wallpaper-panel-preview" id="wallpaperPreview">
        ${data ? `<img src="${data.url}" alt="wallpaper" />` : '<div class="wallpaper-empty">لم تُنشأ خلفية اليوم بعد</div>'}
      </div>
      
      ${data ? `<div class="wallpaper-panel-info">
        <span>${weatherLabels[data.weather] || data.weather}</span>
        <span>${timeLabels[data.time] || data.time}</span>
        <span>🌡️ ${data.temp}°C</span>
      </div>` : ''}
      
      <div class="wallpaper-custom-input">
        <input type="text" id="wallpaperCustomPrompt" placeholder="✏️ أو اكتب وصفك الخاص... (مثال: جبال في الضباب)" />
      </div>
      
      <div class="wallpaper-panel-actions">
        <button class="wallpaper-btn primary" onclick="window.generateDailyWallpaper(true)">
          ✨ ${data ? 'جدّد تلقائياً' : 'أنشئ'}
        </button>
        <button class="wallpaper-btn secondary" onclick="window.generateCustomWallpaper()">
          🎨 أنشئ بوصفي
        </button>
      </div>
      
      <div class="wallpaper-panel-actions second-row">
        <button class="wallpaper-btn variations" onclick="window.generateVariations()">
          🎲 3 خيارات
        </button>
        ${data ? `
          <button class="wallpaper-btn" onclick="window.downloadWallpaper()">💾 حفظ</button>
          <button class="wallpaper-btn danger" onclick="window.removeDailyWallpaper()">🗑️ إزالة</button>
        ` : ''}
      </div>
      
      <div id="wallpaperVariationsGrid" class="wallpaper-variations-grid"></div>
    `;
    document.body.appendChild(panel);
    
    // اضغط Enter في الحقل = أنشئ
    setTimeout(() => {
      const inp = document.getElementById('wallpaperCustomPrompt');
      if (inp) {
        inp.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.generateCustomWallpaper();
          }
        };
      }
    }, 100);
  }

  // ═══ الواجهة العامة: توليد تلقائي ═══
  window.generateDailyWallpaper = async function(force = false) {
    try {
      const data = await generateWallpaper(force);
      applyWallpaper(data);
      if (typeof toast === 'function') toast('✅ جاهزة! خلفيتك اليومية');
      const panel = document.getElementById('wallpaperPanel');
      if (panel) { panel.remove(); openPanel(); }
    } catch (err) {
      console.error(err);
      if (typeof toast === 'function') toast('❌ ' + err.message);
    }
  };

  // ═══ الواجهة العامة: توليد بوصف مخصص ═══
  window.generateCustomWallpaper = async function() {
    const inp = document.getElementById('wallpaperCustomPrompt');
    const customPrompt = (inp?.value || '').trim();
    if (!customPrompt) {
      if (typeof toast === 'function') toast('✏️ اكتب وصفك أولاً');
      if (inp) inp.focus();
      return;
    }
    
    try {
      if (typeof toast === 'function') toast('🎨 يجهّز صورتك...');
      
      const geo = await getLocation();
      const weather = await fetchWeather(geo.lat, geo.lon);
      const weatherCond = getWeatherCondition(weather.code);
      const time = getTimeOfDay();
      const mood = window.currentMood || 'cheerful';
      
      const finalPrompt = `Breathtaking cinematic wallpaper: ${customPrompt}, ${MOOD_STYLE[mood] || ''}, ${TIME_STYLE[time] || ''}, ${WEATHER_STYLE[weatherCond] || ''}, ultra HD, artistic photography, atmospheric lighting, no text, no watermark, no people`;
      
      const imageUrl = `/api/image?prompt=${encodeURIComponent(finalPrompt)}`;
      
      // انتظر التحميل
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = () => reject(new Error('فشل التحميل'));
        img.src = imageUrl;
        setTimeout(() => reject(new Error('انتهت المهلة')), 30000);
      });
      
      // احفظ وطبّق
      const data = {
        date: new Date().toDateString(),
        url: imageUrl,
        prompt: finalPrompt,
        weather: weatherCond,
        time,
        mood,
        temp: weather.temp,
        ts: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      applyWallpaper(data);
      
      if (typeof toast === 'function') toast('✅ جاهزة! خلفيتك الجديدة');
      const panel = document.getElementById('wallpaperPanel');
      if (panel) { panel.remove(); openPanel(); }
    } catch (err) {
      console.error(err);
      if (typeof toast === 'function') toast('❌ ' + err.message);
    }
  };

  // ═══ الواجهة العامة: 3 خيارات ═══
  window.generateVariations = async function() {
    const grid = document.getElementById('wallpaperVariationsGrid');
    if (!grid) return;
    
    const inp = document.getElementById('wallpaperCustomPrompt');
    const customPrompt = (inp?.value || '').trim();
    
    grid.innerHTML = '<div class="wallpaper-loading">🎨 يجهّز 3 خيارات... (10-20 ثانية)</div>';
    
    try {
      const geo = await getLocation();
      const weather = await fetchWeather(geo.lat, geo.lon);
      const weatherCond = getWeatherCondition(weather.code);
      const time = getTimeOfDay();
      const mood = window.currentMood || 'cheerful';
      
      // أنماط مختلفة لكل خيار
      const variationsStyles = [
        'cinematic photography, dramatic lighting',
        'digital painting, artistic masterpiece, painterly',
        'minimalist aesthetic, clean composition, soft tones'
      ];
      
      const basePrompt = customPrompt 
        ? customPrompt 
        : 'vast mystical mountains with mirror lakes';
      
      const prompts = variationsStyles.map(style => 
        `Breathtaking wallpaper: ${basePrompt}, ${MOOD_STYLE[mood] || ''}, ${TIME_STYLE[time] || ''}, ${WEATHER_STYLE[weatherCond] || ''}, ${style}, ultra HD, no text, no watermark, no people`
      );
      
      // ولّد الكل بالتوازي مع seeds مختلفة
      const urls = prompts.map(p => `/api/image?prompt=${encodeURIComponent(p)}&seed=${Math.floor(Math.random() * 1000000)}`);
      
      grid.innerHTML = '';
      
      urls.forEach((url, i) => {
        const card = document.createElement('div');
        card.className = 'wallpaper-variation-card';
        card.innerHTML = `
          <div class="wallpaper-variation-img-wrap">
            <div class="wallpaper-variation-loader">⏳</div>
            <img src="${url}" style="display:none" />
          </div>
          <button class="wallpaper-variation-select" disabled>انتظر...</button>
        `;
        grid.appendChild(card);
        
        const img = card.querySelector('img');
        const loader = card.querySelector('.wallpaper-variation-loader');
        const btn = card.querySelector('.wallpaper-variation-select');
        
        img.onload = () => {
          loader.style.display = 'none';
          img.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'اختر هذه';
        };
        img.onerror = () => {
          loader.textContent = '❌';
          btn.disabled = true;
          btn.textContent = 'فشل';
        };
        
        btn.onclick = () => {
          const data = {
            date: new Date().toDateString(),
            url,
            prompt: prompts[i],
            weather: weatherCond,
            time,
            mood,
            temp: weather.temp,
            ts: Date.now()
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          applyWallpaper(data);
          if (typeof toast === 'function') toast('✅ تم اختيار الخلفية');
          const panel = document.getElementById('wallpaperPanel');
          if (panel) { panel.remove(); openPanel(); }
        };
      });
      
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="wallpaper-loading" style="color:#f87171;">❌ ${err.message}</div>`;
    }
  };

  // ═══ إزالة الخلفية ═══
  window.removeDailyWallpaper = function() {
    removeWallpaper();
    const panel = document.getElementById('wallpaperPanel');
    if (panel) { panel.remove(); openPanel(); }
  };

  // ═══ حفظ الخلفية ═══
  window.downloadWallpaper = async function() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return;
    try {
      const data = JSON.parse(cached);
      const res = await fetch(data.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mishkat-wallpaper-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof toast === 'function') toast('💾 تم الحفظ');
    } catch (e) {
      if (typeof toast === 'function') toast('❌ فشل الحفظ');
    }
  };

  // ═══ التهيئة ═══
  function init() {
    addButton();
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.date === new Date().toDateString()) applyWallpaper(data);
      } catch (e) {}
    }
    console.log('🖼️ Daily wallpaper ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500), { once: true });
  } else {
    setTimeout(init, 1500);
  }
})();