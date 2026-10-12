// ═══════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — إشعارات حقيقية عبر Web Push
// ═══════════════════════════════════════════════════════
(function pushNotifications() {
  'use strict';

  // ⚠️ غيّر هذا المفتاح بعد توليده (انظر التعليمات في الأسفل)
  const VAPID_PUBLIC_KEY = 'BN2tCrh-60fJ79gGSPr-zK1pAq7H9XE8E3XEXhLsSt5bMLvuDyJBu1w9cVIQE4domVnPNBBBb-yJGIKGr-0Ex2I';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function subscribeUser() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, error: 'Push غير مدعوم' };
    }
    if (VAPID_PUBLIC_KEY.startsWith('REPLACE')) {
      return { ok: false, error: 'لم يتم إعداد VAPID key بعد' };
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      // خزّن في Supabase
      const raw = sub.toJSON();
      await saveSubscription(raw);
      return { ok: true, subscription: raw };
    } catch (e) {
      console.warn('Push subscribe failed', e);
      return { ok: false, error: e.message };
    }
  }

  async function saveSubscription(sub) {
    if (!window.sbClient) {
      console.warn('⚠️ sbClient not ready');
      return false;
    }
    
    // 🔍 احصل على user_id الحالي
    let userId = null;
    try {
      const { data: { user } } = await window.sbClient.auth.getUser();
      userId = user?.id || null;
    } catch (e) {
      console.warn('getUser failed:', e);
    }
    
    if (!userId) {
      console.warn('⚠️ No user logged in — cannot save subscription');
      return false;
    }
    
    try {
      // ✅ استخدم upsert مع user_id
      const { error } = await window.sbClient.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        device_id: (typeof deviceId !== 'undefined' ? deviceId : 'unknown'),
        user_id: userId,
        subscription: sub,
        created_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      
      if (error) {
        console.error('❌ Supabase upsert error:', error);
        return false;
      }
      
      console.log('✅ Subscription saved to Supabase');
      return true;
    } catch (e) {
      console.error('❌ Save sub exception:', e);
      return false;
    }
  }

  async function unsubscribeUser() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        if (window.sbClient) {
          await window.sbClient.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // اختبار إشعار من السيرفر
  async function testPush() {
    if (!('Notification' in window)) {
      if (typeof toast === 'function') toast('⚠️ غير مدعوم');
      return;
    }
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { 
        if (typeof toast === 'function') toast('⚠️ رفض الإذن'); 
        return; 
      }
    }
    
    if (typeof toast === 'function') toast('⏳ جاري الاشتراك...');
    
    const res = await subscribeUser();
    if (!res.ok) { 
      if (typeof toast === 'function') toast('❌ ' + res.error); 
      return; 
    }
    
    if (typeof toast === 'function') toast('⏳ جاري الإرسال...');
    
    try {
      const r = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: (typeof deviceId !== 'undefined' ? deviceId : 'unknown'),
          title: '🏮 مِشكاة',
          body: 'هذا اختبار للإشعارات الحقيقية!',
          url: '/'
        })
      });
      
      const data = await r.json();
      
      // ✅ افحص عدد الإشعارات المُرسلة فعليًا
      if (data.sent > 0) {
        if (typeof toast === 'function') toast(`✅ تم إرسال ${data.sent} إشعار`);
      } else if (data.total === 0) {
        if (typeof toast === 'function') toast('❌ لا يوجد اشتراك محفوظ في السيرفر');
        console.warn('Push subscriptions empty!');
      } else {
        if (typeof toast === 'function') toast(`⚠️ فشل الإرسال (${data.failed || 0}/${data.total})`);
      }
    } catch (e) { 
      if (typeof toast === 'function') toast('❌ فشل الاتصال');
      console.error(e);
    }
  }

    // 🔔 إرسال إشعار لنفس المستخدم (عبر كل أجهزته)
  async function notifySelf(options = {}) {
    if (!window.sbClient) return { ok: false, error: 'Supabase not ready' };
    
    try {
      const { data: { user } } = await window.sbClient.auth.getUser();
      if (!user) return { ok: false, error: 'No user' };
      
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: options.title || '🏮 مِشكاة',
          body: options.body || '',
          url: options.url || '/',
          tag: options.tag
        })
      });
      
      if (!res.ok) throw new Error('Push failed: ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('notifySelf failed:', e);
      return { ok: false, error: e.message };
    }
  }

    // 🔔 زر "تفعيل Push" من داخل النافذة
  window.pushSubscribeNow = async function() {
    if (typeof toast === 'function') toast('⏳ جاري التفعيل...');
    const res = await subscribeUser();
    if (res.ok) {
      if (typeof toast === 'function') toast('✅ تم تفعيل إشعارات Push!');
      checkPushStatus();
    } else {
      if (typeof toast === 'function') toast('❌ ' + (res.error || 'فشل التفعيل'));
    }
  };
  
  // 🔍 فحص حالة Push
  async function checkPushStatus() {
    const box = document.getElementById('pushStatusBox');
    if (!box) return;
    
    if (!('Notification' in window)) {
      box.innerHTML = '⛔ غير مدعوم في متصفحك';
      box.style.color = '#f87171';
      return;
    }
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      box.innerHTML = '⛔ Push غير مدعوم';
      box.style.color = '#f87171';
      return;
    }
    
    if (Notification.permission === 'denied') {
      box.innerHTML = '❌ الإذن مرفوض. فعّله من إعدادات المتصفح';
      box.style.color = '#f87171';
      return;
    }
    
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      
      if (sub) {
        box.innerHTML = '✅ مشترك في الإشعارات';
        box.style.color = '#6ee7b7';
        box.style.background = 'rgba(16,185,129,0.15)';
      } else {
        box.innerHTML = '⚠️ غير مشترك — اضغط "تفعيل Push"';
        box.style.color = '#fbbf24';
        box.style.background = 'rgba(245,158,11,0.15)';
      }
    } catch (e) {
      box.innerHTML = '⚠️ خطأ: ' + e.message;
      box.style.color = '#fbbf24';
    }
  }
  
  window.checkPushStatus = checkPushStatus;
  
  // فحص تلقائي عند فتح نافذة الإشعارات
  document.addEventListener('click', (e) => {
    if (e.target.closest('button[onclick*="openNotifications"]')) {
      setTimeout(checkPushStatus, 400);
    }
  }, true);

  window.pushSubscribe = subscribeUser;
  window.pushUnsubscribe = unsubscribeUser;
  window.pushTest = testPush;
  window.notifySelf = notifySelf;
  // تلقائياً عند التحميل: إذا كان مسموح من قبل، أعد التسجيل
  if ('Notification' in window && Notification.permission === 'granted') {
    setTimeout(() => subscribeUser().catch(() => {}), 5000);
  }

  console.log('🔔 Push ready (VAPID ' + (VAPID_PUBLIC_KEY.startsWith('REPLACE') ? 'NOT set' : 'set') + ')');
})();