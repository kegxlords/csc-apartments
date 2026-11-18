import { admin, user, ok, fail, body } from './_core.js';

export default async function handler(req, res) {
  const sb = admin();
  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.from('units')
        .select('*').in('status', ['live', 'upcoming']).order('sort_order');
      if (error) throw new Error(error.message);

      let units = data || [];
      let owned = {};
      if (req.headers.authorization) {
        const u = await user(req);
        const { data: ls, error: leaseError } = await sb.from('leases').select('unit_id,status').eq('user_id', u.id);
        if (leaseError) throw new Error(leaseError.message);
        (ls || []).filter(l => l.status === 'active').forEach(l => { owned[l.unit_id] = (owned[l.unit_id] || 0) + 1; });
        const leaseUnitIds = [...new Set((ls || []).map(l => l.unit_id).filter(Boolean))];
        if (leaseUnitIds.length) {
          const { data: leasedUnits, error: leasedUnitsError } = await sb.from('units').select('*').in('id', leaseUnitIds);
          if (leasedUnitsError) throw new Error(leasedUnitsError.message);
          const byId = new Map(units.map(unit => [unit.id, unit]));
          (leasedUnits || []).forEach(unit => byId.set(unit.id, unit));
          units = [...byId.values()].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        }
      }
      return ok(res, { units, owned });
    }

    if (req.method === 'POST') {
      const u = await user(req);
      const b = body(req);
      if (b.action !== 'lease') throw new Error('Unknown action.');
      if (!b.unit_id) throw new Error('Select a residence to lease.');

      const { data: unit } = await sb.from('units').select('*').eq('id', b.unit_id).single();
      if (!unit) throw new Error('That residence no longer exists.');
      if (unit.status !== 'live') throw new Error('This residence is not open for leasing yet.');

      const { count } = await sb.from('leases').select('id', { count: 'exact', head: true })
        .eq('user_id', u.id).eq('unit_id', unit.id).eq('status', 'active');
      if ((count || 0) >= unit.purchase_limit)
        throw new Error(`You have reached the ${unit.purchase_limit}× limit for this residence.`);

      const { data: w } = await sb.from('wallets').select('balance,locked').eq('user_id', u.id).single();
      if (!w || Number(w.balance) - Number(w.locked) < Number(unit.price))
        throw new Error('Insufficient balance. Fund your wallet to lease this residence.');

      const { data, error } = await sb.rpc('lease_unit', { p_user: u.id, p_unit: unit.id });
      if (error) throw new Error(error.message);
      return ok(res, { lease: data, message: `${unit.name} leased. First income drop in 24 hours.` });
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
