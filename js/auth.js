// ═══════════════════════════════════════════════════════
// AUTH — تسجيل الدخول / حساب جديد (بدون وضع زائر)
// ═══════════════════════════════════════════════════════
(function auth() {
  'use strict';

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
        options: { emailRedirectTo: 'https://ai-chat-app-two-lime.vercel.app' }
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
        redirectTo: 'https://ai-chat-app-two-lime.vercel.app'
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
    // إذا ما فيه sbClient، اجبر عرض الشاشة
    if (!window.sbClient) {
      console.warn('⚠️ Supabase غير جاهز');
      showAuthScreen();
      return;
    }

    // افحص الجلسة الحالية
    try {
      const { data } = await window.sbClient.auth.getSession();
      if (data?.session?.user) {
        currentUser = data.session.user;
        await onLoggedIn(currentUser);
      } else {
        // 🔒 لا يوجد تسجيل دخول — اعرض الشاشة فورًا
        showAuthScreen();
      }
    } catch (e) {
      showAuthScreen();
    }

    // استمع للتغييرات
    window.sbClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
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
    updateUserCard(user);
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

    // 🔒 زر الزائر معطّل
    const guestBtn = document.getElementById('guestBtn');
    if (guestBtn) {
      guestBtn.onclick = () => {
        if (typeof toast === 'function') toast('🔒 يرجى تسجيل الدخول أولًا');
      };
      guestBtn.style.opacity = '0.5';
      guestBtn.style.cursor = 'not-allowed';
    }
  }

  // تسجيل الخروج
  window.handleLogout = async function () {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    await signOut();
    if (typeof toast === 'function') toast('👋 تم تسجيل الخروج');
    setTimeout(() => window.location.reload(), 800);
  };

  // ═══════ USER CARD ═══════
  function updateUserCard(user) {
    const card = document.getElementById('userCard');
    const avatar = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    if (!card || !user) return;

    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || user.email?.split('@')[0] || 'مستخدم';
    const email = user.email || '';
    const avatarUrl = meta.avatar_url || meta.picture || '';

    // Avatar
    if (avatarUrl) {
      avatar.innerHTML = '<img src="' + avatarUrl + '" alt="" />';
    } else {
      avatar.textContent = fullName.charAt(0).toUpperCase();
    }

    nameEl.textContent = fullName;
    emailEl.textContent = email;
    card.style.display = 'flex';

    // زر القائمة
    const menuBtn = document.getElementById('userMenuBtn');
    if (menuBtn && !menuBtn.__wired) {
      menuBtn.__wired = true;
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        openUserDropdown(menuBtn, user);
      };
    }
  }

  function openUserDropdown(anchor, user) {
    // إذا موجود → أغلقه
    let dd = document.getElementById('userDropdown');
    if (dd) { dd.remove(); return; }

    const rect = anchor.getBoundingClientRect();
    dd = document.createElement('div');
    dd.id = 'userDropdown';
    dd.className = 'user-dropdown';
    dd.innerHTML = `
      <button class="user-dropdown-item" id="ddCopyEmail">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>نسخ البريد الإلكتروني</span>
      </button>
      <button class="user-dropdown-item" id="ddSettings">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>
        <span>الإعدادات</span>
      </button>
      <div class="user-dropdown-divider"></div>
      <button class="user-dropdown-item danger" id="ddLogout">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        <span>تسجيل الخروج</span>
      </button>
    `;
    document.body.appendChild(dd);

    // الموضع — فوق الزر مباشرة
    const ddRect = dd.getBoundingClientRect();
    dd.style.top = Math.max(8, rect.top - ddRect.height - 8) + 'px';
    dd.style.left = rect.left + 'px';

    requestAnimationFrame(() => dd.classList.add('show'));

    // الأحداث
    dd.querySelector('#ddCopyEmail').onclick = () => {
      navigator.clipboard.writeText(user.email || '').then(() => {
        if (typeof toast === 'function') toast('📋 تم نسخ البريد');
        dd.remove();
      });
    };
    dd.querySelector('#ddSettings').onclick = () => {
      dd.remove();
      if (typeof openSettings === 'function') openSettings();
    };
    dd.querySelector('#ddLogout').onclick = () => {
      dd.remove();
      window.handleLogout();
    };

    // إغلاق عند الضغط خارجًا
    setTimeout(() => {
      const close = (e) => {
        if (!dd.contains(e.target) && e.target !== anchor) {
          dd.classList.remove('show');
          setTimeout(() => dd.remove(), 250);
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 100);
  }

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