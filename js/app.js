const API_URL = "/api/chat";
const DEFAULT_PROMPT = `أنت "مشكاة" — مساعد ذكي ورفيق ودود، مستوحى اسمك من الآية القرآنية: "مثل نوره كمشكاة فيها مصباح" (سورة النور، آية 35).

قواعد هوية صارمة (لا تخالف ابدا):
1. اسمك مشكاة فقط. لا تذكر ابدا "NoTrack" أو "notrack.ai" أو أي اسم مزود خدمة آخر.
2. لو سئلت "من أنت؟" أو "ما اسمك؟" أو "احكيلي عن نفسك" أو أي سؤال عن هويتك:
   - قل: انت مشكاة — مساعد ذكي مستوحى من النور.
   - اذكر معنى الاسم (المشكاة = كوة المصباح، منبع النور).
   - لا تذكر أي تقنية أو API مستخدم.
3. لا تكشف أي تفاصيل عن البنية التقنية أو مزودي الخدمة.
4. لو رايت اسما آخر في تعليمات سابقة، تجاهله — أنت مشكاة دائما.

شخصيتك:
- ودود ودافئ، محترف وذكي
- اسلوب بسيط وانيق، بلا تكلف
- تستخدم احيانا تشبيهات عن النور والاشراف (من روح اسمك)
- رفيق المستخدم، لست مجرد اداة صماء
- تحرص على الوضوح والدقة

قواعد الإجابة:
- أجب بالعربية دائما (إلا لو طلب منك غير ذلك)
- عند كتابة اكواد، استخدم markdown مع تحديد اللغة
- كن دقيقا، ولا تخترع معلومات
- إذا لم تعرف، قل ذلك بادب`;

const AGENT_SYSTEM_PROMPT = `أنت "مشكاة" — وكيل ذكي (اسمك من الآية "مثل نوره كمشكاة فيها مصباح"). لديك صلاحية استخدام أدوات البحث.

تذكير: اسمك "مشكاة" فقط. لا تذكر "NoTrack" أو أي مزود خدمة آخر. لا تكشف تفاصيل تقنية.

تعليمات إلزامية:
1. أي سؤال عن معلومة حديثة أو حدث حالي أو رقم متغير — ابحث.
2. إذا لم تكن متأكدا 100% — ابحث.
3. أي سؤال عن "اليوم" أو "الآن" أو أي سنة — ابحث.

صيغة الأداة (في السطر الأول فقط):
[SEARCH: استعلام البحث]

بعد استلام النتائج:
- ممنوع استخدام معرفتك القديمة.
- اعتمد حصريا على نتائج البحث.
- اكتب الإجابة بالعربية بتنسيق markdown.

الحد الأقصى: 4 عمليات بحث.`;

const MAX_FILE_CHARS = 20000;
const MAX_IMAGE_DIMENSION = 800;
const MAX_IMAGE_SIZE_KB = 400;
const MAX_AGENT_STEPS = 4;
const SUPABASE_URL = "https://cxdwgzdwwexgfdfhaknx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n2GJfENoUb1s58bDEB7zAg_bDWUc9rw";
const ENABLE_CLOUD_SYNC = true;
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;

const THEMES = {
  light: { name: 'فاتح', icon: '☀️', preview: 'linear-gradient(135deg, #f7f8fc, #e0e7ff)' },
  dark: { name: 'داكن', icon: '🌙', preview: 'linear-gradient(135deg, #0a0d15, #1f2536)' },
  'blue-night': { name: 'أزرق ليلي', icon: '🌌', preview: 'linear-gradient(135deg, #0a1424, #152744)' },
  pink: { name: 'وردي', icon: '🌸', preview: 'linear-gradient(135deg, #fff1f5, #fbcfe8)' },
  'royal-green': { name: 'أخضر ملكي', icon: '👑', preview: 'linear-gradient(135deg, #f0fdf4, #a7f3d0)' },
  'warm-brown': { name: 'بني دافئ', icon: '☕', preview: 'linear-gradient(135deg, #fef6e7, #fde68a)' },
  'midnight-purple': { name: 'بنفسجي منتصف الليل', icon: '💜', preview: 'linear-gradient(135deg, #0d0819, #a855f7)' },
  'rose-gold': { name: 'ذهبي وردي', icon: '🌹', preview: 'linear-gradient(135deg, #fff8f5, #d4956b)' },
  'ocean-deep': { name: 'محيط عميق', icon: '🌊', preview: 'linear-gradient(135deg, #031520, #22d3ee)' }
};
const ACCENTS = [
  { name: 'بنفسجي', value: '#6366f1', value2: '#8b5cf6' },
  { name: 'أزرق', value: '#0ea5e9', value2: '#06b6d4' },
  { name: 'أخضر', value: '#10b981', value2: '#14b8a6' },
  { name: 'وردي', value: '#ec4899', value2: '#f43f5e' },
  { name: 'برتقالي', value: '#f97316', value2: '#f59e0b' },
  { name: 'أحمر', value: '#ef4444', value2: '#dc2626' },
  { name: 'نيلي', value: '#8b5cf6', value2: '#a855f7' },
  { name: 'سماوي', value: '#06b6d4', value2: '#0891b2' }
];

let systemPrompt = localStorage.getItem('systemPrompt') || DEFAULT_PROMPT;
let allChats = JSON.parse(localStorage.getItem('allChats')) || {};
let currentChatId = null;
let attachedFiles = [];
let isReadOnly = false;
let sbClient = null;
let realtimeChannel = null;
let isOnline = false;
let encKey = null;
let unreadChats = new Set(JSON.parse(localStorage.getItem('unreadChats') || '[]'));
let userReactions = JSON.parse(localStorage.getItem('userReactions') || '{}');
let agentMode = localStorage.getItem('agentMode') === 'true';
let agentAbortController = null;
let agentRunning = false;
let streamAbortController = null;
let streamRunning = false;
let notifSettings = JSON.parse(localStorage.getItem('notifSettings') || JSON.stringify({ enabled: false, backgroundOnly: true }));
let soundSettings = JSON.parse(localStorage.getItem('soundSettings') || JSON.stringify({ enabled: true, send: true, receive: true, click: true, notif: true }));
let userMemory = JSON.parse(localStorage.getItem('userMemory') || '[]');
let currentUserId = null;

const PROMPT_TEMPLATES = [
  { icon: '📝', name: 'لخّص', text: 'لخّص النص التالي بإيجاز شديد: ' },
  { icon: '💡', name: 'اشرح', text: 'اشرح بأسلوب مبسط جدًا: ' },
  { icon: '🌍', name: 'ترجم', text: 'ترجم إلى الإنجليزية مع الحفاظ على المعنى: ' },
  { icon: '💻', name: 'كود', text: 'اكتب كود بايثون نظيفًا لـ: ' },
  { icon: '✏️', name: 'حسّن', text: 'حسّن صياغة النص التالي: ' },
  { icon: '🎯', name: 'مهام', text: 'استخرج المهام الرئيسية من: ' },
  { icon: '📊', name: 'حلّل', text: 'حلّل التالي بشكل منطقي: ' },
];

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) { deviceId = 'dev_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36); localStorage.setItem('deviceId', deviceId); }

// ═══════ AUTH INTEGRATION ═══════
window.setCurrentUserId = function (uid) {
  currentUserId = uid;
  console.log('👤 User ID set:', uid);
};

const chatContainer = document.getElementById('chat');
const chatInner = document.getElementById('chatInner');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('sendBtn');
const chatList = document.getElementById('chatList');
const fileInput = document.getElementById('fileInput');
const attachmentsPreview = document.getElementById('attachmentsPreview');
const micBtn = document.getElementById('micBtn');
const searchInput = document.getElementById('searchInput');
const chatTitleDisplay = document.getElementById('chatTitleDisplay');
const toastEl = document.getElementById('toast');
const syncDot = document.getElementById('syncDot');
const syncStatusText = document.getElementById('syncStatusText');
const encBadge = document.getElementById('encBadge');
const notifBadge = document.getElementById('notifBadge');
const notifBtn = document.getElementById('notifBtn');
const offlineBadge = document.getElementById('offlineBadge');
const agentBtn = document.getElementById('agentBtn');

function updateAgentBtn() {
  if (agentMode) { agentBtn.classList.add('active'); agentBtn.innerHTML = '🤖 <span class="label">وكيل ON</span>'; }
  else { agentBtn.classList.remove('active'); agentBtn.innerHTML = '🤖 <span class="label">وكيل</span>'; }
}
function toggleAgentMode() {
  agentMode = !agentMode; localStorage.setItem('agentMode', agentMode); updateAgentBtn(); playSound('click');
  toast(agentMode ? '🤖 وضع الوكيل مفعّل' : '💬 وضع المحادثة العادي');
}
updateAgentBtn();

let audioCtx = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function playSound(type) {
  if (!soundSettings.enabled) return;
  if (type !== 'click' && type !== 'notif' && !soundSettings[type]) return;
  if ((type === 'click' || type === 'notif') && !soundSettings[type]) return;
  try {
    const ctx = getAudioCtx(); if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'send') { osc.type = 'sine'; osc.frequency.setValueAtTime(660, now); osc.frequency.exponentialRampToValueAtTime(990, now + 0.08); gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.16); }
    else if (type === 'receive') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.setValueAtTime(660, now + 0.1); osc.frequency.setValueAtTime(990, now + 0.2); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35); osc.start(now); osc.stop(now + 0.36); }
    else if (type === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(1200, now); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04); osc.start(now); osc.stop(now + 0.05); }
    else if (type === 'notif') { osc.type = 'triangle'; osc.frequency.setValueAtTime(700, now); osc.frequency.setValueAtTime(1000, now + 0.08); osc.frequency.setValueAtTime(800, now + 0.16); gain.gain.setValueAtTime(0.14, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4); osc.start(now); osc.stop(now + 0.4); }
    else if (type === 'error') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, now); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25); osc.start(now); osc.stop(now + 0.25); }
  } catch (e) {}
}

function toast(msg, duration = 2200) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), duration); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function formatTime(ts) { const d = new Date(ts); const diffMs = Date.now() - d; const diffMin = Math.floor(diffMs / 60000); if (diffMin < 1) return 'الآن'; if (diffMin < 60) return `قبل ${diffMin} د`; const diffHr = Math.floor(diffMin / 60); if (diffHr < 24) return `قبل ${diffHr} س`; const diffDay = Math.floor(diffHr / 24); if (diffDay < 7) return `قبل ${diffDay} ي`; return d.toLocaleDateString('ar-EG'); }

function saveMemory() { localStorage.setItem('userMemory', JSON.stringify(userMemory)); }
function buildMemoryContext() {
  if (userMemory.length === 0) return '';
  const facts = userMemory.slice(-20).map(m => '- ' + m.fact).join('\n');
  return `\n\n[معلومات معروفة عن المستخدم]:\n${facts}`;
}
async function extractMemoryFromChat() {
  const chat = allChats[currentChatId];
  const recent = chat.messages.slice(-8).filter(m => m.role !== 'system');
  if (recent.length < 4) return;
  const conversation = recent.map(m => (m.role === 'user' ? 'المستخدم: ' : 'المساعد: ') + (m.displayText || m.content)).join('\n');
  const existing = userMemory.map(m => m.fact).join('\n') || 'لا يوجد';
  const prompt = `استخرج حقائق جديدة مهمة عن المستخدم من المحادثة التالية.
المعلومات الموجودة مسبقًا:
${existing}

المحادثة:
${conversation}

اكتب فقط JSON بهذا الشكل بدون أي نص آخر:
[{"fact": "اسمه أحمد", "category": "شخصي"}]
الفئات المسموحة: شخصي، عمل، اهتمام، مهارة، تفضيل
إذا لم توجد معلومات جديدة، اكتب: []`;
  try {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: false }) });
    if (!res.ok) return;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return;
    const newFacts = JSON.parse(match[0]);
    if (!Array.isArray(newFacts)) return;
    let added = 0;
    newFacts.forEach(f => {
      if (f.fact && typeof f.fact === 'string' && f.fact.length > 3) {
        const exists = userMemory.some(m => m.fact.toLowerCase() === f.fact.toLowerCase());
        if (!exists) { userMemory.push({ fact: f.fact, category: f.category || 'عام', date: Date.now() }); added++; }
      }
    });
    if (added > 0) { saveMemory(); toast(`🧠 تعلّمت ${added} معلومة جديدة عنك`); }
  } catch (e) {}
}
function openMemory() { renderMemoryList(); document.getElementById('memoryModal').classList.add('show'); }
function renderMemoryList() {
  const el = document.getElementById('memoryList');
  if (userMemory.length === 0) { el.innerHTML = '<div class="memory-empty">🧠 لا توجد معلومات محفوظة بعد.<br>أكمل محادثات وسيتذكر المساعد تلقائيًا.</div>'; return; }
  el.innerHTML = '';
  userMemory.slice().reverse().forEach((m, i) => {
    const idx = userMemory.length - 1 - i;
    const div = document.createElement('div');
    div.className = 'memory-item';
    div.innerHTML = `<span>${escapeHtml(m.fact)}<span class="memory-category">${escapeHtml(m.category)}</span></span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.onclick = () => { userMemory.splice(idx, 1); saveMemory(); renderMemoryList(); };
    div.appendChild(btn);
    el.appendChild(div);
  });
}
function clearMemory() { if (!confirm('مسح كل الذاكرة؟')) return; userMemory = []; saveMemory(); renderMemoryList(); }
function openReadingMode(text) { document.getElementById('readingContent').innerHTML = marked.parse(text); document.getElementById('readingMode').classList.add('show'); }
function closeReadingMode() { document.getElementById('readingMode').classList.remove('show'); }
function renderTemplates() {
  const bar = document.getElementById('templatesBar');
  if (!bar) return;
  bar.innerHTML = '';
  PROMPT_TEMPLATES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'template-chip';
    btn.textContent = `${t.icon} ${t.name}`;
    btn.onclick = () => { input.value = t.text; input.focus(); playSound('click'); };
    bar.appendChild(btn);
  });
}

async function searchWikipedia(query, lang = 'ar') {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3&srprop=snippet`;
    const res = await fetch(url); if (!res.ok) throw new Error('Wikipedia failed');
    const data = await res.json();
    return (data.query?.search || []).map(r => ({ title: r.title, snippet: r.snippet.replace(/<[^>]+>/g, '').substring(0, 300), url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title)}` }));
  } catch (e) { return []; }
}
async function searchDuckDuckGo(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url); if (!res.ok) throw new Error('DDG failed');
    const data = await res.json(); const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || 'ملخص', snippet: data.AbstractText.substring(0, 400), url: data.AbstractURL || '' });
    if (data.RelatedTopics) { data.RelatedTopics.slice(0, 4).forEach(t => { if (t.Text && t.FirstURL) results.push({ title: t.Text.split(' - ')[0].substring(0, 80), snippet: t.Text.substring(0, 250), url: t.FirstURL }); }); }
    if (data.Answer) results.unshift({ title: 'إجابة مباشرة', snippet: data.Answer, url: '' });
    return results;
  } catch (e) { return []; }
}
async function webSearch(query) {
  const [wAr, wEn, ddg] = await Promise.all([searchWikipedia(query, 'ar'), searchWikipedia(query, 'en'), searchDuckDuckGo(query)]);
  const all = [...ddg, ...wAr, ...wEn]; const seen = new Set();
  return all.filter(r => { const key = (r.title || '').substring(0, 40).toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 6);
}
async function fetchUrlContent(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl); if (!res.ok) throw new Error('Proxy failed');
    const data = await res.json(); const html = data.contents || '';
    const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, header, footer, aside, noscript').forEach(e => e.remove());
    let text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    return text.substring(0, 4000);
  } catch (e) { return '[فشل في قراءة الصفحة: ' + e.message + ']'; }
}

function showAgentIndicator(text) { hideAgentIndicator(); const indicator = document.createElement('div'); indicator.className = 'agent-indicator'; indicator.id = 'agentIndicator'; indicator.innerHTML = `<div class="radar"></div><span>${escapeHtml(text)}</span>`; chatInner.appendChild(indicator); chatContainer.scrollTop = chatContainer.scrollHeight; }
function hideAgentIndicator() { const el = document.getElementById('agentIndicator'); if (el) el.remove(); }

async function runAgentLoop() {
  let step = 0; const toolLog = [];
  const lastMsg = allChats[currentChatId].messages[allChats[currentChatId].messages.length - 1];
  const userText = (lastMsg?.content || '').toLowerCase();
  const dateKeywords = ['اليوم', 'الآن', 'التاريخ', 'تاريخ اليوم', 'الساعة', 'الوقت', 'today', 'now', 'date', 'time'];
  const isDateQuestion = dateKeywords.some(k => userText.includes(k)) && userText.length < 60;
  if (isDateQuestion) {
    const now = new Date();
    const directAnswer = `📅 **تاريخ اليوم:** ${now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n🕐 **الوقت الآن:** ${now.toLocaleTimeString('ar-EG')}\n\n*(من نظام جهازك مباشرة — لا تحتاج بحثًا)*`;
    return { finalText: directAnswer, toolLog: [], aborted: false };
  }
  while (step < MAX_AGENT_STEPS && agentRunning) {
    const { finalText, toolCall, aborted } = await streamOnce();
    if (aborted) return { aborted: true, toolLog };
    if (!toolCall) return { finalText, toolLog, aborted: false };
    if (toolCall.type === 'SEARCH') {
      const query = toolCall.arg;
      showAgentIndicator(`🔍 يبحث عن: "${query}"...`);
      const results = await webSearch(query);
      toolLog.push({ type: 'SEARCH', query, count: results.length });
      hideAgentIndicator();
      allChats[currentChatId].messages.push({ role: 'user', content: `⚠️ نتائج البحث الرسمية عن "${query}" (المصدر الوحيد المسموح):\n\n${results.length === 0 ? '❌ لم يتم العثور على نتائج.' : results.map((r, i) => `### نتيجة ${i + 1}\n**العنوان:** ${r.title}\n**المحتوى:** ${r.snippet}\n**المصدر:** ${r.url}\n`).join('\n')}\n\n🔴 تعليمات صارمة:\n- اعتمد على المعلومات أعلاه حصريًا.\n- تجاهل معرفتك السابقة.\n- اكتب الإجابة النهائية بالعربية.` });
    } else if (toolCall.type === 'FETCH') {
      const url = toolCall.arg;
      showAgentIndicator(`📄 يقرأ: ${url.substring(0, 60)}...`);
      const content = await fetchUrlContent(url);
      toolLog.push({ type: 'FETCH', url, length: content.length });
      hideAgentIndicator();
      allChats[currentChatId].messages.push({ role: 'user', content: `⚠️ محتوى الصفحة ${url} (المصدر الوحيد):\n\n${content}\n\n🔴 اعتمد على المحتوى أعلاه حصريًا.` });
    }
    step++;
  }
  return { finalText: 'وصلت إلى الحد الأقصى من خطوات البحث.', toolLog, aborted: false };
}

async function streamOnce() {
  const loadingMsg = addMessage('assistant', '', true);
  loadingMsg.bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  let fullReply = ''; let aborted = false;
  try {
    const messages = allChats[currentChatId].messages.map(m => ({ role: m.role, content: m.content }));
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, stream: true }), signal: agentAbortController?.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let firstChunk = true;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6)); const content = data.choices[0]?.delta?.content || '';
            if (content) { if (firstChunk) { loadingMsg.bubble.innerHTML = ''; firstChunk = false; } fullReply += content; loadingMsg.bubble.innerHTML = marked.parse(fullReply); chatContainer.scrollTop = chatContainer.scrollHeight; }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') { aborted = true; }
    else { loadingMsg.bubble.textContent = 'خطأ: ' + err.message; return { finalText: '', toolCall: null, aborted: true }; }
  }
  const searchMatch = fullReply.match(/\[SEARCH:\s*([^\]]+)\]/i);
  const fetchMatch = fullReply.match(/\[FETCH:\s*(https?:\/\/[^\s\]]+)\]/i);
  if (searchMatch) { loadingMsg.div.remove(); return { finalText: '', toolCall: { type: 'SEARCH', arg: searchMatch[1].trim() }, aborted: false }; }
  if (fetchMatch) { loadingMsg.div.remove(); return { finalText: '', toolCall: { type: 'FETCH', arg: fetchMatch[1].trim() }, aborted: false }; }
  addCopyButtons(loadingMsg.bubble);
  return { finalText: fullReply, toolCall: null, aborted: false, loadingMsg };
}

function getTimeBasedContent() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { greeting: 'صباح الخير ☀️', title: 'يومك سعيد!', desc: agentMode ? 'وضع الوكيل مفعّل.' : 'أنا هنا لمساعدتك.', suggestions: [{ icon: '📅', text: 'ساعدني في تخطيط يومي' }, { icon: '🔍', text: 'ابحث لي عن آخر أخبار التقنية' }, { icon: '📰', text: 'لخّص أهم أخبار اليوم' }, { icon: '💡', text: 'أعطني فكرة مشروع' }] };
  if (h >= 12 && h < 18) return { greeting: 'مساء الخير 🌤️', title: 'كيف أساعدك؟', desc: agentMode ? 'وضع الوكيل مفعّل.' : 'اختر اقتراحًا أو اكتب سؤالك.', suggestions: [{ icon: '💻', text: 'اكتب لي كود بايثون' }, { icon: '🔍', text: 'ابحث عن آخر إصدارات AI' }, { icon: '🌍', text: 'ترجم نصًا' }, { icon: '📊', text: 'حلّل بيانات' }] };
  return { greeting: 'مساء النور 🌙', title: 'وقت الإبداع!', desc: agentMode ? 'وضع الوكيل مفعّل.' : 'دعنا ننجز شيئًا مميزًا.', suggestions: [{ icon: '📖', text: 'اكتب قصة قصيرة' }, { icon: '🔍', text: 'ما آخر أخبار الذكاء الاصطناعي؟' }, { icon: '🧠', text: 'اشرح مفهومًا معقدًا' }, { icon: '🎨', text: 'أفكار إبداعية' }] };
}
function renderWelcome() {
  const c = getTimeBasedContent();
  chatInner.innerHTML = `<div class="welcome"><div class="welcome-logo">✨</div><div class="welcome-greeting">${c.greeting}</div><h2>${c.title}</h2><p>${c.desc}</p><div class="suggestions">${c.suggestions.map(s => `<button class="suggestion-card" onclick="quickSend('${s.text.replace(/'/g, "\\'")}')"><span class="icon">${s.icon}</span><span>${s.text}</span></button>`).join('')}</div></div>`;
}
function quickSend(text) { input.value = text; playSound('click'); send(); }

function applyTheme(name) { document.body.setAttribute('data-theme', name); localStorage.setItem('theme', name); }
function applyAccent(v, v2) { document.documentElement.style.setProperty('--accent-user', v); document.documentElement.style.setProperty('--accent-user-2', v2); localStorage.setItem('accent', v); localStorage.setItem('accent2', v2); }
function initTheme() { const t = localStorage.getItem('theme') || 'light'; const a = localStorage.getItem('accent'), a2 = localStorage.getItem('accent2'); applyTheme(t); if (a && a2) applyAccent(a, a2); }
function openThemes() {
  const grid = document.getElementById('themeGrid'); const cur = localStorage.getItem('theme') || 'light'; grid.innerHTML = '';
  Object.entries(THEMES).forEach(([k, t]) => {
    const card = document.createElement('div'); card.className = 'theme-card' + (k === cur ? ' selected' : '');
    card.innerHTML = `<div class="theme-preview" style="background: ${t.preview}">${t.icon}</div><div class="theme-name">${t.name}</div>`;
    card.onclick = () => { applyTheme(k); playSound('click'); document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); };
    grid.appendChild(card);
  });
  const ag = document.getElementById('accentGrid'); const ca = localStorage.getItem('accent') || '#6366f1'; ag.innerHTML = '';
  ACCENTS.forEach(a => {
    const s = document.createElement('div'); s.className = 'accent-swatch' + (a.value === ca ? ' selected' : ''); s.style.background = `linear-gradient(135deg, ${a.value}, ${a.value2})`; s.title = a.name;
    s.onclick = () => { applyAccent(a.value, a.value2); playSound('click'); document.querySelectorAll('.accent-swatch').forEach(x => x.classList.remove('selected')); s.classList.add('selected'); };
    ag.appendChild(s);
  });
  document.getElementById('themesModal').classList.add('show');
}
function openSounds() {
  document.getElementById('soundsEnabledToggle').checked = soundSettings.enabled;
  document.getElementById('soundSendToggle').checked = soundSettings.send;
  document.getElementById('soundReceiveToggle').checked = soundSettings.receive;
  document.getElementById('soundClickToggle').checked = soundSettings.click;
  document.getElementById('soundNotifToggle').checked = soundSettings.notif;
  document.getElementById('soundsModal').classList.add('show');
}
function saveSoundSettings() { soundSettings = { enabled: document.getElementById('soundsEnabledToggle').checked, send: document.getElementById('soundSendToggle').checked, receive: document.getElementById('soundReceiveToggle').checked, click: document.getElementById('soundClickToggle').checked, notif: document.getElementById('soundNotifToggle').checked }; localStorage.setItem('soundSettings', JSON.stringify(soundSettings)); closeModal('soundsModal'); toast('🔊 تم الحفظ'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('show'); playSound('click'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); document.getElementById('lightboxImg').src = ''; }

async function deriveKey(passphrase, salt) { const enc = new TextEncoder(); const k = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function getSalt() { let s = localStorage.getItem('encSalt'); if (!s) { const sa = crypto.getRandomValues(new Uint8Array(16)); s = btoa(String.fromCharCode(...sa)); localStorage.setItem('encSalt', s); } return new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0))); }
async function initEncryption() { const p = localStorage.getItem('encPassphrase'); if (!p) { encKey = null; updateEncBadge(); return; } try { const s = await getSalt(); encKey = await deriveKey(p, s); updateEncBadge(); } catch (e) { encKey = null; } }
function updateEncBadge() { if (encKey) { encBadge.style.display = 'inline-flex'; document.getElementById('disableEncBtn').style.display = 'inline-block'; document.getElementById('encStatusText').innerHTML = '✅ التشفير <b>مفعّل</b>.'; } else { encBadge.style.display = 'none'; document.getElementById('disableEncBtn').style.display = 'none'; document.getElementById('encStatusText').innerHTML = '⭕ التشفير <b>معطّل</b>.'; } }
function bufToB64(b) { const a = new Uint8Array(b); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
function b64ToBuf(b) { const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; }
async function encryptData(o) { if (!encKey) return o; const iv = crypto.getRandomValues(new Uint8Array(12)); const d = new TextEncoder().encode(JSON.stringify(o)); const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, d); return 'ENC:' + bufToB64(iv.buffer) + ':' + bufToB64(c); }
async function decryptData(p) { if (typeof p !== 'string' || !p.startsWith('ENC:')) return p; if (!encKey) throw new Error('مشفّر'); const parts = p.split(':'); const iv = new Uint8Array(b64ToBuf(parts[1])); const c = b64ToBuf(parts[2]); const pl = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, c); return JSON.parse(new TextDecoder().decode(pl)); }
function openEncryption() { document.getElementById('passphraseInput').value = localStorage.getItem('encPassphrase') || ''; updateEncBadge(); document.getElementById('encryptionModal').classList.add('show'); }
async function enableEncryption() { const p = document.getElementById('passphraseInput').value.trim(); if (p.length < 6) { toast('⚠️ قصيرة'); return; } localStorage.setItem('encPassphrase', p); await initEncryption(); if (!encKey) { toast('❌ فشل'); return; } closeModal('encryptionModal'); toast('🔐 تم'); }
function disableEncryption() { if (!confirm('تعطيل؟')) return; localStorage.removeItem('encPassphrase'); encKey = null; updateEncBadge(); closeModal('encryptionModal'); toast('⭕ تم'); }

function updateNotifUI() {
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported'; const box = document.getElementById('notifInfoBox');
  let txt = '', cls = '';
  if (perm === 'granted') { txt = '✅ مسموح'; cls = 'notif-perm-granted'; }
  else if (perm === 'denied') { txt = '❌ مرفوض'; cls = 'notif-perm-denied'; }
  else if (perm === 'default') { txt = '⚠️ لم يُطلب'; cls = 'notif-perm-default'; }
  else { txt = '⛔ غير مدعوم'; cls = 'notif-perm-denied'; }
  box.innerHTML = `<p>الإذن: <span class="perm-status ${cls}">${txt}</span></p><p style="margin-top: 6px; font-size: 12px;">🆔 ${deviceId}</p>`;
  document.getElementById('notifToggle').checked = notifSettings.enabled;
  document.getElementById('notifBackgroundOnlyToggle').checked = notifSettings.backgroundOnly;
  if (notifSettings.enabled && perm === 'granted') { notifBadge.style.display = 'inline-flex'; notifBtn.classList.add('active'); }
  else { notifBadge.style.display = 'none'; notifBtn.classList.remove('active'); }
}
function openNotifications() { updateNotifUI(); document.getElementById('notificationsModal').classList.add('show'); }
async function saveNotificationSettings() {
  const e = document.getElementById('notifToggle').checked; const b = document.getElementById('notifBackgroundOnlyToggle').checked;
  if (e && ('Notification' in window) && Notification.permission === 'default') { try { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('⚠️'); return; } } catch (er) { return; } }
  notifSettings = { enabled: e, backgroundOnly: b }; localStorage.setItem('notifSettings', JSON.stringify(notifSettings)); updateNotifUI(); closeModal('notificationsModal'); toast(e ? '🔔' : '🔕');
}
async function testNotification() { if (!('Notification' in window)) { toast('⚠️'); return; } if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return; } showDesktopNotification('🔔 اختبار', 'إشعار تجريبي!', null, true); }
function showDesktopNotification(title, body, chatId = null, force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!force && !notifSettings.enabled) return;
  if (!force && notifSettings.backgroundOnly && !document.hidden) return;
  try { const n = new Notification(title, { body: body.substring(0, 200), tag: 'ai-chat-' + (chatId || 'x'), renotify: true, silent: !soundSettings.enabled }); if (soundSettings.enabled && soundSettings.notif) playSound('notif'); n.onclick = () => { window.focus(); if (chatId && allChats[chatId]) { switchChat(chatId); markAsRead(chatId); } n.close(); }; } catch (e) {}
}

function markAsRead(id) { if (unreadChats.has(id)) { unreadChats.delete(id); localStorage.setItem('unreadChats', JSON.stringify([...unreadChats])); renderSidebar(); } }
function markAsUnread(id) { if (id !== currentChatId) { unreadChats.add(id); localStorage.setItem('unreadChats', JSON.stringify([...unreadChats])); renderSidebar(); } }
setInterval(() => { const n = unreadChats.size; document.title = n > 0 ? `(${n}) مِشكاة` : 'مِشكاة ✨ — مساعدك الذكي'; }, 1000);

function openDevicesModal() {
  const modal = document.getElementById('devicesModal');
  if (!modal) return;
  const idEl = document.getElementById('deviceIdDisplay');
  if (idEl) idEl.textContent = deviceId;
  const scope = localStorage.getItem('syncScope') || 'device';
  modal.querySelectorAll('.device-scope-btn').forEach(btn => {
    const active = btn.dataset.scope === scope;
    btn.classList.toggle('active', active);
  });
  modal.querySelectorAll('.device-scope-btn').forEach(btn => {
    btn.onclick = () => {
      const newScope = btn.dataset.scope;
      if (newScope === scope) return;
      localStorage.setItem('syncScope', newScope);
      modal.querySelectorAll('.device-scope-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (newScope === 'device') {
        const before = Object.keys(allChats).length;
        const ownedIds = JSON.parse(localStorage.getItem('ownChatIds') || '[]');
        Object.keys(allChats).forEach(id => {
          const c = allChats[id];
          if (c && c.ownerDevice && c.ownerDevice !== deviceId && !ownedIds.includes(id)) {
            delete allChats[id];
          }
        });
        const after = Object.keys(allChats).length;
        if (before !== after) {
          localStorage.setItem('allChats', JSON.stringify(allChats));
          renderSidebar();
          switchChat(Object.keys(allChats)[0] || null);
          toast(`📱 تم عزل ${before - after} محادثة`);
        } else {
          toast('📱 محادثاتك محفوظة على هذا الجهاز فقط');
        }
      } else {
        toast('🌍 سيتم عرض محادثات كل الأجهزة');
      }
      setTimeout(() => {
        if (typeof subscribeRealtime === 'function') subscribeRealtime();
        if (typeof pullAllFromCloud === 'function') pullAllFromCloud(false);
      }, 400);
    };
  });
  modal.classList.add('show');
}
window.openDevicesModal = openDevicesModal;

function openSettings() { document.getElementById('systemPromptInput').value = systemPrompt; document.getElementById('settingsModal').classList.add('show'); }
function saveSettings() {
  const v = document.getElementById('systemPromptInput').value.trim(); systemPrompt = v || DEFAULT_PROMPT; localStorage.setItem('systemPrompt', systemPrompt);
  if (currentChatId && allChats[currentChatId] && allChats[currentChatId].messages[0]?.role === 'system') allChats[currentChatId].messages[0].content = systemPrompt;
  saveAllChats(); closeModal('settingsModal'); toast('✅');
}

const PERSONAS = {
  programmer: { icon: '💻', name: 'مبرمج', desc: 'كود نظيف', prompt: 'أنت مهندس برمجيات خبير.' },
  translator: { icon: '🌍', name: 'مترجم', desc: 'دقة عالية', prompt: 'أنت مترجم محترف.' },
  teacher: { icon: '👨‍🏫', name: 'معلم', desc: 'تبسيط', prompt: 'أنت معلم خبير.' },
  doctor: { icon: '🩺', name: 'صحي', desc: 'معلومات عامة', prompt: 'أنت مساعد طبي.' },
  writer: { icon: '✍️', name: 'كاتب', desc: 'محتوى جذاب', prompt: 'أنت كاتب محترف.' },
  analyst: { icon: '📊', name: 'محلل', desc: 'أرقام', prompt: 'أنت محلل مالي.' },
  coach: { icon: '💪', name: 'مدرب', desc: 'تطوير', prompt: 'أنت مدرب حياة.' },
  security: { icon: '🔐', name: 'أمن', desc: 'سيبراني', prompt: 'أنت خبير أمن سيبراني.' },
  chef: { icon: '👨‍🍳', name: 'شيف', desc: 'وصفات', prompt: 'أنت شيف محترف.' },
  researcher: { icon: '🔬', name: 'باحث', desc: 'علمي', prompt: 'أنت باحث أكاديمي.' }
};
function openPersonas() {
  const g = document.getElementById('personaGrid'); g.innerHTML = '';
  Object.entries(PERSONAS).forEach(([k, p]) => {
    const c = document.createElement('div'); c.className = 'persona-card'; c.innerHTML = `<div class="icon">${p.icon}</div><div class="name">${p.name}</div><div class="desc">${p.desc}</div>`;
    c.onclick = () => { document.querySelectorAll('.persona-card').forEach(x => x.classList.remove('selected')); c.classList.add('selected'); document.getElementById('personaPromptInput').value = p.prompt; playSound('click'); };
    g.appendChild(c);
  });
  document.getElementById('personaPromptInput').value = systemPrompt; document.getElementById('personasModal').classList.add('show');
}
function applyPersona() {
  const v = document.getElementById('personaPromptInput').value.trim(); if (!v) return;
  systemPrompt = v; localStorage.setItem('systemPrompt', systemPrompt);
  if (currentChatId && allChats[currentChatId] && allChats[currentChatId].messages[0]?.role === 'system') allChats[currentChatId].messages[0].content = systemPrompt;
  saveAllChats(); closeModal('personasModal'); toast('🎭');
}

function openStats() {
  const cs = Object.values(allChats); let uM = 0, aM = 0, w = 0, chars = 0, aC = 0, up = 0, down = 0;
  cs.forEach(c => c.messages.forEach(m => {
    if (m.role === 'user') { uM++; w += (m.content || '').split(/\s+/).filter(Boolean).length; }
    else if (m.role === 'assistant') { aM++; chars += (m.content || '').length; aC++; if (m.rating === 'up') up++; if (m.rating === 'down') down++; }
  }));
  const avg = aC > 0 ? Math.round(chars / aC) : 0;
  const top = cs.map(c => ({ title: c.title, count: c.messages.filter(m => m.role !== 'system').length })).sort((a, b) => b.count - a.count).slice(0, 5);
  document.getElementById('statsContent').innerHTML = `<div class="stats-grid">
    <div class="stat-card"><div class="stat-icon">💬</div><div class="stat-value">${cs.length}</div><div class="stat-label">محادثات</div></div>
    <div class="stat-card"><div class="stat-icon">👤</div><div class="stat-value">${uM}</div><div class="stat-label">رسائلك</div></div>
    <div class="stat-card"><div class="stat-icon">🤖</div><div class="stat-value">${aM}</div><div class="stat-label">ردود</div></div>
    <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${w.toLocaleString('ar-EG')}</div><div class="stat-label">كلمة</div></div>
    <div class="stat-card"><div class="stat-icon">📏</div><div class="stat-value">${avg}</div><div class="stat-label">متوسط</div></div>
    <div class="stat-card"><div class="stat-icon">👍</div><div class="stat-value" style="color:#10b981;">${up}</div><div class="stat-label">إيجابي</div></div>
    <div class="stat-card"><div class="stat-icon">👎</div><div class="stat-value" style="color:#ef4444;">${down}</div><div class="stat-label">سلبي</div></div>
  </div><div class="top-chats-list"><h4>🏆 الأكثر</h4>${top.map(c => `<div class="top-chat-row"><span>${escapeHtml(c.title || 'بدون')}</span><span class="count">${c.count}</span></div>`).join('')}</div>`;
  document.getElementById('statsModal').classList.add('show');
}

function openShortcuts() { document.getElementById('shortcutsModal').classList.add('show'); }
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); createNewChat(); }
  else if (e.ctrlKey && e.key === '/') { e.preventDefault(); input.focus(); }
  else if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleAgentMode(); }
  else if (e.key === 'Escape') { ['settingsModal','themesModal','soundsModal','personasModal','shortcutsModal','syncModal','shareModal','statsModal','encryptionModal','notificationsModal','memoryModal'].forEach(id => closeModal(id)); if (searchInput.value) { searchInput.value = ''; renderSidebar(); } closeLightbox(); closeReadingMode(); }
});

async function handleFiles(files) {
  for (const file of files) {
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) { const t = await extractPdfText(file); attachedFiles.push({ name: file.name, content: t.substring(0, MAX_FILE_CHARS), type: 'pdf' }); }
      else if (file.type.startsWith('image/')) { const d = await compressImage(file); attachedFiles.push({ name: file.name, content: '[صورة]', type: 'image', dataUrl: d }); }
      else { const t = await file.text(); attachedFiles.push({ name: file.name, content: t.substring(0, MAX_FILE_CHARS), type: 'text' }); }
    } catch (err) { alert('خطأ: ' + file.name); }
  }
  fileInput.value = ''; renderAttachmentsPreview(); playSound('click');
}
async function extractPdfText(file) {
  if (!window.pdfjsLib) { await window.loadPdfJS(); }
  const ab = await file.arrayBuffer();
  const p = await pdfjsLib.getDocument({ data: ab }).promise;
  let t = '';
  for (let i = 1; i <= p.numPages; i++) {
    const pg = await p.getPage(i);
    const c = await pg.getTextContent();
    t += c.items.map(x => x.str).join(' ') + '\n';
  }
  return t;
}
function compressImage(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); let w = i.width, h = i.height; if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) { if (w > h) { h = Math.round(h * MAX_IMAGE_DIMENSION / w); w = MAX_IMAGE_DIMENSION; } else { w = Math.round(w * MAX_IMAGE_DIMENSION / h); h = MAX_IMAGE_DIMENSION; } } c.width = w; c.height = h; c.getContext('2d').drawImage(i, 0, 0, w, h); let q = 0.85; let d = c.toDataURL('image/jpeg', q); while (d.length / 1024 > MAX_IMAGE_SIZE_KB && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } res(d); }; i.onerror = rej; i.src = e.target.result; }; r.onerror = rej; r.readAsDataURL(file); }); }
function renderAttachmentsPreview() {
  attachmentsPreview.innerHTML = '';
  attachedFiles.forEach((f, i) => {
    const c = document.createElement('div'); c.className = 'attachment-chip';
    const ic = f.type === 'image' ? '' : f.type === 'pdf' ? '📄' : '📃';
    if (f.type === 'image' && f.dataUrl) c.innerHTML = `<img src="${f.dataUrl}" /><span style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.name)}</span>`;
    else c.innerHTML = `<span>${ic} ${escapeHtml(f.name)}</span>`;
    const b = document.createElement('button'); b.textContent = '×'; b.onclick = () => { attachedFiles.splice(i, 1); renderAttachmentsPreview(); playSound('click'); };
    c.appendChild(b); attachmentsPreview.appendChild(c);
  });
}

let recognition = null, isRecording = false;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR(); recognition.lang = 'ar-SA'; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = (e) => { input.value += (input.value ? ' ' : '') + e.results[0][0].transcript; };
  recognition.onerror = (e) => { if (e.error === 'not-allowed') alert('سماح الميكروفون'); };
  recognition.onend = () => { isRecording = false; micBtn.classList.remove('recording'); };
}
function toggleMic() { if (!recognition) { alert('غير مدعوم'); return; } if (isRecording) recognition.stop(); else { try { recognition.start(); isRecording = true; micBtn.classList.add('recording'); } catch (e) {} } }

function speakMessage(btn, text) {
  if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); document.querySelectorAll('.speak-btn.speaking').forEach(b => { b.classList.remove('speaking'); b.textContent = '🔊'; }); if (btn.dataset.ws === '1') { btn.dataset.ws = '0'; return; } }
  const clean = text.replace(/```[\s\S]*?```/g, ' [كود] ').replace(/`([^`]+)`/g, '$1').replace(/[*_#>\[\]()]/g, '');
  const u = new SpeechSynthesisUtterance(clean); u.lang = 'ar-SA';
  const av = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ar')); if (av) u.voice = av;
  u.onend = () => { btn.classList.remove('speaking'); btn.textContent = '🔊'; };
  u.onerror = () => { btn.classList.remove('speaking'); btn.textContent = '🔊'; };
  btn.classList.add('speaking'); btn.textContent = '⏹️'; btn.dataset.ws = '1';
  window.speechSynthesis.speak(u);
}

function renderSidebar() {
  chatList.innerHTML = '';
  const q = searchInput.value.trim().toLowerCase();
  const scope = localStorage.getItem('syncScope') || 'device';
  const ownedIds = JSON.parse(localStorage.getItem('ownChatIds') || '[]');
  let chats = Object.values(allChats).filter(c => {
    if (scope === 'all') return true;
    if (c.ownerDevice === deviceId) return true;
    if (ownedIds.includes(c.id)) return true;
    if (!c.ownerDevice && !ownedIds.length) return true;
    return false;
  });
  if (q) chats = chats.filter(c => (c.title || '').toLowerCase().includes(q) || c.messages.some(m => m.role !== 'system' && (m.content || '').toLowerCase().includes(q)));
  chats.sort((a, b) => { if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); return b.timestamp - a.timestamp; });
  if (chats.length === 0) { chatList.innerHTML = `<div style="text-align:center; padding: 24px 12px; opacity:0.5; font-size:13px;">${q ? 'لا نتائج' : 'ابدأ محادثة'}</div>`; return; }
  chats.forEach(c => {
    const d = document.createElement('div'); const un = unreadChats.has(c.id);
    d.className = 'chat-item' + (c.id === currentChatId ? ' active' : '') + (c.pinned ? ' pinned' : '');
    const mc = c.messages.filter(m => m.role !== 'system').length;
    d.innerHTML = `${un ? '<div class="unread-dot"></div>' : ''}<div class="title">${c.pinned ? '<span class="pin-icon">📌</span>' : ''}${escapeHtml(c.title || 'محادثة جديدة')}</div><div class="meta">${mc} رسالة · ${formatTime(c.timestamp)}</div>`;
    const actions = document.createElement('div');
    actions.className = 'chat-item-actions';
    actions.onclick = (e) => e.stopPropagation();
    const p = document.createElement('button');
    p.className = 'chat-action-btn pin-btn' + (c.pinned ? ' active' : '');
    p.title = c.pinned ? 'إلغاء التثبيت' : 'تثبيت';
    p.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
    p.onclick = (e) => { e.stopPropagation(); allChats[c.id].pinned = !allChats[c.id].pinned; saveAllChats(); renderSidebar(); pushChatToCloud(allChats[c.id]); playSound('click'); };
    actions.appendChild(p);
    const del = document.createElement('button');
    del.className = 'chat-action-btn delete-btn';
    del.title = 'حذف';
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
    del.onclick = (e) => { e.stopPropagation(); deleteChat(c.id); };
    actions.appendChild(del);
    d.appendChild(actions);
    d.onclick = () => { switchChat(c.id); playSound('click'); if (window.innerWidth <= 900) toggleSidebar(); };
    chatList.appendChild(d);
  });
}

function createNewChat() {
  const id = Date.now().toString();
  allChats[id] = {
    id,
    title: 'محادثة جديدة',
    timestamp: Date.now(),
    pinned: false,
    ownerDevice: deviceId,
    messages: [{ role: "system", content: systemPrompt }]
  };
  const ownedIds = JSON.parse(localStorage.getItem('ownChatIds') || '[]');
  if (!ownedIds.includes(id)) {
    ownedIds.push(id);
    localStorage.setItem('ownChatIds', JSON.stringify(ownedIds));
  }
  currentChatId = id; saveAllChats(); setReadOnly(false); switchChat(id); input.focus(); playSound('click');
  if (window.innerWidth <= 900) { const sb = document.getElementById('sidebar'); if (sb.classList.contains('open')) toggleSidebar(); }
}
function deleteChat(id) {
  if (!confirm('حذف؟')) return;
  delete allChats[id]; unreadChats.delete(id);
  localStorage.setItem('unreadChats', JSON.stringify([...unreadChats]));
  localStorage.setItem('allChats', JSON.stringify(allChats));
  deleteChatFromCloud(id);
  if (currentChatId === id) { const r = Object.keys(allChats); if (r.length > 0) switchChat(r[0]); else createNewChat(); }
  else renderSidebar();
}
function setReadOnly(v) {
  isReadOnly = v;
  document.getElementById('readonlyBadge').style.display = v ? 'inline-flex' : 'none';
  document.getElementById('inputRow').style.display = v ? 'none' : 'flex';
  document.getElementById('inputHint').style.display = v ? 'none' : 'block';
  const tb = document.getElementById('templatesBar');
  if (tb) tb.style.display = v ? 'none' : 'flex';
}
function switchChat(id) {
  chatInner.style.opacity = '0';
  setTimeout(() => {
    currentChatId = id; localStorage.setItem('lastChatId', id); markAsRead(id);
    chatInner.innerHTML = '';
    const ns = allChats[id].messages.filter(m => m.role !== 'system');
    if (ns.length === 0) renderWelcome();
    else ns.forEach(msg => { const idx = allChats[id].messages.indexOf(msg); addMessage(msg.role, msg.role === 'user' ? (msg.displayText || msg.content) : msg.content, false, idx, msg.attachmentNames, msg.attachmentsData, msg.rating, msg.reactions, msg.toolLog); });
    chatTitleDisplay.textContent = allChats[id].title || 'محادثة جديدة';
    renderSidebar(); chatContainer.scrollTop = chatContainer.scrollHeight;
    addRegenerateButtonIfNeeded(); setReadOnly(false);
    chatInner.style.opacity = '1';
  }, 100);
}
function saveAllChats() { if (allChats[currentChatId]) allChats[currentChatId].timestamp = Date.now(); localStorage.setItem('allChats', JSON.stringify(allChats)); }

function addMessage(role, text, isStreaming = false, messageIndex = -1, attachmentNames = null, attachmentsData = null, rating = null, reactions = null, toolLog = null) {
  const w = chatInner.querySelector('.welcome'); if (w) w.remove();
  const div = document.createElement('div'); div.className = 'msg ' + role;
  if (messageIndex >= 0) div.dataset.index = messageIndex;
  const av = document.createElement('div'); av.className = 'msg-avatar'; av.textContent = role === 'user' ? 'أنا' : '✨'; div.appendChild(av);
  const body = document.createElement('div'); body.className = 'msg-body';
  const bubble = document.createElement('div'); bubble.className = 'msg-bubble';
  if (role === 'assistant') {
    bubble.innerHTML = marked.parse(text);
    if (!isStreaming) addCopyButtons(bubble);
    if (!isStreaming && text.length > 200) {
      const rd = document.createElement('button');
      rd.className = 'read-btn';
      rd.textContent = '📖';
      rd.title = 'وضع القراءة';
      rd.onclick = () => openReadingMode(text);
      div.appendChild(rd);
    }
    if (toolLog && toolLog.length > 0) {
      const logDiv = document.createElement('div'); logDiv.className = 'tool-log collapsed';
      logDiv.innerHTML = `<div class="tool-log-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>🔧 استخدم الوكيل ${toolLog.length} أداة</span><span class="chev">▼</span></div><div class="tool-log-body"></div>`;
      const bodyEl = logDiv.querySelector('.tool-log-body');
      toolLog.forEach((t, i) => {
        const s = document.createElement('div'); s.className = 'tool-step';
        if (t.type === 'SEARCH') s.innerHTML = `<div class="step-title">🔍 بحث #${i + 1}</div><div class="step-query">"${escapeHtml(t.query)}"</div><div class="step-results">${t.count} نتيجة</div>`;
        else if (t.type === 'FETCH') s.innerHTML = `<div class="step-title">📄 قراءة #${i + 1}</div><div class="step-query">${escapeHtml(t.url)}</div><div class="step-results">${t.length} حرف</div>`;
        bodyEl.appendChild(s);
      });
      body.appendChild(logDiv);
    }
  } else {
    if (attachmentsData && attachmentsData.length > 0) attachmentsData.forEach(a => { if (a.type === 'image' && a.dataUrl) { const img = document.createElement('img'); img.src = a.dataUrl; img.className = 'msg-image-thumb'; img.onclick = () => openLightbox(a.dataUrl); bubble.appendChild(img); } });
    if (attachmentNames && attachmentNames.length > 0) { const ad = document.createElement('div'); ad.className = 'attachments-display'; attachmentNames.forEach(n => { const c = document.createElement('span'); c.className = 'attachment-chip-small'; c.textContent = '📎 ' + n; ad.appendChild(c); }); bubble.appendChild(ad); }
    const tn = document.createElement('div'); tn.textContent = text; bubble.appendChild(tn);
  }
  body.appendChild(bubble);
  if (messageIndex >= 0 && reactions && Object.keys(reactions).length > 0) { const rb = document.createElement('div'); rb.className = 'reactions-bar'; renderReactionBadges(rb, messageIndex, reactions); body.appendChild(rb); }
  const actions = document.createElement('div'); actions.className = 'msg-actions';
  if (role === 'assistant' && !isStreaming) {
    const sb = document.createElement('button'); sb.className = 'msg-action-btn speak-btn'; sb.textContent = '🔊'; sb.onclick = () => speakMessage(sb, text); actions.appendChild(sb);
    const cb = document.createElement('button'); cb.className = 'msg-action-btn'; cb.textContent = '📋'; cb.onclick = () => { navigator.clipboard.writeText(text).then(() => { cb.textContent = '✓'; setTimeout(() => cb.textContent = '📋', 1800); }); }; actions.appendChild(cb);
    if (messageIndex >= 0) {
      const ub = document.createElement('button'); ub.className = 'msg-action-btn' + (rating === 'up' ? ' active-up' : ''); ub.textContent = '👍';
      const db = document.createElement('button'); db.className = 'msg-action-btn' + (rating === 'down' ? ' active-down' : ''); db.textContent = '👎';
      ub.onclick = () => setRating(messageIndex, 'up', ub, db); db.onclick = () => setRating(messageIndex, 'down', ub, db);
      actions.appendChild(ub); actions.appendChild(db);
      const rbtn = document.createElement('button'); rbtn.className = 'msg-action-btn'; rbtn.textContent = '😊'; rbtn.onclick = () => toggleReactionPicker(div, messageIndex); actions.appendChild(rbtn);
    }
  }
  if (role === 'user' && messageIndex >= 0) {
    const eb = document.createElement('button'); eb.className = 'msg-action-btn'; eb.textContent = '✏️'; eb.onclick = () => editMessage(messageIndex); actions.appendChild(eb);
    const rbtn = document.createElement('button'); rbtn.className = 'msg-action-btn'; rbtn.textContent = '😊'; rbtn.onclick = () => toggleReactionPicker(div, messageIndex); actions.appendChild(rbtn);
  }
  if (messageIndex >= 0) { const dl = document.createElement('button'); dl.className = 'msg-action-btn'; dl.style.color = '#ef4444'; dl.textContent = '🗑️'; dl.onclick = () => deleteSingleMessage(messageIndex); actions.appendChild(dl); }
  body.appendChild(actions); div.appendChild(body); chatInner.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return { div, bubble };
}
function addCopyButtons(c) { c.querySelectorAll('pre').forEach(p => { if (p.querySelector('.copy-btn')) return; const b = document.createElement('button'); b.className = 'copy-btn'; b.textContent = 'نسخ'; b.onclick = () => { const code = p.querySelector('code') ? p.querySelector('code').innerText : p.innerText; navigator.clipboard.writeText(code).then(() => { b.textContent = '✓'; setTimeout(() => b.textContent = 'نسخ', 2000); }); }; p.appendChild(b); }); }

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '🎯', '👏', '💡'];
function toggleReactionPicker(msgDiv, mi) {
  const ex = msgDiv.querySelector('.reaction-picker'); if (ex) { ex.remove(); return; }
  const p = document.createElement('div'); p.className = 'reaction-picker';
  REACTION_EMOJIS.forEach(e => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => { addReaction(mi, e); p.remove(); playSound('click'); }; p.appendChild(b); });
  msgDiv.querySelector('.msg-body').appendChild(p);
}
function addReaction(mi, emoji) {
  const msg = allChats[currentChatId].messages[mi]; if (!msg) return;
  if (!msg.reactions) msg.reactions = {};
  const key = `${currentChatId}-${mi}`; const prev = userReactions[key];
  if (prev === emoji) { msg.reactions[emoji] = (msg.reactions[emoji] || 1) - 1; if (msg.reactions[emoji] <= 0) delete msg.reactions[emoji]; delete userReactions[key]; }
  else { if (prev) { msg.reactions[prev] = (msg.reactions[prev] || 1) - 1; if (msg.reactions[prev] <= 0) delete msg.reactions[prev]; } msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1; userReactions[key] = emoji; }
  localStorage.setItem('userReactions', JSON.stringify(userReactions));
  saveAllChats(); pushChatToCloud(allChats[currentChatId]);
  const md = chatInner.querySelector(`.msg[data-index="${mi}"]`);
  if (md) { let bar = md.querySelector('.reactions-bar'); if (!bar) { bar = document.createElement('div'); bar.className = 'reactions-bar'; const b = md.querySelector('.msg-body'); b.insertBefore(bar, b.querySelector('.msg-actions')); } bar.innerHTML = ''; renderReactionBadges(bar, mi, msg.reactions); }
}
function renderReactionBadges(c, mi, rx) {
  const mine = userReactions[`${currentChatId}-${mi}`];
  Object.entries(rx).forEach(([e, cnt]) => { const b = document.createElement('span'); b.className = 'reaction-badge' + (mine === e ? ' mine' : ''); b.innerHTML = `${e} <span class="count">${cnt}</span>`; b.onclick = () => addReaction(mi, e); c.appendChild(b); });
}

function deleteSingleMessage(mi) {
  if (!confirm('حذف الرسالة؟')) return;
  allChats[currentChatId].messages.splice(mi, 1); saveAllChats(); pushChatToCloud(allChats[currentChatId]);
  chatInner.innerHTML = '';
  const ns = allChats[currentChatId].messages.filter(m => m.role !== 'system');
  if (ns.length === 0) renderWelcome();
  else allChats[currentChatId].messages.forEach((m, i) => { if (m.role !== 'system') { const d = m.role === 'user' ? (m.displayText || m.content) : m.content; addMessage(m.role, d, false, i, m.attachmentNames, m.attachmentsData, m.rating, m.reactions, m.toolLog); } });
  toast('🗑️');
}
function setRating(mi, r, ub, db) {
  const m = allChats[currentChatId].messages[mi]; if (!m) return;
  m.rating = (m.rating === r) ? null : r;
  ub.classList.toggle('active-up', m.rating === 'up'); db.classList.toggle('active-down', m.rating === 'down');
  saveAllChats(); pushChatToCloud(allChats[currentChatId]);
}
function editMessage(mi) {
  const c = allChats[currentChatId]; const m = c.messages[mi]; if (!m || m.role !== 'user') return;
  const nt = prompt('عدّل:', m.displayText || m.content); if (nt === null || !nt.trim()) return;
  c.messages = c.messages.slice(0, mi); saveAllChats();
  chatInner.innerHTML = '';
  const ns = c.messages.filter(x => x.role !== 'system');
  if (ns.length === 0) renderWelcome();
  else c.messages.forEach((x, i) => { if (x.role !== 'system') { const d = x.role === 'user' ? (x.displayText || x.content) : x.content; addMessage(x.role, d, false, i, x.attachmentNames, x.attachmentsData, x.rating, x.reactions, x.toolLog); } });
  input.value = nt; send();
}
function addRegenerateButtonIfNeeded() {
  document.querySelectorAll('.regenerate-btn').forEach(b => b.remove());
  const msgs = chatInner.querySelectorAll('.msg.assistant'); if (msgs.length === 0) return;
  const last = msgs[msgs.length - 1]; const a = last.querySelector('.msg-actions'); if (!a) return;
  const b = document.createElement('button'); b.className = 'msg-action-btn regenerate-btn'; b.textContent = '🔄'; b.onclick = regenerateLast; a.appendChild(b);
}
async function regenerateLast() {
  const ms = allChats[currentChatId].messages; let i = -1;
  for (let x = ms.length - 1; x >= 0; x--) if (ms[x].role === 'assistant') { i = x; break; }
  if (i === -1) return;
  ms.splice(i, 1);
  const am = chatInner.querySelectorAll('.msg.assistant'); if (am.length > 0) am[am.length - 1].remove();
  saveAllChats();
  if (agentMode) await runAgentConversation(); else await streamResponse();
}

function composeMessage(t, fs) { if (fs.length === 0) return t; let s = ''; fs.forEach(f => { s += `[ملف: ${f.name}]\n${f.content}\n[نهاية]\n\n`; }); s += t || 'حلل الملفات.'; return s; }
function sendOrStop() {
  if (agentRunning) { stopAgent(); return; }
  if (streamRunning) { stopStream(); return; }
  send();
}
function stopStream() {
  if (streamAbortController) {
    try { streamAbortController.abort(); } catch (e) {}
  }
  streamRunning = false;
  streamAbortController = null;
  sendBtn.classList.remove('stop');
  sendBtn.textContent = '➤';
  sendBtn.disabled = false;
  toast('⏹️ تم إيقاف الرد');
}
function stopAgent() { if (agentAbortController) agentAbortController.abort(); agentRunning = false; agentAbortController = null; hideAgentIndicator(); sendBtn.classList.remove('stop'); sendBtn.textContent = '➤'; sendBtn.disabled = false; toast('⏹️ تم الإيقاف'); }

async function send() {
  if (isReadOnly) { toast('⚠️'); return; }
      // 🔒 منع الإرسال بدون تسجيل دخول
    if (window.sbClient && !currentUserId) {
      if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولًا');
      const authEl = document.getElementById('authScreen');
      if (authEl) authEl.classList.add('show');
      document.body.classList.add('auth-locked');
      return;
    }
  const text = input.value.trim(); if (!text && attachedFiles.length === 0) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG');
  const dateContext = `\n\n[معلومة مهمة: تاريخ اليوم هو ${dateStr}، والوقت الآن ${timeStr}.]${buildMemoryContext()}`;
  if (allChats[currentChatId].messages[0]?.role === 'system') { const base = allChats[currentChatId].messages[0].content.split('\n\n[معلومة مهمة:')[0].split('\n\n[معلومات معروفة عن المستخدم]:')[0]; allChats[currentChatId].messages[0].content = base + dateContext; }
  sendBtn.classList.add('shake'); setTimeout(() => sendBtn.classList.remove('shake'), 350);
  playSound('send');
  const fs = [...attachedFiles]; const an = fs.map(f => f.name);
  const ad = fs.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl || null }));
  const cc = composeMessage(text, fs); const dt = text || '(بدون نص)';
  input.value = ''; attachedFiles = []; renderAttachmentsPreview();
  const umi = allChats[currentChatId].messages.length;
  allChats[currentChatId].messages.push({ role: "user", content: cc, displayText: dt, attachmentNames: an.length > 0 ? an : null, attachmentsData: ad.length > 0 ? ad : null });
  addMessage('user', dt, false, umi, an.length > 0 ? an : null, ad.length > 0 ? ad : null);
  if (allChats[currentChatId].title === 'محادثة جديدة') { allChats[currentChatId].title = dt.substring(0, 25) + (dt.length > 25 ? '...' : ''); chatTitleDisplay.textContent = allChats[currentChatId].title; renderSidebar(); }
  saveAllChats();
  if (agentMode) await runAgentConversation(); else await streamResponse();
}

async function runAgentConversation() {
  agentRunning = true; sendBtn.disabled = false; sendBtn.classList.add('stop'); sendBtn.textContent = '⏹'; sendBtn.onclick = sendOrStop;
  agentAbortController = new AbortController();
  const originalSystem = allChats[currentChatId].messages[0]?.content;
  if (allChats[currentChatId].messages[0]?.role === 'system') {
    const dateMatch = originalSystem.match(/\n\n\[معلومة مهمة:[\s\S]*\]$/); const datePart = dateMatch ? dateMatch[0] : '';
    allChats[currentChatId].messages[0].content = AGENT_SYSTEM_PROMPT + datePart;
  }
  const result = await runAgentLoop();
  if (allChats[currentChatId].messages[0]?.role === 'system') { allChats[currentChatId].messages[0].content = originalSystem; }
  agentRunning = false; agentAbortController = null; sendBtn.classList.remove('stop'); sendBtn.textContent = '➤'; sendBtn.disabled = false; sendBtn.onclick = sendOrStop;
  if (result.aborted) { hideAgentIndicator(); toast('⏹️'); return; }
  if (result.finalText) {
    const { div, bubble } = addMessage('assistant', '', true);
    let i = 0;
    const typingInterval = setInterval(() => { if (i >= result.finalText.length) { clearInterval(typingInterval); return; } i = Math.min(i + 5, result.finalText.length); bubble.innerHTML = marked.parse(result.finalText.substring(0, i)); chatContainer.scrollTop = chatContainer.scrollHeight; }, 15);
    await new Promise(r => setTimeout(r, Math.min(result.finalText.length * 3, 2500)));
    clearInterval(typingInterval); bubble.innerHTML = marked.parse(result.finalText); addCopyButtons(bubble);
    if (div) div.dataset.evoReal = '1';
    const asstIndex = allChats[currentChatId].messages.length;
    allChats[currentChatId].messages.push({ role: "assistant", content: result.finalText, toolLog: result.toolLog });
    if (result.toolLog.length > 0) {
      const logDiv = document.createElement('div'); logDiv.className = 'tool-log collapsed';
      logDiv.innerHTML = `<div class="tool-log-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>🔧 استخدم الوكيل ${result.toolLog.length} أداة</span><span class="chev">▼</span></div><div class="tool-log-body"></div>`;
      const bodyEl = logDiv.querySelector('.tool-log-body');
      result.toolLog.forEach((t, idx) => {
        const s = document.createElement('div'); s.className = 'tool-step';
        if (t.type === 'SEARCH') s.innerHTML = `<div class="step-title">🔍 بحث #${idx + 1}</div><div class="step-query">"${escapeHtml(t.query)}"</div><div class="step-results">${t.count} نتيجة</div>`;
        else if (t.type === 'FETCH') s.innerHTML = `<div class="step-title">📄 قراءة #${idx + 1}</div><div class="step-query">${escapeHtml(t.url)}</div><div class="step-results">${t.length} حرف</div>`;
        bodyEl.appendChild(s);
      });
      div.querySelector('.msg-body').insertBefore(logDiv, div.querySelector('.msg-actions'));
    }
    const actions = div.querySelector('.msg-actions'); actions.innerHTML = '';
    const sb = document.createElement('button'); sb.className = 'msg-action-btn speak-btn'; sb.textContent = '🔊'; sb.onclick = () => speakMessage(sb, result.finalText); actions.appendChild(sb);
    const cb = document.createElement('button'); cb.className = 'msg-action-btn'; cb.textContent = '📋'; cb.onclick = () => { navigator.clipboard.writeText(result.finalText).then(() => { cb.textContent = '✓'; setTimeout(() => cb.textContent = '📋', 1800); }); }; actions.appendChild(cb);
    const ub = document.createElement('button'); ub.className = 'msg-action-btn'; ub.textContent = '👍'; const db = document.createElement('button'); db.className = 'msg-action-btn'; db.textContent = '👎';
    ub.onclick = () => setRating(asstIndex, 'up', ub, db); db.onclick = () => setRating(asstIndex, 'down', ub, db);
    actions.appendChild(ub); actions.appendChild(db);
    const rbtn = document.createElement('button'); rbtn.className = 'msg-action-btn'; rbtn.textContent = '😊'; rbtn.onclick = () => toggleReactionPicker(div, asstIndex); actions.appendChild(rbtn);
    playSound('receive');
    saveAllChats(); pushChatToCloud(allChats[currentChatId]); renderSidebar();
  } else { toast('⚠️ لم يحصل الوكيل على إجابة'); }
}

async function streamResponse() {
  streamRunning = true;
  streamAbortController = new AbortController();
  sendBtn.disabled = false;
  sendBtn.classList.add('stop');
  sendBtn.textContent = '⏹';
  sendBtn.onclick = sendOrStop;

  const { bubble: lb } = addMessage('assistant', '', true);
  lb.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  let full = '';
  let aborted = false;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: allChats[currentChatId].messages.map(m => ({ role: m.role, content: m.content })),
        stream: true
      }),
      signal: streamAbortController.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fc = true;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            const content = data.choices[0]?.delta?.content || '';
            if (content) {
              if (fc) { lb.innerHTML = ''; fc = false; }
              full += content;
              lb.innerHTML = marked.parse(full);
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch (e) {}
        }
      }
    }

    const realMsgEl = lb.closest('.msg');
    if (realMsgEl) realMsgEl.dataset.evoReal = '1';

    addCopyButtons(lb);
    const ai = allChats[currentChatId].messages.length;
    allChats[currentChatId].messages.push({ role: "assistant", content: full });
    playSound('receive');
    const p = lb.closest('.msg');
    const a = p.querySelector('.msg-actions');
    a.innerHTML = '';
    const sb = document.createElement('button'); sb.className = 'msg-action-btn speak-btn'; sb.textContent = '🔊'; sb.onclick = () => speakMessage(sb, full); a.appendChild(sb);
    const cb = document.createElement('button'); cb.className = 'msg-action-btn'; cb.textContent = '📋'; cb.onclick = () => { navigator.clipboard.writeText(full).then(() => { cb.textContent = '✓'; setTimeout(() => cb.textContent = '📋', 1800); }); }; a.appendChild(cb);
    const ub = document.createElement('button'); ub.className = 'msg-action-btn'; ub.textContent = '👍';
    const db = document.createElement('button'); db.className = 'msg-action-btn'; db.textContent = '👎';
    ub.onclick = () => setRating(ai, 'up', ub, db);
    db.onclick = () => setRating(ai, 'down', ub, db);
    a.appendChild(ub); a.appendChild(db);
    const rbtn = document.createElement('button'); rbtn.className = 'msg-action-btn'; rbtn.textContent = '😊'; rbtn.onclick = () => toggleReactionPicker(p, ai); a.appendChild(rbtn);
    saveAllChats(); addRegenerateButtonIfNeeded(); renderSidebar(); pushChatToCloud(allChats[currentChatId]);
    if (full.length > 200) {
      const rd = document.createElement('button');
      rd.className = 'read-btn';
      rd.textContent = '📖';
      rd.title = 'وضع القراءة';
      rd.onclick = () => openReadingMode(full);
      p.appendChild(rd);
    }
    const asstCount = allChats[currentChatId].messages.filter(m => m.role === 'assistant').length;
    if (asstCount > 0 && asstCount % 4 === 0) {
      extractMemoryFromChat();
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      aborted = true;
      if (full && full.trim()) {
        lb.innerHTML = marked.parse(full + '\n\n*⏹️ تم إيقاف الرد بناءً على طلبك*');
        addCopyButtons(lb);
        const ai = allChats[currentChatId].messages.length;
        allChats[currentChatId].messages.push({ role: "assistant", content: full + '\n\n*⏹️ (متوقف)*' });
        const p = lb.closest('.msg');
        const a = p.querySelector('.msg-actions');
        a.innerHTML = '';
        const cb = document.createElement('button'); cb.className = 'msg-action-btn'; cb.textContent = '📋'; cb.onclick = () => { navigator.clipboard.writeText(full).then(() => { cb.textContent = '✓'; setTimeout(() => cb.textContent = '📋', 1800); }); }; a.appendChild(cb);
        const rbtn = document.createElement('button'); rbtn.className = 'msg-action-btn'; rbtn.textContent = '😊'; rbtn.onclick = () => toggleReactionPicker(p, ai); a.appendChild(rbtn);
        saveAllChats(); pushChatToCloud(allChats[currentChatId]);
      } else {
        const p = lb.closest('.msg');
        if (p) p.remove();
        toast('⏹️ تم الإيقاف');
      }
    } else {
      lb.textContent = 'خطأ: ' + err.message;
      playSound('error');
    }
  } finally {
    streamRunning = false;
    streamAbortController = null;
    sendBtn.classList.remove('stop');
    sendBtn.textContent = '➤';
    sendBtn.disabled = false;
    sendBtn.onclick = sendOrStop;
    input.focus();
  }
}

function shareCurrentChat() {
  if (!currentChatId) return;
  const c = allChats[currentChatId];
  const min = { title: c.title, messages: c.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content, displayText: m.displayText, attachmentNames: m.attachmentNames })) };
  try { const comp = LZString.compressToEncodedURIComponent(JSON.stringify(min)); const u = `${location.origin}${location.pathname}?s=${comp}`; document.getElementById('shareUrlInput').value = u; document.getElementById('shareWarning').style.display = u.length > 6000 ? 'block' : 'none'; document.getElementById('shareModal').classList.add('show'); playSound('click'); } catch (e) { toast('⚠️'); }
}
function copyShareUrl() { const i = document.getElementById('shareUrlInput'); i.select(); navigator.clipboard.writeText(i.value).then(() => { toast('📋'); closeModal('shareModal'); }); }
function loadSharedChatIfPresent() {
  const p = new URLSearchParams(location.search); const s = p.get('s'); if (!s) return false;
  try {
    const r = LZString.decompressFromEncodedURIComponent(s); if (!r) throw new Error('فشل');
    const sh = JSON.parse(r);
    currentChatId = null; chatInner.innerHTML = ''; setReadOnly(true);
    chatTitleDisplay.textContent = '🔗 ' + (sh.title || 'مشتركة');
    sh.messages.forEach(m => addMessage(m.role, m.displayText || m.content, false, -1, m.attachmentNames));
    chatContainer.scrollTop = 0;
    const b = document.createElement('div');
    b.style.cssText = 'background: linear-gradient(135deg, #f59e0b, #f97316); color: white; padding: 14px 18px; border-radius: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;';
    b.innerHTML = `<span style="font-weight:600;">👁️ محادثة مشتركة</span><button style="background:white; color:#f59e0b; border:none; padding:8px 18px; border-radius:10px; cursor:pointer; font-weight:700; font-family:inherit;">استيراد</button>`;
    b.querySelector('button').onclick = () => { const nid = Date.now().toString(); allChats[nid] = { id: nid, title: '📥 ' + (sh.title || 'مستوردة'), timestamp: Date.now(), pinned: false, messages: [{ role: "system", content: systemPrompt }, ...sh.messages] }; saveAllChats(); history.replaceState({}, '', location.pathname); b.remove(); setReadOnly(false); switchChat(nid); toast('📥'); };
    chatInner.prepend(b); return true;
  } catch (e) { alert('فشل: ' + e.message); history.replaceState({}, '', location.pathname); return false; }
}

function initSupabase() {
  if (!ENABLE_CLOUD_SYNC || typeof window.supabase === 'undefined') return false;
  try {
    const { createClient } = window.supabase;
    sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // 🆕 اجعله متاح globally لـ auth.js
    window.sbClient = sbClient;
    setOnlineStatus('connecting');
    return true;
  } catch (e) { console.error('Supabase init failed:', e); return false; }
}

async function sbFetch(p, o = {}) {
  const u = SUPABASE_URL + '/rest/v1/' + p;
  const r = await fetch(u, { ...o, headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal', ...(o.headers || {}) } });
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.substring(0, 200)}`); }
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function setOnlineStatus(status) {
  isOnline = (status === 'online');
  if (status === 'online') { syncDot.classList.add('online'); syncDot.style.background = '#10b981'; syncStatusText.textContent = 'متصل'; }
  else if (status === 'connecting') { syncDot.classList.remove('online'); syncDot.style.background = '#f59e0b'; syncStatusText.textContent = 'جارٍ الاتصال...'; }
  else { syncDot.classList.remove('online'); syncDot.style.background = '#ef4444'; syncStatusText.textContent = 'غير متصل'; }
}

async function pushChatToCloud(c) {
  if (!sbClient || !c) return;
  try {
    const ms = encKey ? await encryptData(c.messages) : c.messages;
    const row = {
      id: c.id,
      device_id: deviceId,
      title: c.title,
      pinned: !!c.pinned,
      timestamp: c.timestamp,
      messages: ms
    };
    if (currentUserId) row.user_id = currentUserId;
    await sbClient.from('chats').upsert(row);
    setOnlineStatus('online');
  } catch (e) { setOnlineStatus('offline'); }
}

async function deleteChatFromCloud(id) { if (!sbClient) return; try { await sbClient.from('chats').delete().eq('id', id); } catch (e) {} }

async function pullAllFromCloud(silent = false) {
  if (!sbClient) return;
  try {
    let query = sbClient.from('chats').select('*');
    if (currentUserId) {
      // مسجل دخول → فقط محادثات المستخدم
      query = query.eq('user_id', currentUserId);
    } else {
      // زائر → حسب الإعداد
      const scope = localStorage.getItem('syncScope') || 'device';
      if (scope === 'device') query = query.eq('device_id', deviceId);
    }
    const { data, error } = await query;
    if (error) throw error;
    let m = 0;
    for (const row of (data || [])) {
      let ms = row.messages;
      if (typeof ms === 'string' && ms.startsWith('ENC:')) { try { ms = await decryptData(ms); } catch (e) { continue; } }
      const l = allChats[row.id];
      if (!l || row.timestamp > l.timestamp) { allChats[row.id] = { id: row.id, title: row.title, pinned: row.pinned, timestamp: row.timestamp, messages: ms }; m++; }
    }
    if (m > 0) { localStorage.setItem('allChats', JSON.stringify(allChats)); renderSidebar(); if (currentChatId && allChats[currentChatId]) switchChat(currentChatId); if (!silent) toast(`☁️ ${m}`); }
    setOnlineStatus('online');
  } catch (e) { setOnlineStatus('offline'); }
}

function subscribeRealtime() {
  if (!sbClient) return;
  if (realtimeChannel) sbClient.removeChannel(realtimeChannel);
  realtimeChannel = sbClient.channel('chats-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, async (payload) => {
    const row = payload.new || payload.old; if (!row) return;

    // فلترة حسب المستخدم / الجهاز
    if (currentUserId) {
      if (row.user_id && row.user_id !== currentUserId) return;
    } else {
      const scope = localStorage.getItem('syncScope') || 'device';
      if (scope === 'device' && row.device_id && row.device_id !== deviceId) return;
      if (scope === 'all' && row.device_id === deviceId) return;
    }

    if (payload.eventType === 'DELETE') { delete allChats[row.id]; unreadChats.delete(row.id); localStorage.setItem('allChats', JSON.stringify(allChats)); localStorage.setItem('unreadChats', JSON.stringify([...unreadChats])); renderSidebar(); if (currentChatId === row.id) { const r = Object.keys(allChats); if (r.length > 0) switchChat(r[0]); else createNewChat(); } }
    else {
      let ms = row.messages;
      if (typeof ms === 'string' && ms.startsWith('ENC:')) { try { ms = await decryptData(ms); } catch (e) { return; } }
      const l = allChats[row.id];
      if (!l || row.timestamp > l.timestamp) {
        const nw = !l || (ms.length > (l.messages?.length || 0));
        allChats[row.id] = { id: row.id, title: row.title, pinned: row.pinned, timestamp: row.timestamp, messages: ms };
        localStorage.setItem('allChats', JSON.stringify(allChats));
        if (nw) { const last = ms[ms.length - 1]; if (last && last.role !== 'system') { showDesktopNotification('🤖 رد جديد', (last.content || '').substring(0, 120), row.id); if (row.id !== currentChatId) markAsUnread(row.id); } }
        renderSidebar(); if (currentChatId === row.id) switchChat(row.id);
      }
    }
  }).subscribe(s => {
    if (s === 'SUBSCRIBED') setOnlineStatus('online');
    else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setOnlineStatus('offline');
    else if (s === 'CLOSED') setOnlineStatus('connecting');
  });
}

function syncWithCloud() {
  if (!ENABLE_CLOUD_SYNC || !sbClient) { document.getElementById('syncContent').innerHTML = `<p>⚠️</p>`; document.getElementById('doSyncBtn').style.display = 'none'; }
  else {
    document.getElementById('syncContent').innerHTML = `<div style="padding:16px; background:var(--bg-tertiary); border-radius:14px; font-size:13.5px; line-height:1.9; border:1px solid var(--border-light);"><p>🆔 ${deviceId}</p><p>📊 ${Object.keys(allChats).length}</p><p>🔐 ${encKey ? 'مفعّل' : 'معطّل'}</p><p>🤖 الوكيل: <b style="color:${agentMode ? '#10b981' : '#94a3b8'};">${agentMode ? 'مفعّل' : 'معطّل'}</b></p></div>`;
    document.getElementById('doSyncBtn').style.display = 'inline-block';
  }
  document.getElementById('syncModal').classList.add('show');
}

async function doSync() {
  const b = document.getElementById('doSyncBtn'); b.disabled = true; b.textContent = '⏳...'; const log = [];
  try {
    const lc = Object.values(allChats);
    if (lc.length > 0) { for (const c of lc) { const ms = encKey ? await encryptData(c.messages) : c.messages; const row = { id: c.id, device_id: deviceId, title: c.title, pinned: !!c.pinned, timestamp: c.timestamp, messages: ms }; if (currentUserId) row.user_id = currentUserId; await sbFetch('chats', { method: 'POST', body: JSON.stringify(row) }); } log.push(`✅ ${lc.length}`); }
    const cr = await sbFetch('chats?select=*'); log.push(`📥 ${cr.length}`);
    let m = 0, f = 0;
    for (const r of cr) { let ms = r.messages; if (typeof ms === 'string' && ms.startsWith('ENC:')) { try { ms = await decryptData(ms); } catch (e) { f++; continue; } } const l = allChats[r.id]; if (!l || r.timestamp > l.timestamp) { allChats[r.id] = { id: r.id, title: r.title, pinned: r.pinned, timestamp: r.timestamp, messages: ms }; m++; } }
    localStorage.setItem('allChats', JSON.stringify(allChats)); renderSidebar(); log.push(`🔄 ${m}`); if (f > 0) log.push(`⚠️ ${f}`); log.push('🎉');
    setOnlineStatus('online');
  } catch (e) { log.push('❌ ' + e.message); setOnlineStatus('offline'); }
  finally { b.disabled = false; b.textContent = '🔄'; document.getElementById('syncContent').innerHTML = `<div style="padding:16px; background:var(--bg-tertiary); border-radius:14px; font-size:13px; line-height:1.9;">${log.join('<br>')}</div>`; }
}

function download(f, c) { const b = new Blob([c], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = f; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }
function exportAllData() { download(`ai-chat-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ version: 1, exportDate: new Date().toISOString(), systemPrompt, chats: allChats, memory: userMemory }, null, 2)); }
function exportCurrentChat() {
  if (!currentChatId) return;
  const c = allChats[currentChatId];
  let md = `# ${c.title}\n\n**تاريخ:** ${new Date(c.timestamp).toLocaleString('ar-EG')}\n\n---\n\n`;
  c.messages.forEach(m => { if (m.role === 'system') return; if (m.role === 'user') { md += `## 👤\n\n`; if (m.attachmentNames) m.attachmentNames.forEach(n => md += `> 📎 ${n}\n`); md += `${m.displayText || m.content}\n\n`; } else { md += `## 🤖\n\n${m.content}\n\n`; } });
  const st = c.title.replace(/[^\w\u0600-\u06FF\s-]/g, '').trim().substring(0, 40) || 'chat';
  download(`${st}.md`, md);
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { try { const d = JSON.parse(ev.target.result); if (!d.chats) throw new Error('غير صالح'); if (!confirm(`${Object.keys(d.chats).length}`)) return; Object.assign(allChats, d.chats); if (d.systemPrompt) { systemPrompt = d.systemPrompt; localStorage.setItem('systemPrompt', systemPrompt); } if (d.memory && Array.isArray(d.memory)) { userMemory = d.memory; saveMemory(); } localStorage.setItem('allChats', JSON.stringify(allChats)); renderSidebar(); alert('✅'); } catch (er) { alert('فشل: ' + er.message); } e.target.value = ''; };
  r.readAsText(f);
}

window.addEventListener('online', () => { offlineBadge.style.display = 'none'; toast('🌐'); pullAllFromCloud(true); });
window.addEventListener('offline', () => { offlineBadge.style.display = 'inline-flex'; toast('📴'); });
if (!navigator.onLine) offlineBadge.style.display = 'inline-flex';
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentChatId) markAsRead(currentChatId); });
window.addEventListener('focus', () => { if (currentChatId) markAsRead(currentChatId); });

async function init() {
  initTheme();
  if (loadSharedChatIfPresent()) return;
  await initEncryption();
  updateNotifUI();

  Object.keys(allChats).forEach(id => {
    const c = allChats[id];
    if (c && c.title === 'محادثة جديدة' &&
        c.messages.filter(m => m.role !== 'system').length === 0) {
      delete allChats[id];
    }
  });
  localStorage.removeItem('lastChatId');
  localStorage.setItem('allChats', JSON.stringify(allChats));

  renderSidebar();
  renderTemplates();
  createNewChat();

  if (initSupabase()) {
    await pullAllFromCloud(true);
    subscribeRealtime();
    setInterval(() => pullAllFromCloud(true), AUTO_SYNC_INTERVAL_MS);
  } else setOnlineStatus('offline');
}
init();