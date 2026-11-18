import { admin, user, ok, fail, body, settingsMap, num, ref } from './_core.js';

export default async function handler(req, res) {
  try {
    const u = await user(req);
    const sb = admin();
    const b = body(req);

    if (req.method === 'GET') {
      const [{ data: profile }, { data: wallet }, { data: cards }, { data: leases }, s] = await Promise.all([
        sb.from('profiles').select('*').eq('id', u.id).single(),
        sb.from('wallets').select('balance,income_balance,locked').eq('user_id', u.id).single(),
        sb.from('bank_accounts').select('*').eq('user_id', u.id).order('created_at'),
        sb.from('leases').select('*, units(*)').eq('user_id', u.id).order('started_at', { ascending: false }).limit(250),
        settingsMap(sb)
      ]);
      return ok(res, { profile, wallet, cards: cards || [], leases: leases || [], settings: s });
    }

    if (req.method === 'POST') {
      const action = b.action || 'update_profile';

      if (action === 'update_profile') {
        const patch = {};
        if (typeof b.full_name === 'string' && b.full_name.trim().length >= 3) patch.full_name = b.full_name.trim();
        if (typeof b.phone === 'string') patch.phone = b.phone.trim();
        if (!Object.keys(patch).length) throw new Error('Nothing to update.');
        const { error } = await sb.from('profiles').update(patch).eq('id', u.id);
        if (error) throw new Error(error.message);
        return ok(res, { message: 'Profile updated.' });
      }

      if (action === 'claim_welcome') {
        const { data: p } = await sb.from('profiles').select('welcome_claimed').eq('id', u.id).single();
        if (p?.welcome_claimed) return ok(res, { amount: 0, message: 'Welcome bonus already credited.' });
        const s = await settingsMap(sb);
        const amount = num(s.welcome_bonus, 0);
        if (amount > 0) {
          const { error } = await sb.rpc('grant_welcome_bonus', { p_user: u.id, p_amount: amount, p_ref: ref('WEL') });
          if (error) throw new Error(error.message);
        }
        return ok(res, { amount, message: 'Welcome bonus credited.' });
      }

      if (action === 'save_card') {
        const bank_name = String(b.bank_name || '').trim();
        const account_number = String(b.account_number || '').replace(/\D/g, '');
        const account_name = String(b.account_name || '').trim();
        if (!bank_name) throw new Error('Select your bank.');
        if (!/^\d{10}$/.test(account_number)) throw new Error('Account number must be exactly 10 digits.');
        if (account_name.length < 3) throw new Error('Enter the account name.');

        const dupe = await sb.from('bank_accounts').select('id')
          .eq('user_id', u.id).eq('account_number', account_number).maybeSingle();
        if (dupe.data) throw new Error('That account is already saved.');

        const { data: existing } = await sb.from('bank_accounts').select('id').eq('user_id', u.id);
        const makeDefault = b.make_default === true || !existing || existing.length === 0;
        if (makeDefault) await sb.from('bank_accounts').update({ is_default: false }).eq('user_id', u.id);

        const { data, error } = await sb.from('bank_accounts')
          .insert({ user_id: u.id, bank_name, bank_code: b.bank_code || null, account_number, account_name, is_default: makeDefault })
          .select().single();
        if (error) throw new Error(error.message);
        return ok(res, { card: data, message: 'Payout card saved.' });
      }

      if (action === 'default_card') {
        const { data: c } = await sb.from('bank_accounts').select('id').eq('id', b.id).eq('user_id', u.id).single();
        if (!c) throw new Error('Card not found.');
        await sb.from('bank_accounts').update({ is_default: false }).eq('user_id', u.id);
        const { error } = await sb.from('bank_accounts').update({ is_default: true }).eq('id', b.id).eq('user_id', u.id);
        if (error) throw new Error(error.message);
        return ok(res, { message: 'Default card updated.' });
      }

      if (action === 'delete_card') {
        const { data: c } = await sb.from('bank_accounts').select('is_default').eq('id', b.id).eq('user_id', u.id).single();
        if (!c) throw new Error('Card not found.');
        await sb.from('bank_accounts').delete().eq('id', b.id).eq('user_id', u.id);
        if (c.is_default) {
          const { data: rest } = await sb.from('bank_accounts').select('id').eq('user_id', u.id).order('created_at').limit(1);
          if (rest?.length) await sb.from('bank_accounts').update({ is_default: true }).eq('id', rest[0].id);
        }
        return ok(res, { message: 'Card removed.' });
      }

      throw new Error('Unknown action.');
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
