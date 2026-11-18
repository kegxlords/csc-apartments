import { admin, user, ok, fail, body, settingsMap } from './_core.js';

const slim = p => ({
  id: p.id, full_name: p.full_name, created_at: p.created_at,
  has_funded: p.has_funded, total_funded: Number(p.total_funded || 0)
});

export default async function handler(req, res) {
  const sb = admin();
  try {
    const u = await user(req);

    if (req.method === 'GET') {
      const cols = 'id,full_name,created_at,has_funded,total_funded';
      const [l1, l2, l3, me, comm, s] = await Promise.all([
        sb.from('profiles').select(cols).eq('referred_by', u.id).order('created_at', { ascending: false }),
        sb.from('profiles').select(cols).eq('upline_2', u.id).order('created_at', { ascending: false }),
        sb.from('profiles').select(cols).eq('upline_3', u.id).order('created_at', { ascending: false }),
        sb.from('profiles').select('referral_code').eq('id', u.id).single(),
        sb.from('referral_commissions').select('*').eq('beneficiary_id', u.id).order('created_at', { ascending: false }).limit(100),
        settingsMap(sb)
      ]);
      const levels = { l1: (l1.data || []).map(slim), l2: (l2.data || []).map(slim), l3: (l3.data || []).map(slim) };
      const all = [...levels.l1, ...levels.l2, ...levels.l3];
      return ok(res, {
        referral_code: me.data?.referral_code,
        levels,
        totals: {
          total: all.length,
          active: all.filter(m => m.has_funded).length,
          inactive: all.filter(m => !m.has_funded).length,
          funding: all.reduce((a, m) => a + m.total_funded, 0)
        },
        rates: { l1: Number(s.referral_l1 || 0), l2: Number(s.referral_l2 || 0), l3: Number(s.referral_l3 || 0) },
        commissions: comm.data || [],
        earned: (comm.data || []).reduce((a, c) => a + Number(c.amount), 0)
      });
    }

    if (req.method === 'POST') {
      const b = body(req);
      if (b.action !== 'redeem') throw new Error('Unknown action.');
      const code = String(b.code || '').trim().toUpperCase();
      if (!code) throw new Error('Enter a gift code.');
      const { data: g } = await sb.from('gift_codes').select('*').eq('code', code).maybeSingle();
      if (!g) throw new Error('That gift code is not valid.');
      if (!g.is_active) throw new Error('This gift code is no longer active.');
      if (g.expires_at && new Date(g.expires_at) < new Date()) throw new Error('This gift code has expired.');
      if (g.max_uses && g.used_count >= g.max_uses) throw new Error('This gift code has been fully redeemed.');
      const { data: used } = await sb.from('gift_code_redemptions').select('id').eq('code_id', g.id).eq('user_id', u.id).maybeSingle();
      if (used) throw new Error('You have already redeemed this code.');

      const { error } = await sb.rpc('redeem_gift_code', { p_user: u.id, p_code: g.id });
      if (error) throw new Error(error.message);
      return ok(res, { amount: Number(g.amount), message: `₦${Number(g.amount).toLocaleString()} credited.` });
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
