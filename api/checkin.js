import { admin, user, ok, fail, body } from './_core.js';

export default async function handler(req, res) {
  const sb = admin();
  try {
    const u = await user(req);

    if (req.method === 'GET') {
      const [{ data: p }, { data: hits }, { data: settings }] = await Promise.all([
        sb.from('profiles').select('streak_days,longest_streak,last_checkin').eq('id', u.id).single(),
        sb.from('checkins').select('checkin_date,total_amount,streak_at_time').eq('user_id', u.id).order('checkin_date', { ascending: false }).limit(62),
        sb.from('settings').select('key,value').in('key', ['checkin_bonus', 'streak_7', 'streak_14', 'streak_30'])
      ]);
      const s = {}; (settings || []).forEach(r => { s[r.key] = r.value; });
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
      return ok(res, {
        claimed: (hits || []).some(h => h.checkin_date === today),
        streak: p?.streak_days || 0,
        longest: p?.longest_streak || 0,
        bonus: Number(s.checkin_bonus || 0),
        tiers: { 7: Number(s.streak_7 || 0), 14: Number(s.streak_14 || 0), 30: Number(s.streak_30 || 0) },
        history: hits || []
      });
    }

    if (req.method === 'POST') {
      const b = body(req);
      if (b.action !== 'claim') throw new Error('Unknown action.');
      const { data, error } = await sb.rpc('do_checkin', { p_user: u.id });
      if (error) throw new Error(error.message);
      const r = Array.isArray(data) ? data[0] : data;
      return ok(res, {
        base: Number(r?.base || 0), bonus: Number(r?.bonus || 0),
        total: Number(r?.total || 0), streak: r?.streak || 0, pct: Number(r?.pct || 0),
        message: 'Attendance bonus credited.'
      });
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
