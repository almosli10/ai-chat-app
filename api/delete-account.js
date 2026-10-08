import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  // عميل خدمي (service_role) — أضف SUPABASE_SERVICE_ROLE في Vercel
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.json({ ok: true });
}