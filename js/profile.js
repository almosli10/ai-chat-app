// js/profile.js — إدارة الملف الشخصي

// ═══════ دالة تطبيق الخط ═══════
function applyFont(fontName) {
  const fontMap = {
    'cairo': 'Cairo',
    'tajawal': 'Tajawal',
    'ibm-plex': 'IBM Plex Sans Arabic'
  };
  const fontFamily = fontMap[fontName] || 'Cairo';
  const linkId = 'dynamic-google-font';
  
  // إزالة الرابط القديم إن وجد
  const oldLink = document.getElementById(linkId);
  if (oldLink) oldLink.remove();
  
  // إضافة رابط الخط الجديد من Google Fonts
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
  
  // تطبيق الخط على كامل الصفحة
  document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
  document.documentElement.style.setProperty('--font-main', `'${fontFamily}', sans-serif`);
  
  localStorage.setItem('font', fontName);
}

async function loadProfile() {
  const supabase = window.sbClient;
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) { console.warn('profile:', error.message); return null; }
  return { ...data, email: user.email };
}

async function updateProfile({ full_name, bio, theme, font }) {
  const supabase = window.sbClient;
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. تحديث جدول profiles
  const { error } = await supabase
    .from('profiles')
    .update({ full_name, bio, theme, font, updated_at: new Date() })
    .eq('id', user.id);
  if (error) throw error;

  // 2. تحديث بيانات المصادقة (user_metadata) لكي يظهر الاسم في القائمة الجانبية
  await supabase.auth.updateUser({
    data: { full_name: full_name }
  });
}

async function uploadAvatar(file) {
  const supabase = window.sbClient;
  const { data: { user } } = await supabase.auth.getUser();
  const ext = file.name.split('.').pop();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars').getPublicUrl(path);

  // 1. تحديث جدول profiles
  await supabase.from('profiles')
    .update({ avatar_url: publicUrl }).eq('id', user.id);

  // 2. تحديث بيانات المصادقة بالصورة الجديدة
  await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });

  return publicUrl;
}

async function changePassword(newPassword) {
  const supabase = window.sbClient;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function deleteAccount() {
  const supabase = window.sbClient;
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (!res.ok) throw new Error('فشل حذف الحساب');
  await supabase.auth.signOut();
}

function renderProfileModal(profile) {
  // تحديد الثيم والخط الحاليين
  const currentTheme = profile.theme || localStorage.getItem('theme') || 'dark';
  const currentFont = profile.font || localStorage.getItem('font') || 'cairo';

  return `
  <div class="profile-modal" id="profileModal">
    <div class="profile-card">
      <button class="close-btn" data-close>&times;</button>
      <h2>الملف الشخصي</h2>
      <div class="avatar-section">
        <img src="${profile.avatar_url || 'assets/default-avatar.png'}" id="avatarPreview" class="avatar-preview" alt="avatar">
        <label class="avatar-upload">
          تغيير الصورة
          <input type="file" id="avatarInput" accept="image/*" hidden>
        </label>
      </div>
      <label>الاسم الكامل
        <input id="pfName" value="${profile.full_name || ''}" maxlength="60">
      </label>
      <label>نبذة
        <textarea id="pfBio" maxlength="200">${profile.bio || ''}</textarea>
      </label>
      <div class="pf-row">
        <label>الثيم
          <select id="pfTheme">
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>داكن</option>
            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>فاتح</option>
            <option value="blue-night" ${currentTheme === 'blue-night' ? 'selected' : ''}>أزرق ليلي</option>
            <option value="midnight-purple" ${currentTheme === 'midnight-purple' ? 'selected' : ''}>بنفسجي منتصف الليل</option>
            <option value="ocean-deep" ${currentTheme === 'ocean-deep' ? 'selected' : ''}>محيط عميق</option>
          </select>
        </label>
        <label>الخط
          <select id="pfFont">
            <option value="cairo" ${currentFont === 'cairo' ? 'selected' : ''}>Cairo</option>
            <option value="tajawal" ${currentFont === 'tajawal' ? 'selected' : ''}>Tajawal</option>
            <option value="ibm-plex" ${currentFont === 'ibm-plex' ? 'selected' : ''}>IBM Plex Sans Arabic</option>
          </select>
        </label>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
        <button id="pfSave" class="btn-primary" style="flex: 1;">💾 حفظ التغييرات</button>
        <button onclick="document.getElementById('profileModalWrapper').remove()" style="background: #4b5563; color: white; border: none; border-radius: 10px; padding: 0.8rem 1.5rem; cursor: pointer; font-weight: bold; font-family: inherit;">إغلاق</button>
      </div>
      
      <hr>
      <section class="danger-zone">
        <h3>🔑 الأمان</h3>
        <button id="pfChangePass" class="btn-warn">تغيير كلمة المرور</button>
        <button id="pfDeleteAcc" class="btn-danger">🗑️ حذف الحساب نهائيًا</button>
      </section>
    </div>
  </div>`;
}

function bindProfileEvents(modalEl, onChange) {
  const $ = s => modalEl.querySelector(s);

  $('#avatarInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      $('#avatarPreview').src = url;
      onChange?.({ avatar_url: url });
    } catch (err) {
      alert('فشل رفع الصورة: ' + err.message);
    }
  });

  $('#pfSave').addEventListener('click', async () => {
    try {
      const themeVal = $('#pfTheme').value;
      const fontVal = $('#pfFont').value;

      await updateProfile({
        full_name: $('#pfName').value.trim(),
        bio: $('#pfBio').value.trim(),
        theme: themeVal,
        font: fontVal
      });

      // ═══════ تطبيق الثيم والخط فوراً ═══════
      if (typeof applyTheme === 'function') applyTheme(themeVal);
      applyFont(fontVal);

      onChange?.({ saved: true });
    } catch (err) {
      alert('فشل الحفظ: ' + err.message);
    }
  });

  $('#pfChangePass').addEventListener('click', async () => {
    const pw = prompt('كلمة المرور الجديدة (٦ أحرف على الأقل):');
    if (!pw || pw.length < 6) return;
    try {
      await changePassword(pw);
      alert('✅ تم تغيير كلمة المرور');
    } catch (err) {
      alert('فشل تغيير كلمة المرور: ' + err.message);
    }
  });

  $('#pfDeleteAcc').addEventListener('click', async () => {
    if (!confirm('⚠️ سيتم حذف كل محادثاتك نهائيًا. متأكد؟')) return;
    if (prompt('اكتب "حذف" للتأكيد:') !== 'حذف') return;
    try {
      await deleteAccount();
      location.reload();
    } catch (err) {
      alert('فشل حذف الحساب: ' + err.message);
    }
  });

  modalEl.querySelector('[data-close]').onclick = () => modalEl.remove();
}

// ═══════ ربط الدالة بنافذة المتصفح ═══════
window.openProfileModal = async function() {
  if (!window.sbClient) return alert('جاري الاتصال بالسيرفر... حاول مرة أخرى بعد ثانية.');
  const profile = await loadProfile();
  if (!profile) return alert('يجب تسجيل الدخول أولاً');
  
  const modal = document.createElement('div');
  modal.id = 'profileModalWrapper';
  modal.innerHTML = renderProfileModal(profile);
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      const m = document.getElementById('profileModalWrapper');
      if (m) m.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // ═══════ تحديث القائمة الجانبية فوراً ═══════
  bindProfileEvents(modal, ({ avatar_url, saved }) => {
    const avatarEl = document.getElementById('userAvatar');
    
    // 1. تحديث الصورة في القائمة الجانبية
    const previewEl = document.getElementById('avatarPreview');
    if (previewEl && avatarEl) {
      avatarEl.innerHTML = `<img src="${previewEl.src}" alt="avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;" />`;
    }

    // 2. تحديث الاسم في القائمة الجانبية
    if (saved) {
      const nameInput = document.getElementById('pfName');
      const nameEl = document.getElementById('userName');
      if (nameEl && nameInput) nameEl.textContent = nameInput.value.trim();
      
      if (typeof toast === 'function') toast('✅ تم حفظ التغييرات وتطبيقها');
      else alert('✅ تم حفظ التغييرات وتطبيقها');
    }
  });
};

// ═══════ تطبيق الخط المحفوظ عند تحميل الصفحة ═══════
document.addEventListener('DOMContentLoaded', () => {
  const savedFont = localStorage.getItem('font');
  if (savedFont) applyFont(savedFont);
});