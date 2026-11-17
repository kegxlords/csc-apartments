import { admin, ok, fail } from './_core.js';

const BATCH = 250;

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return fail(res, 'Method not allowed.', 405);

  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(res, 'CRON_SECRET is not configured on the server.', 500);

  const supplied = req.headers['x-cron-key'] || req.query?.key || '';
  if (supplied !== secret) return fail(res, 'Unauthorized cron key.', 401);

  const started = Date.now();
  const sb = admin();
  try {
    const { data, error } = await sb.rpc('sweep_income', { p_limit: BATCH });
    if (error) throw new Error(error.message);
    const r = Array.isArray(data) ? data[0] : data;
    const payload = {
      scanned: r?.scanned ?? 0,
      drops_paid: r?.drops_paid ?? 0,
      amount_paid: Number(r?.amount_paid ?? 0),
      leases_completed: r?.leases_completed ?? 0,
      remaining: r?.remaining ?? 0,
      elapsed_ms: Date.now() - started
    };
    await sb.from('cron_runs').insert({ ...payload, ok: true });
    return ok(res, payload);
  } catch (e) {
    await sb.from('cron_runs').insert({ ok: false, error: e.message, elapsed_ms: Date.now() - started });
    return fail(res, e, 500);
  }
}
