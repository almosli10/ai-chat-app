// ═══ قالب موحد بأسلوب inline styles لضمان الظهور في كل برامج البريد ═══
function emailWrapper(content) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family: 'Helvetica Neue', Arial, Tahoma, sans-serif; background-color: #0d0819;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0d0819; padding: 30px 15px;">
        <tr><td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: linear-gradient(160deg, #1a0f33, #0d0819); border: 1px solid rgba(251,191,36,0.3); border-radius: 20px; overflow: hidden;">
            <tr><td style="padding: 30px;">
              ${content}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
// lib/send-email.js — إرسال إشعارات البريد عبر Resend
const RESEND_API = 'https://api.resend.com/emails';
const ADMIN_EMAIL = 'tabbymike80@gmail.com';
const FROM_EMAIL = 'Mishkat <onboarding@resend.dev>'; // ← مؤقت، يمكن استبداله بنطاقك

export async function sendAdminEmail({ subject, html }) {
  const API_KEY = process.env.RESEND_API_KEY;
  if (!API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set');
    return { ok: false, error: 'missing key' };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: subject,
        html: html
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', data);
      return { ok: false, error: data.message || 'send failed' };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    console.error('Email error:', err);
    return { ok: false, error: err.message };
  }
}

// ═══ قالب: طلب دفع جديد ═══
export function buildNewPaymentEmail({ plan, amount, email, txId, orderId }) {
  const planName = plan === 'pro' ? 'احترافي ⭐' : 'بريميوم 💎';
  const shortTx = txId.substring(0, 30) + '...';
  
  return {
    subject: `🔔 طلب دفع جديد: ${planName} - $${amount}`,
    html: `
      <div style="font-family: 'IBM Plex Sans Arabic', Arial; direction: rtl; background: #0d0819; padding: 30px; color: #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(160deg, #1a0f33, #0d0819); border: 1px solid rgba(251,191,36,0.3); border-radius: 20px; padding: 30px;">
          <h1 style="color: #fbbf24; margin: 0 0 20px; font-size: 22px;">🔔 طلب دفع جديد</h1>
          
          <div style="background: rgba(251,191,36,0.08); border-radius: 14px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #fbbf24;">الباقة:</strong> ${planName}</p>
            <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #fbbf24;">المبلغ:</strong> $${amount} USDT</p>
            <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #fbbf24;">البريد:</strong> ${email}</p>
            <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #fbbf24;">TX ID:</strong> <code style="background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 6px; font-size: 12px;">${shortTx}</code></p>
            <p style="margin: 8px 0; font-size: 15px;"><strong style="color: #fbbf24;">رقم الطلب:</strong> ${orderId}</p>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://ai-chat-app-two-lime.vercel.app/admin.html" 
               style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #ec4899); color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px;">
              🔍 افتح لوحة التحكم
            </a>
          </div>
          
          <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 24px;">
            هذا إشعار تلقائي من مِشكاة
          </p>
        </div>
      </div>
    `
  };
}

// ═══ قالب: تم تأكيد الدفع ═══
export function buildPaymentConfirmedEmail({ plan, amount, email }) {
  const planName = plan === 'pro' ? 'احترافي ⭐' : 'بريميوم 💎';
  
  return {
    subject: `✅ تم تأكيد دفع - ${email}`,
    html: `
      <div style="font-family: 'IBM Plex Sans Arabic', Arial; direction: rtl; background: #0d0819; padding: 30px; color: #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(160deg, #1a0f33, #0d0819); border: 1px solid rgba(16,185,129,0.4); border-radius: 20px; padding: 30px;">
          <h1 style="color: #10b981; margin: 0 0 20px; font-size: 22px;">✅ تم تأكيد الدفع</h1>
          
          <div style="background: rgba(16,185,129,0.08); border-radius: 14px; padding: 20px;">
            <p style="margin: 8px 0;"><strong style="color: #6ee7b7;">البريد:</strong> ${email}</p>
            <p style="margin: 8px 0;"><strong style="color: #6ee7b7;">الباقة:</strong> ${planName}</p>
            <p style="margin: 8px 0;"><strong style="color: #6ee7b7;">المبلغ:</strong> $${amount} USDT</p>
            <p style="margin: 8px 0; font-size: 13px; color: #94a3b8;">تم ترقية المستخدم بنجاح ✅</p>
          </div>
        </div>
      </div>
    `
  };
}