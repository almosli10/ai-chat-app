// js/profile.js — إدارة الملف الشخصي
const supabase = window.sbClient;

async function loadProfile() {
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
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name, bio, theme, font, updated_at: new Date() })
    .eq('id', user.id);
  if (error) throw error;
}

async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const ext = file.name.split('.').pop();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars').getPublicUrl(path);

  await supabase.from('profiles')
    .update({ avatar_url: publicUrl }).eq('id', user.id);

  return publicUrl;
}

async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (!res.ok) throw new Error('فشل حذف الحساب');
  await supabase.auth.signOut();
}

function renderProfileModal(profile) {
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
            <option value="dark">داكن</option>
            <option value="light">فاتح</option>
            <option value="blue-night">أزرق ليلي</option>
          </select>
        </label>
        <label>الخط
          <select id="pfFont">
            <option value="cairo">Cairo</option>
            <option value="tajawal">Tajawal</option>
            <option value="ibm-plex">IBM Plex Sans Arabic</option>
          </select>
        </label>
      </div>
      <button id="pfSave" class="btn-primary">💾 حفظ التغييرات</button>
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
    const url = await uploadAvatar(file);
    $('#avatarPreview').src = url;
    onChange?.({ avatar_url: url });
  });

  $('#pfSave').addEventListener('click', async () => {
    await updateProfile({
      full_name: $('#pfName').value.trim(),
      bio: $('#pfBio').value.trim(),
      theme: $('#pfTheme').value,
      font: $('#pfFont').value
    });
    onChange?.({ saved: true });
  });

  $('#pfChangePass').addEventListener('click', async () => {
    const pw = prompt('كلمة المرور الجديدة (٦ أحرف على الأقل):');
    if (!pw || pw.length < 6) return;
    await changePassword(pw);
    alert('✅ تم تغيير كلمة المرور');
  });

  $('#pfDeleteAcc').addEventListener('click', async () => {
    if (!confirm('⚠️ سيتم حذف كل محادثاتك نهائيًا. متأكد؟')) return;
    if (prompt('اكتب "حذف" للتأكيد:') !== 'حذف') return;
    await deleteAccount();
    location.reload();
  });

  modalEl.querySelector('[data-close]').onclick = () => modalEl.remove();
}

// ═══════ ربط الدالة بنافذة المتصفح ═══════
window.openProfileModal = async function() {
  const profile = await loadProfile();
  if (!profile) return alert('يجب تسجيل الدخول أولاً');
  
  const modal = document.createElement('div');
  modal.innerHTML = renderProfileModal(profile);
  document.body.appendChild(modal);
  
  bindProfileEvents(modal, ({ avatar_url, saved }) => {
    if (avatar_url) {
      document.querySelectorAll('.user-avatar, #userAvatar img').forEach(el => el.src = avatar_url);
    }
    if (saved) {
      if (typeof toast === 'function') toast('✅ تم الحفظ بنجاح');
      else alert('✅ تم الحفظ بنجاح');
    }
  });
};