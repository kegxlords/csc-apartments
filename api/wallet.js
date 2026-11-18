import { admin, user, ok, fail, body, settingsMap, num, ref } from './_core.js';

export default async function handler(req, res) {
  const sb = admin();
  try {
    const u = await user(req);

    if (req.method === 'GET') {
      const type = req.query?.type || null;
      let q = sb.from('transactions').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(200);
      if (type && type !== 'all') q = q.eq('type', type);
      const [{ data: wallet }, { data: tx }, { data: cards }, s] = await Promise.all([
        sb.from('wallets').select('balance,income_balance,locked').eq('user_id', u.id).single(),
        q,
        sb.from('bank_accounts').select('*').eq('user_id', u.id).order('created_at'),
        settingsMap(sb)
      ]);
      return ok(res, { wallet, transactions: tx || [], cards: cards || [], settings: s });
    }

    if (req.method === 'POST') {
      const b = body(req);
      const s = await settingsMap(sb);

      if (b.action === 'deposit') {
        const amount = num(b.amount);
        const min = num(s.min_deposit, 0), max = num(s.max_deposit, Infinity);
        if (amount < min) throw new Error(`Minimum deposit is ₦${min.toLocaleString()}.`);
        if (amount > max) throw new Error(`Maximum deposit is ₦${max.toLocaleString()}.`);
        const reference = ref('DEP');
        const { data, error } = await sb.from('transactions').insert({
          user_id: u.id, type: 'deposit', amount, fee: 0, net_amount: amount,
          description: 'Bank transfer deposit' + (b.reference ? ' · ' + String(b.reference).slice(0, 80) : ''),
          reference, status: 'pending'
        }).select().single();
        if (error) throw new Error(error.message);
        return ok(res, { transaction: data, reference, message: 'Deposit submitted for review.' });
      }

      if (b.action === 'withdraw') {
        const amount = num(b.amount);
        if (!b.card_id) throw new Error('Save a payout card before withdrawing.');
        const { data, error } = await sb.rpc('request_withdrawal', { p_user: u.id, p_amount: amount, p_card: b.card_id });
        if (error) throw new Error(error.message);
        const { data: tx } = await sb.from('transactions').select('*').eq('id', data).single();
        return ok(res, {
          transaction: tx, reference: tx?.reference, fee: Number(tx?.fee || 0),
          net: Number(tx?.net_amount || 0), message: 'Withdrawal requested.'
        });
      }

      throw new Error('Unknown action.');
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
