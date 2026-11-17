/* ============================================================
   PINNACLE APARTMENTS — Data engine
   Two adapters: Supabase (live) · Local (seeded, fully working).
   Every mutation is atomic, logged, and reversible.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.PINNACLE;
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const KEY = 'pinnacle.v1';
  const DAY = 86400000;

  /* ---------------- helpers ---------------- */
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const now = () => Date.now();
  const clone = o => JSON.parse(JSON.stringify(o));
  const code6 = () => Array.from({ length: 6 }, () => 'ACDEFGHJKLMNPQRTUVWXY3479'[Math.random() * 25 | 0]).join('');
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); };

  /* ---------------- artwork (SVG fallbacks) ---------------- */
  const PALETTES = {
    studio: ['#3D9BFF', '#1F6FEB', '#123A8F'],
    'one-bed': ['#FF6FB0', '#EC2E86', '#C2186B'],
    'two-bed': ['#35D68C', '#14A867', '#0B7A4B'],
    'three-bed': ['#FF6A5E', '#E23B33', '#B3121B'],
    duplex: ['#3D9BFF', '#EC2E86', '#123A8F'],
    penthouse: ['#EC2E86', '#1F6FEB', '#123A8F']
  };

  function facade(tier, seed) {
    const p = PALETTES[tier] || PALETTES.studio;
    let s = seed || 1; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const floors = { studio: 4, 'one-bed': 5, 'two-bed': 6, 'three-bed': 7, duplex: 8, penthouse: 10 }[tier] || 5;
    const cols = 4;
    let win = '';
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const lit = rnd() > .38;
        const x = 26 + c * 15, y = 92 - f * (74 / floors);
        win += `<rect x="${x}" y="${y}" width="10" height="${Math.max(5, 60 / floors - 3)}" rx="1.5" fill="${lit ? '#FFD9EC' : '#123A8F'}" opacity="${lit ? .92 : .45}"/>`;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#s)"/>
      <circle cx="94" cy="24" r="13" fill="#fff" opacity=".26"/>
      <path d="M0 104 L20 96 L44 104 L70 94 L96 104 L120 96 L120 120 L0 120Z" fill="${p[2]}" opacity=".55"/>
      <rect x="20" y="16" width="72" height="88" rx="3" fill="url(#b)"/>
      <rect x="20" y="16" width="72" height="6" rx="3" fill="#FFD9EC" opacity=".8"/>
      ${win}
      <rect x="50" y="92" width="14" height="12" rx="1.5" fill="#FFD9EC" opacity=".95"/>
      <rect x="14" y="102" width="92" height="4" rx="2" fill="#123A8F" opacity=".5"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function banner(i) {
    const sets = [
      ['#123A8F', '#1F6FEB', '#3D9BFF', 'Riverside Tower', 'Waterfront residences · Lekki Phase 1'],
      ['#C2186B', '#EC2E86', '#FF6FB0', 'The Pinnacle Collection', 'Six tiers of managed rental income'],
      ['#0B7A4B', '#14A867', '#35D68C', 'Income Every 24 Hours', 'Automatic drops, tracked to the second']
    ];
    const c = sets[i % sets.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs>
      <rect width="1200" height="600" fill="url(#g)"/>
      <g opacity=".2" fill="#fff">
        <rect x="700" y="150" width="110" height="450"/><rect x="830" y="80" width="130" height="520"/>
        <rect x="980" y="200" width="100" height="400"/><rect x="600" y="260" width="80" height="340"/>
      </g>
      <g opacity=".5" fill="#FFD9EC">
        ${Array.from({ length: 40 }, (_, k) => `<rect x="${712 + (k % 4) * 24}" y="${170 + Math.floor(k / 4) * 40}" width="13" height="20" rx="2"/>`).join('')}
        ${Array.from({ length: 44 }, (_, k) => `<rect x="${845 + (k % 4) * 28}" y="${104 + Math.floor(k / 4) * 44}" width="15" height="22" rx="2"/>`).join('')}
      </g>
      <circle cx="200" cy="130" r="70" fill="#fff" opacity=".18"/>
      <path d="M0 520 L200 480 L420 530 L640 470 L900 530 L1200 480 L1200 600 L0 600Z" fill="${c[0]}" opacity=".45"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------------- seed ---------------- */
  const DEFAULT_SETTINGS = {
    min_deposit: 3000, max_deposit: 5000000,
    min_withdrawal: 2000, max_withdrawal: 3000000,
    withdrawal_fee: 8, withdrawals_per_day: 2,
    referral_l1: 10, referral_l2: 3, referral_l3: 1,
    income_days: 30, welcome_bonus: 500, checkin_bonus: 50,
    streak_7: 5, streak_14: 10, streak_30: 20,
    withdrawal_days: [1, 2, 3, 4, 5, 6, 0],
    withdrawal_start: '08:00', withdrawal_end: '18:00',
    bank_name: 'Guaranty Trust Bank', account_number: '0123456789', account_name: 'Pinnacle Apartments Ltd',
    whatsapp_link: 'https://chat.whatsapp.com/pinnacle',
    telegram_link: 'https://t.me/pinnacleapartments',
    support_link: 'https://wa.me/2348000000000',
    support_email: 'care@pinnacleapartments.ng'
  };

  const UNIT_SEED = [
    ['studio', 'Studio Suite', 'Studio', 15000, 1200, 30, 5, 1, 1, 34],
    ['one-bed', 'One-Bedroom Residence', '1 Bedroom', 45000, 3800, 45, 5, 1, 1, 58],
    ['two-bed', 'Two-Bedroom Terrace', '2 Bedroom', 120000, 10500, 60, 4, 2, 2, 96],
    ['three-bed', 'Three-Bedroom Maisonette', '3 Bedroom', 300000, 27000, 75, 3, 3, 2, 142],
    ['duplex', 'Executive Duplex', 'Duplex', 750000, 70000, 90, 2, 4, 3, 210],
    ['penthouse', 'Sky Penthouse', 'Penthouse', 2000000, 195000, 120, 1, 5, 4, 340]
  ];

  function seed() {
    const units = UNIT_SEED.map((u, i) => ({
      id: uid(), slug: u[0], name: u[1], tier: u[2], price: u[3], daily_yield: u[4],
      duration_days: u[5], purchase_limit: u[6], bedrooms: u[7], bathrooms: u[8], sqm: u[9],
      image_url: '', status: i === 4 ? 'upcoming' : (i === 5 ? 'live' : 'live'),
      sort_order: i, sold: [148, 96, 61, 34, 12, 7][i],
      amenities: ['24/7 Power', 'Fibre WiFi', 'Secure Parking', 'CCTV', 'Water Treatment'].slice(0, 3 + (i % 3)),
      description: 'Fully serviced and professionally managed. Rental income is distributed automatically every 24 hours from the moment your lease begins.'
    }));

    const demoId = uid();
    const t0 = now();
    const users = [{
      id: demoId, email: 'member@pinnacle.ng', phone: '08031234567',
      full_name: 'Adaeze Okonkwo', pass: hash('pinnacle'),
      referral_code: 'PNC' + code6().slice(0, 3), referred_by: null, upline_2: null, upline_3: null,
      is_admin: true, is_active: true, has_funded: true,
      total_funded: 60000, total_withdrawn: 12000,
      streak_days: 4, longest_streak: 9, last_checkin: null,
      verified: true, created_at: t0 - 26 * DAY
    }];

    const leases = [
      { id: uid(), user_id: demoId, unit_id: units[0].id, status: 'active', days_paid: 6, total_collected: 7200, started_at: t0 - 6 * DAY - 3 * 3600000 },
      { id: uid(), user_id: demoId, unit_id: units[1].id, status: 'active', days_paid: 2, total_collected: 7600, started_at: t0 - 2 * DAY - 9 * 3600000 },
      { id: uid(), user_id: demoId, unit_id: units[0].id, status: 'completed', days_paid: 30, total_collected: 36000, started_at: t0 - 40 * DAY }
    ];

    const cards = [{
      id: uid(), user_id: demoId, bank_name: 'Access Bank', bank_code: '044',
      account_number: '0765432109', account_name: 'Adaeze Okonkwo', is_default: true, created_at: t0 - 20 * DAY
    }];

    const tx = [
      { id: uid(), user_id: demoId, type: 'welcome_bonus', amount: 500, fee: 0, net_amount: 500, description: 'Welcome bonus', reference: 'WEL-' + code6(), status: 'completed', created_at: t0 - 26 * DAY },
      { id: uid(), user_id: demoId, type: 'deposit', amount: 60000, fee: 0, net_amount: 60000, description: 'Bank transfer deposit', reference: 'DEP-' + code6(), status: 'completed', created_at: t0 - 25 * DAY },
      { id: uid(), user_id: demoId, type: 'lease_purchase', amount: 15000, fee: 0, net_amount: 15000, description: 'Leased Studio Suite', reference: 'LSE-' + code6(), status: 'completed', created_at: t0 - 6 * DAY - 3 * 3600000 },
      { id: uid(), user_id: demoId, type: 'lease_purchase', amount: 45000, fee: 0, net_amount: 45000, description: 'Leased One-Bedroom Residence', reference: 'LSE-' + code6(), status: 'completed', created_at: t0 - 2 * DAY - 9 * 3600000 },
      { id: uid(), user_id: demoId, type: 'withdrawal', amount: 12000, fee: 960, net_amount: 11040, description: 'Withdrawal to Access Bank', reference: 'WTH-' + code6(), status: 'completed', created_at: t0 - 12 * DAY, bank_name: 'Access Bank', account_number: '0765432109', account_name: 'Adaeze Okonkwo' }
    ];
    leases.slice(0, 2).forEach(l => {
      const u = units.find(x => x.id === l.unit_id);
      for (let d = 1; d <= l.days_paid; d++) {
        tx.push({
          id: uid(), user_id: demoId, type: 'rental_income', amount: u.daily_yield, fee: 0, net_amount: u.daily_yield,
          description: u.name + ' · drop ' + d, reference: 'INC-' + l.id.slice(0, 6) + '-' + d,
          status: 'completed', created_at: l.started_at + d * DAY
        });
      }
    });

    const checkins = [];
    for (let d = 4; d >= 1; d--) {
      checkins.push({ id: uid(), user_id: demoId, date: dayKey(t0 - d * DAY), base: 50, bonus: 0, total: 50, streak: 5 - d, created_at: t0 - d * DAY });
    }

    return {
      v: 1, settings: clone(DEFAULT_SETTINGS), units, users, leases, cards, tx, checkins,
      commissions: [], cron: [], session: null, resets: {}
    };
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- persistence ---------------- */
  let db;
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? JSON.parse(raw) : seed();
    if (!db || db.v !== 1) db = seed();
  } catch (e) { db = seed(); }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  save();

  const undoStack = [];
  function snapshot(label) {
    undoStack.push({ label, data: clone(db) });
    if (undoStack.length > 25) undoStack.shift();
  }

  /* ---------------- Supabase adapter ---------------- */
  let sb = null;
  if (LIVE) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    window.sb = sb;
  }

  /* ---------------- income sweep (local mirror of api/cron) ---------------- */
  function sweep() {
    const t = now(); let paid = 0, amount = 0, completed = 0;
    db.leases.forEach(l => {
      if (l.status !== 'active') return;
      const u = db.units.find(x => x.id === l.unit_id); if (!u) return;
      const due = Math.floor((t - l.started_at) / DAY);
      const target = Math.min(due, u.duration_days);
      while (l.days_paid < target) {
        l.days_paid++;
        const ref = 'INC-' + l.id.slice(0, 6) + '-' + l.days_paid;
        if (db.tx.some(x => x.reference === ref)) continue;
        db.tx.push({
          id: uid(), user_id: l.user_id, type: 'rental_income', amount: u.daily_yield, fee: 0,
          net_amount: u.daily_yield, description: u.name + ' · drop ' + l.days_paid,
          reference: ref, status: 'completed', created_at: l.started_at + l.days_paid * DAY
        });
        const w = walletOf(l.user_id); w.balance += u.daily_yield; w.income += u.daily_yield;
        l.total_collected += u.daily_yield; paid++; amount += u.daily_yield;
      }
      if (l.days_paid >= u.duration_days) { l.status = 'completed'; completed++; }
    });
    db.cron.unshift({ at: t, paid, amount, completed });
    if (db.cron.length > 40) db.cron.length = 40;
    if (paid) save();
    return { paid, amount, completed };
  }

  function walletOf(userId) {
    const u = db.users.find(x => x.id === userId);
    if (!u) return { balance: 0, income: 0, locked: 0 };
    if (!u._wallet) {
      let bal = 0, inc = 0, locked = 0;
      db.tx.forEach(t => {
        if (t.user_id !== userId) return;
        if (t.status === 'completed') {
          if (['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission', 'admin_credit'].includes(t.type)) bal += t.net_amount;
          if (['withdrawal', 'lease_purchase', 'admin_debit'].includes(t.type)) bal -= t.amount;
          if (t.type === 'rental_income') inc += t.net_amount;
        }
        if (t.status === 'pending' && t.type === 'withdrawal') locked += t.amount;
      });
      u._wallet = { balance: Math.max(0, bal), income: inc, locked };
    }
    return u._wallet;
  }
  function recompute(userId) {
    const u = db.users.find(x => x.id === userId); if (u) delete u._wallet;
    return walletOf(userId);
  }

  /* ---------------- public API ---------------- */
  const S = {
    live: LIVE, sb, dayKey, facade, banner, DAY,

    /* ---- session ---- */
    async session() {
      if (LIVE) { const { data } = await sb.auth.getSession(); return data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null; }
      return db.session ? { user: db.users.find(u => u.id === db.session) } : null;
    },

    async register({ email, full_name, password, invite }) {
      email = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address.');
      if (!full_name || full_name.trim().length < 3) throw new Error('Enter your full name.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

      if (LIVE) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name, invite: invite || null } } });
        if (error) throw new Error(error.message);
        return { needsVerify: !data.session, email };
      }
      if (db.users.some(u => u.email === email)) throw new Error('An account with this email already exists.');
      let ref = null, up2 = null, up3 = null;
      if (invite) {
        const inv = db.users.find(u => u.referral_code === invite.toUpperCase());
        if (!inv) throw new Error('That invitation code is not valid.');
        ref = inv.id; up2 = inv.referred_by; up3 = inv.upline_2;
      }
      const u = {
        id: uid(), email, phone: '', full_name: full_name.trim(), pass: hash(password),
        referral_code: 'PNC' + code6().slice(0, 3), referred_by: ref, upline_2: up2, upline_3: up3,
        is_admin: false, is_active: true, has_funded: false, total_funded: 0, total_withdrawn: 0,
        streak_days: 0, longest_streak: 0, last_checkin: null, verified: true, created_at: now()
      };
      db.users.push(u);
      db.tx.push({
        id: uid(), user_id: u.id, type: 'welcome_bonus', amount: db.settings.welcome_bonus, fee: 0,
        net_amount: db.settings.welcome_bonus, description: 'Welcome bonus', reference: 'WEL-' + code6(),
        status: 'completed', created_at: now()
      });
      recompute(u.id); save();
      return { needsVerify: false, email };
    },

    async login(email, password) {
      email = String(email || '').trim().toLowerCase();
      if (LIVE) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        const { data: p } = await sb.from('profiles').select('is_active').eq('id', data.user.id).single();
        if (p && p.is_active === false) { await sb.auth.signOut(); throw new Error('This account has been suspended. Contact customer care.'); }
        return true;
      }
      const u = db.users.find(x => x.email === email);
      if (!u || u.pass !== hash(password)) throw new Error('Email or password is incorrect.');
      if (!u.is_active) throw new Error('This account has been suspended. Contact customer care.');
      db.session = u.id; save(); sweep();
      return true;
    },

    async logout() {
      if (LIVE) { await sb.auth.signOut(); return; }
      db.session = null; save();
    },

    async requestReset(email) {
      email = String(email || '').trim().toLowerCase();
      if (LIVE) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password.html' }); if (error) throw new Error(error.message); return null; }
      const u = db.users.find(x => x.email === email);
      if (!u) return null;
      const tok = code6() + code6();
      db.resets[tok] = { user: u.id, exp: now() + 3600000 }; save();
      return tok;
    },

    async resetPassword(token, password) {
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (LIVE) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(error.message); return true; }
      const r = db.resets[token];
      if (!r || r.exp < now()) throw new Error('This reset link is invalid or has expired.');
      db.users.find(x => x.id === r.user).pass = hash(password);
      delete db.resets[token]; save(); return true;
    },

    /* ---- reads ---- */
    me() { return db.session ? db.users.find(u => u.id === db.session) : null; },
    settings() { return clone(db.settings); },
    setting(k) { return db.settings[k]; },
    wallet() { const m = this.me(); return m ? clone(walletOf(m.id)) : { balance: 0, income: 0, locked: 0 }; },

    units(filter) {
      let list = db.units.filter(u => u.status !== 'hidden' && u.status !== 'deleted');
      if (filter === 'live') list = list.filter(u => u.status === 'live');
      return clone(list.sort((a, b) => a.sort_order - b.sort_order));
    },
    unit(id) { return clone(db.units.find(u => u.id === id)); },
    ownedCount(unitId) { const m = this.me(); return m ? db.leases.filter(l => l.user_id === m.id && l.unit_id === unitId && l.status === 'active').length : 0; },

    leases() {
      const m = this.me(); if (!m) return [];
      return db.leases.filter(l => l.user_id === m.id).map(l => {
        const u = db.units.find(x => x.id === l.unit_id);
        return Object.assign(clone(l), { unit: clone(u) });
      }).sort((a, b) => b.started_at - a.started_at);
    },

    nextDrop() {
      const ls = this.leases().filter(l => l.status === 'active' && l.days_paid < l.unit.duration_days);
      if (!ls.length) return null;
      return Math.min.apply(null, ls.map(l => l.started_at + (l.days_paid + 1) * DAY));
    },
    dailyIncome() {
      return this.leases().filter(l => l.status === 'active').reduce((s, l) => s + l.unit.daily_yield, 0);
    },

    transactions(type) {
      const m = this.me(); if (!m) return [];
      let list = db.tx.filter(t => t.user_id === m.id);
      if (type && type !== 'all') list = list.filter(t => t.type === type);
      return clone(list.sort((a, b) => b.created_at - a.created_at));
    },

    cards() { const m = this.me(); return m ? clone(db.cards.filter(c => c.user_id === m.id)) : []; },
    defaultCard() { const c = this.cards(); return c.find(x => x.is_default) || c[0] || null; },

    team() {
      const m = this.me(); if (!m) return { l1: [], l2: [], l3: [] };
      const pick = id => db.users.filter(u => u[id === 1 ? 'referred_by' : id === 2 ? 'upline_2' : 'upline_3'] === m.id)
        .map(u => ({ id: u.id, full_name: u.full_name, created_at: u.created_at, has_funded: u.has_funded, total_funded: u.total_funded }));
      return { l1: pick(1), l2: pick(2), l3: pick(3) };
    },

    checkinState() {
      const m = this.me(); if (!m) return { claimed: false, streak: 0, calendar: [] };
      const today = dayKey(now());
      const mine = db.checkins.filter(c => c.user_id === m.id);
      const claimed = mine.some(c => c.date === today);
      const y = new Date(); const ym = y.getFullYear(), mo = y.getMonth();
      const days = new Date(ym, mo + 1, 0).getDate();
      const cal = [];
      for (let d = 1; d <= days; d++) {
        const k = dayKey(new Date(ym, mo, d).getTime());
        const hit = mine.some(c => c.date === k);
        const isToday = k === today;
        const future = d > y.getDate();
        cal.push({ d, hit, isToday, future, miss: !hit && !future && !isToday });
      }
      return { claimed, streak: m.streak_days, longest: m.longest_streak, calendar: cal, bonus: db.settings.checkin_bonus };
    },

    withdrawRules() {
      const s = db.settings;
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CFG.TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find(p => p.type === 'weekday').value];
      const hh = +parts.find(p => p.type === 'hour').value, mm = +parts.find(p => p.type === 'minute').value;
      const cur = hh * 60 + mm;
      const toMin = t => { const a = t.split(':'); return +a[0] * 60 + +a[1]; };
      const dayOk = s.withdrawal_days.includes(wd);
      const timeOk = cur >= toMin(s.withdrawal_start) && cur < toMin(s.withdrawal_end);
      const m = this.me();
      const today = dayKey(now());
      const usedToday = m ? db.tx.filter(t => t.user_id === m.id && t.type === 'withdrawal' && dayKey(t.created_at) === today && t.status !== 'rejected').length : 0;
      const pending = m ? db.tx.some(t => t.user_id === m.id && t.type === 'withdrawal' && t.status === 'pending') : false;
      return {
        open: dayOk && timeOk, dayOk, timeOk, usedToday, pending,
        cap: s.withdrawals_per_day, min: s.min_withdrawal, max: s.max_withdrawal, fee: s.withdrawal_fee,
        window: s.withdrawal_start + ' – ' + s.withdrawal_end,
        days: s.withdrawal_days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
      };
    },

    /* ---- mutations ---- */
    async rent(unitId) {
      const m = this.me(); if (!m) throw new Error('Sign in to lease a unit.');
      const u = db.units.find(x => x.id === unitId);
      if (!u) throw new Error('That unit no longer exists.');
      if (u.status !== 'live') throw new Error('This unit is not open for leasing yet.');
      const owned = db.leases.filter(l => l.user_id === m.id && l.unit_id === unitId && l.status === 'active').length;
      if (owned >= u.purchase_limit) throw new Error('You have reached the ' + u.purchase_limit + '× limit for this unit.');
      const w = walletOf(m.id);
      if (w.balance - w.locked < u.price) throw new Error('Insufficient balance. Fund your wallet to lease this unit.');
      snapshot('Lease ' + u.name);
      db.tx.push({
        id: uid(), user_id: m.id, type: 'lease_purchase', amount: u.price, fee: 0, net_amount: u.price,
        description: 'Leased ' + u.name, reference: 'LSE-' + code6(), status: 'completed', created_at: now()
      });
      db.leases.push({ id: uid(), user_id: m.id, unit_id: u.id, status: 'active', days_paid: 0, total_collected: 0, started_at: now() });
      u.sold++; recompute(m.id); save();
      return { unit: u, undo: () => S.undo() };
    },

    async saveCard({ bank_name, account_number, account_name, makeDefault }) {
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      if (!bank_name) throw new Error('Select your bank.');
      if (!/^\d{10}$/.test(account_number)) throw new Error('Account number must be exactly 10 digits.');
      if (!account_name || account_name.trim().length < 3) throw new Error('Enter the account name.');
      if (db.cards.some(c => c.user_id === m.id && c.account_number === account_number)) throw new Error('That account is already saved.');
      snapshot('Save card');
      const first = db.cards.filter(c => c.user_id === m.id).length === 0;
      if (makeDefault || first) db.cards.forEach(c => { if (c.user_id === m.id) c.is_default = false; });
      db.cards.push({ id: uid(), user_id: m.id, bank_name, bank_code: '', account_number, account_name: account_name.trim(), is_default: makeDefault || first, created_at: now() });
      save(); return { undo: () => S.undo() };
    },
    async setDefaultCard(id) {
      const m = this.me(); snapshot('Default card');
      db.cards.forEach(c => { if (c.user_id === m.id) c.is_default = c.id === id; });
      save(); return { undo: () => S.undo() };
    },
    async deleteCard(id) {
      const m = this.me(); snapshot('Delete card');
      const i = db.cards.findIndex(c => c.id === id && c.user_id === m.id);
      if (i < 0) throw new Error('Card not found.');
      const wasDef = db.cards[i].is_default;
      db.cards.splice(i, 1);
      const rest = db.cards.filter(c => c.user_id === m.id);
      if (wasDef && rest.length) rest[0].is_default = true;
      save(); return { undo: () => S.undo() };
    },

    async deposit(amount, reference) {
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const s = db.settings;
      amount = Number(amount);
      if (!amount || amount < s.min_deposit) throw new Error('Minimum deposit is ₦' + s.min_deposit.toLocaleString() + '.');
      if (amount > s.max_deposit) throw new Error('Maximum deposit is ₦' + s.max_deposit.toLocaleString() + '.');
      snapshot('Deposit request');
      const ref = 'DEP-' + code6();
      db.tx.push({
        id: uid(), user_id: m.id, type: 'deposit', amount, fee: 0, net_amount: amount,
        description: 'Bank transfer deposit' + (reference ? ' · ' + reference : ''), reference: ref,
        status: 'pending', created_at: now()
      });
      recompute(m.id); save();
      return { reference: ref, undo: () => S.undo() };
    },

    async withdraw(amount, cardId) {
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const r = this.withdrawRules(); const w = walletOf(m.id);
      amount = Number(amount);
      const card = db.cards.find(c => c.id === cardId && c.user_id === m.id);
      if (!card) throw new Error('Save a payout card before withdrawing.');
      if (!this.leases().some(l => l.status === 'active')) throw new Error('You need at least one active lease to withdraw.');
      if (!amount || amount < r.min) throw new Error('Minimum withdrawal is ₦' + r.min.toLocaleString() + '.');
      if (amount > r.max) throw new Error('Maximum withdrawal is ₦' + r.max.toLocaleString() + '.');
      if (amount > w.balance - w.locked) throw new Error('Insufficient available balance.');
      if (r.pending) throw new Error('You already have a withdrawal awaiting review.');
      if (r.usedToday >= r.cap) throw new Error('Daily limit reached — ' + r.cap + ' withdrawals per day.');
      if (!r.open) throw new Error('Withdrawals are closed. Window: ' + r.days + ', ' + r.window + ' (WAT).');
      snapshot('Withdrawal request');
      const fee = Math.round(amount * r.fee) / 100;
      const ref = 'WTH-' + code6();
      db.tx.push({
        id: uid(), user_id: m.id, type: 'withdrawal', amount, fee, net_amount: amount - fee,
        description: 'Withdrawal to ' + card.bank_name, reference: ref, status: 'pending', created_at: now(),
        bank_name: card.bank_name, account_number: card.account_number, account_name: card.account_name
      });
      recompute(m.id); save();
      return { reference: ref, fee, net: amount - fee, undo: () => S.undo() };
    },

    async checkin() {
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const today = dayKey(now());
      if (db.checkins.some(c => c.user_id === m.id && c.date === today)) throw new Error('You have already checked in today.');
      snapshot('Check-in');
      const yest = dayKey(now() - DAY);
      m.streak_days = m.last_checkin === yest ? m.streak_days + 1 : 1;
      m.longest_streak = Math.max(m.longest_streak, m.streak_days);
      m.last_checkin = today;
      const s = db.settings;
      const pct = m.streak_days >= 30 ? s.streak_30 : m.streak_days >= 14 ? s.streak_14 : m.streak_days >= 7 ? s.streak_7 : 0;
      const base = s.checkin_bonus, bonus = Math.round(base * pct) / 100;
      db.checkins.push({ id: uid(), user_id: m.id, date: today, base, bonus, total: base + bonus, streak: m.streak_days, created_at: now() });
      db.tx.push({
        id: uid(), user_id: m.id, type: 'checkin_bonus', amount: base + bonus, fee: 0, net_amount: base + bonus,
        description: 'Attendance day ' + m.streak_days + (pct ? ' · +' + pct + '% streak' : ''),
        reference: 'CHK-' + code6(), status: 'completed', created_at: now()
      });
      recompute(m.id); save();
      return { base, bonus, total: base + bonus, streak: m.streak_days, pct, undo: () => S.undo() };
    },

    async updateProfile(patch) {
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      snapshot('Profile'); Object.assign(m, patch); save();
      return { undo: () => S.undo() };
    },

    sweep,
    undo() {
      const s = undoStack.pop(); if (!s) return false;
      const sess = db.session; db = s.data; db.session = sess; save(); return s.label;
    },
    canUndo() { return undoStack.length > 0; },

    reset() { db = seed(); save(); }
  };

  window.Store = S;
  sweep();
  setInterval(() => { const r = sweep(); if (r.paid) window.dispatchEvent(new CustomEvent('pinnacle:income', { detail: r })); }, 60000);
})();
