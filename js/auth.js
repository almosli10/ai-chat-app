// ═══════════════════════════════════════════════════════
// AUTH — تسجيل الدخول / حساب جديد / ضيف
// ═══════════════════════════════════════════════════════
(function auth() {
  'use strict';

  const GUEST_MODE_KEY = 'mishkat_guest_mode';
  let currentUser = null;

  // ═══════ UI ═══════
  function showAuthScreen() {
    const el = document.getElementById('authScreen');
    if (el) el.classList.add('show');
    document.body.classList.add('auth-locked');
  }

  function hideAuthScreen() {
    const el = document.getElementById('authScreen');
    if (el) el.classList.remove('show');
    document.body.classList.remove('auth-locked');
  }

  function showError(msg) {
    const el = document.getElementById('authScreen');
    if (!el) return;
    let box = el.querySelector('.auth-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-error';
      const card = el.querySelector('.auth-card');
      if (card) card.insertBefore(box, card.firstChild);
    }
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 4500);
  }

  function showSuccess(msg) {
    const el = document.getElementById('authScreen');
    if (!el) return;
    let box = el.querySelector('.auth-success');
    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-success';
      const card = el.querySelector('.auth-card');
      if (card) card.insertBefore(box, card.firstChild);
    }
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 5000);
  }

  function setLoading(form, loading) {
    if (!form) return;
    form.querySelectorAll('input, button').forEach(el => el.disabled = loading);
    form.classList.toggle('loading', loading);
  }

  function updateUserUI() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = currentUser ? 'flex' : 'none';
  }

  // ═══════ Supabase Auth ═══════
  async function signIn(email, password) {
    if (!window.sbClient) {
      return { error: { message: 'الاتصال بالسيرفر غير متاح' } };
    }
    try {
      const { data, error } = await window.sbClient.auth.signInWithPassword({ email, password });
      if (error) return { error };
      return { data };
    } catch (e) { return { error: { message: e.message } }; }
  }

  async function signUp(email, password) {
    if (!window.sbClient) {
      return { error: { message: 'الاتصال بالسيرفر غير متاح' } };
    }
    try {
      const { data, error } = await window.sbClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) return { error };
      return { data };
    } catch (e) { return { error: { message: e.message } }; }
  }

  async function signInWithGoogle() {
    if (!window.sbClient) return;
    try {
      await window.sbClient.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://ai-chat-app-two-lime.vercel.app'
  }
});
    } catch (e) {
      showError('فشل تسجيل الدخول بـ Google: ' + e.message);
    }
  }

  async function resetPassword(email) {
    if (!window.sbClient) return { error: { message: 'الاتصال غير متاح' } };
    try {
      const { error } = await window.sbClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      return { error };
    } catch (e) { return { error: { message: e.message } }; }
  }

  async function signOut() {
    if (!window.sbClient) return;
    try {
      await window.sbClient.auth.signOut();
    } catch (e) {}
  }

  // ═══════ Main Flow ═══════
  async function initAuth() {
    // إذا ما فيه sbClient، اسمح بالمرور
    if (!window.sbClient) {
      console.warn('⚠️ Supabase غير جاهز — تجاوز Auth');
      hideAuthScreen();
      return;
    }

    // إذا كان في وضع الزائر
    if (localStorage.getItem(GUEST_MODE_KEY) === '1') {
      hideAuthScreen();
      return;
    }

    // افحص الجلسة الحالية
    try {
      const { data } = await window.sbClient.auth.getSession();
      if (data?.session?.user) {
        currentUser = data.session.user;
        await onLoggedIn(currentUser);
      } else {
        showAuthScreen();
      }
    } catch (e) {
      showAuthScreen();
    }

    // استمع للتغييرات
    window.sbClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        // لا تعيد التحميل عند OAuth callback إذا كان المستخدم بالفعل متصل
        await onLoggedIn(currentUser);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateUserUI();
        showAuthScreen();
      }
    });
  }

  async function onLoggedIn(user) {
    // خزّن user_id في app.js
    if (typeof window.setCurrentUserId === 'function') {
      window.setCurrentUserId(user.id);
    }
    updateUserUI();
    hideAuthScreen();

    // أعد المزامنة مع user_id
    setTimeout(() => {
      try {
        if (typeof pullAllFromCloud === 'function') pullAllFromCloud(true);
        if (typeof subscribeRealtime === 'function') subscribeRealtime();
      } catch (e) {}
    }, 500);

    if (typeof toast === 'function') {
      setTimeout(() => toast('👋 أهلًا ' + (user.email?.split('@')[0] || 'بك'), 2500), 800);
    }
  }

  // ═══════ Handlers ═══════
  function wireUp() {
    // التبويبات
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    tabs.forEach(tab => {
      tab.onclick = () => {
        const name = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        forms.forEach(f => f.style.display = f.dataset.view === name ? 'flex' : 'none');
      };
    });

    // تسجيل الدخول
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) return;
        setLoading(loginForm, true);
        const { error } = await signIn(email, password);
        setLoading(loginForm, false);
        if (error) {
          const msg = error.message.includes('Invalid') ? 'البريد أو كلمة المرور غير صحيحة' :
                      error.message.includes('Email not confirmed') ? 'يرجى تأكيد بريدك الإلكتروني أولًا' :
                      error.message;
          showError(msg);
          if (typeof playSound === 'function') playSound('error');
        }
      };
    }

    // حساب جديد
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const password2 = document.getElementById('signupPassword2').value;
        if (!email || !password) return;
        if (password !== password2) {
          showError('كلمتا المرور غير متطابقتين');
          return;
        }
        if (password.length < 6) {
          showError('كلمة المرور قصيرة (6 أحرف على الأقل)');
          return;
        }
        setLoading(signupForm, true);
        const { data, error } = await signUp(email, password);
        setLoading(signupForm, false);
        if (error) {
          const msg = error.message.includes('already') ? 'هذا البريد مسجّل من قبل' :
                      error.message;
          showError(msg);
          return;
        }
        // إذا يحتاج تأكيد إيميل
        if (data && !data.session) {
          showSuccess('✅ تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد الحساب.');
          if (typeof playSound === 'function') playSound('notif');
        }
      };
    }

    // نسيت كلمة المرور
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
      forgotBtn.onclick = async () => {
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
          showError('أدخل بريدك الإلكتروني أولًا');
          return;
        }
        const { error } = await resetPassword(email);
        if (error) showError(error.message);
        else showSuccess('📧 تم إرسال رابط الاستعادة إلى بريدك');
      };
    }

    // Google
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.onclick = signInWithGoogle;

    // زائر
    const guestBtn = document.getElementById('guestBtn');
    if (guestBtn) {
      guestBtn.onclick = () => {
        localStorage.setItem(GUEST_MODE_KEY, '1');
        hideAuthScreen();
        if (typeof toast === 'function') toast('👋 مرحبًا بك كزائر');
      };
    }
  }

  // تسجيل الخروج (يُستدعى من الزر)
  window.handleLogout = async function () {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    localStorage.removeItem(GUEST_MODE_KEY);
    await signOut();
    if (typeof toast === 'function') toast('👋 تم تسجيل الخروج');
    setTimeout(() => window.location.reload(), 800);
  };

  // ═══════ Init ═══════
  function tryInit(retries = 40) {
    if (!window.sbClient) {
      if (retries > 0) return setTimeout(() => tryInit(retries - 1), 300);
    }
    wireUp();
    initAuth();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tryInit(), { once: true });
  } else {
    tryInit();
  }

  console.log('🔐 Auth ready');
})();