// api/admin-auth.js — التحقق من صلاحيات المشرف
// ⚠️ ملاحظة: هذا الملف غير مستخدم حاليًا.
// دالة verifyAdmin مدمجة داخل api/admin.js مباشرة.
// يمكن حذفه لاحقًا، لكنه محفوظ للمرجعية.
import { createClient } from '@supabase/supabase-js';

export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return { ok: false, error: 'No token', code: 401 };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_USER_ID) {
    return { ok: false, error: 'Server config missing', code: 500 };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // التحقق من التوكن
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { ok: false, error: 'Invalid token', code: 401 };
  }

  if (user.id !== ADMIN_USER_ID) {
    return { ok: false, error: 'Not an admin', code: 403 };
  }

  return { ok: true, user, supabase };
}