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
    if (!window.sbClient) return;
    try {
      await window.sbClient.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        device_id: (typeof deviceId !== 'undefined' ? deviceId : 'unknown'),
        subscription: sub,
        created_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
    } catch (e) { console.warn('Save sub failed', e); }
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
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { if (typeof toast === 'function') toast('⚠️ يرفض'); return; }
    }
    const res = await subscribeUser();
    if (!res.ok) { if (typeof toast === 'function') toast('❌ ' + res.error); return; }
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
      if (r.ok) { if (typeof toast === 'function') toast('✅ تم إرسال الإشعار'); }
      else { if (typeof toast === 'function') toast('❌ فشل الإرسال'); }
    } catch (e) { if (typeof toast === 'function') toast('❌ فشل الاتصال'); }
  }

  window.pushSubscribe = subscribeUser;
  window.pushUnsubscribe = unsubscribeUser;
  window.pushTest = testPush;

  // تلقائياً عند التحميل: إذا كان مسموح من قبل، أعد التسجيل
  if ('Notification' in window && Notification.permission === 'granted') {
    setTimeout(() => subscribeUser().catch(() => {}), 5000);
  }

  console.log('🔔 Push ready (VAPID ' + (VAPID_PUBLIC_KEY.startsWith('REPLACE') ? 'NOT set' : 'set') + ')');
})();