// ═══════════════════════════════════════════════════════
// LAZY LOADER — تحميل المكتبات عند الحاجة فقط
// ═══════════════════════════════════════════════════════
(function lazyLoader() {
  'use strict';
  const cache = {};

  // تحميل سكربت خارجي (مرة واحدة فقط)
  window.loadScript = function(url, globalVar) {
    if (cache[url]) return cache[url];
    if (globalVar && typeof window[globalVar] !== 'undefined') {
      return Promise.resolve();
    }
    cache[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed: ' + url));
      document.head.appendChild(s);
    });
    return cache[url];
  };

  // تحميل CSS خارجي (مرة واحدة فقط)
  window.loadStyle = function(url) {
    const key = 'css:' + url;
    if (cache[key]) return cache[key];
    cache[key] = new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = url;
      l.onload = resolve;
      l.onerror = resolve;
      document.head.appendChild(l);
    });
    return cache[key];
  };

  // تحميل highlight.js
  window.loadHighlightJS = function() {
    if (window.hljs) return Promise.resolve();
    return Promise.all([
      window.loadScript(
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
        'hljs'
      ),
      window.loadStyle(
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css'
      )
    ]).then(() => {
      if (window.hljs) {
        try { hljs.configure({ ignoreUnescapedHTML: true }); } catch (e) {}
      }
    });
  };

  // تحميل pdf.js
  window.loadPdfJS = function() {
    if (window.pdfjsLib) return Promise.resolve();
    return window.loadScript(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
      'pdfjsLib'
    ).then(() => {
      if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
    });
  };

  // تحميل lucide (أيقونات SVG)
  window.loadLucide = function() {
    if (window.lucide) return Promise.resolve();
    return window.loadScript(
      'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
      'lucide'
    );
  };

  console.log('⚡ Lazy loader ready');
})();