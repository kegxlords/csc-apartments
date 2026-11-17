/* ============================================================
   PINNACLE APARTMENTS — Member home
   Banner · balance · 4 actions · leases · inline catalogue
   ============================================================ */
(function () {
  'use strict';

  const {
    icon, esc, naira, dt, hms, toast, layer, closeLayer,
    confirmSheet, countTo, imgWithFallback
  } = UI;
  const CFG = window.PINNACLE;

  let timers = [];
  let refreshing = false;
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  const BANKS = [
    'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank',
    'First Bank of Nigeria', 'First City Monument Bank', 'Guaranty Trust Bank',
    'Keystone Bank', 'Kuda Microfinance Bank', 'Opay Digital Services', 'PalmPay',
    'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank',
    'Sterling Bank', 'Union Bank of Nigeria', 'United Bank for Africa',
    'Unity Bank', 'Wema Bank', 'Zenith Bank'
  ];

  const unitImg = u =>
    imgWithFallback(u.image_url || CFG.IMAGES.units[u.slug], Store.facade(u.slug, u.name.length * 7), u.name);

  /* ================= welcome popup — every visit ================= */
  function welcome(me, s) {
    const first = (me.full_name || 'Member').trim().split(/\s+/)[0];
    const l = layer(`
      <button class="modal-x" data-close aria-label="Close">${icon('x')}</button>
      <div class="welcome-hero">
        <div class="em">🏙️</div>
        <h2>Welcome back, <span class="welcome-name">${esc(first)}</span></h2>
        <p>Your residences are earning. Income drops automatically every 24 hours.</p>
      </div>
      <div class="welcome-body">
        <p class="welcome-note">Join the residents’ group for payout alerts, new unit releases and instant help from our care team.</p>
        <div class="welcome-actions">
          <a class="wa-btn wa-btn--wa" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">
            ${icon('wa')}<span>Join WhatsApp Group<small>Payout alerts &amp; community</small></span>${icon('chev')}
          </a>
          <button class="wa-btn wa-btn--cs" id="wCare" type="button">
            ${icon('headset')}<span>Customer Service<small>Live chat · ${esc(s.support_email)}</small></span>${icon('chev')}
          </button>
        </div>
        <button class="welcome-skip" data-close type="button">Continue to dashboard</button>
      </div>`);
    const b = l.querySelector('#wCare');
    if (b) b.addEventListener('click', () => { closeLayer(); setTimeout(UI.careSheet, 280); });
  }

  /* ================= carousel ================= */
  function carousel() {
    const root = document.getElementById('carousel');
    if (!root) return;
    const copies = [
      ['Riverside Tower', 'Waterfront residences · Lekki Phase 1'],
      ['The Pinnacle Collection', 'Six tiers of managed rental income'],
      ['Income Every 24 Hours', 'Automatic drops, tracked to the second']
    ];
    root.innerHTML = `
      <div class="carousel-track" id="cTrack">
        ${CFG.IMAGES.banners.map((src, i) => `
          <div class="slide">
            ${imgWithFallback(src, Store.banner(i), copies[i][0])}
            <div class="slide-copy"><b>${copies[i][0]}</b><span>${copies[i][1]}</span></div>
          </div>`).join('')}
      </div>
      <button class="carousel-nav prev" id="cPrev" aria-label="Previous slide">${icon('back')}</button>
      <button class="carousel-nav next" id="cNext" aria-label="Next slide">${icon('chev')}</button>
      <div class="dots" id="cDots">
        ${copies.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" class="${i === 0 ? 'on' : ''}"></button>`).join('')}
      </div>`;

    const track = root.querySelector('#cTrack');
    const dots = [...root.querySelectorAll('.dots button')];
    let idx = 0, auto = null;

    const go = i => {
      idx = (i + copies.length) % copies.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('on', k === idx));
    };
    const start = () => { clearInterval(auto); auto = setInterval(() => go(idx + 1), 5000); };

    dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
    root.querySelector('#cPrev').addEventListener('click', () => { go(idx - 1); start(); });
    root.querySelector('#cNext').addEventListener('click', () => { go(idx + 1); start(); });

    let sx = null;
    root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); start(); }
      sx = null;
    }, { passive: true });

    root.addEventListener('mouseenter', () => clearInterval(auto));
    root.addEventListener('mouseleave', start);
    start();
    timers.push(auto);
  }

  /* ================= balance ================= */
  function paintBalance() {
    const w = Store.wallet();
    const b = document.getElementById('balMain');
    const i = document.getElementById('balIncome');
    if (b) b.textContent = naira(w.balance);
    if (i) i.textContent = naira(w.income);

    const pill = document.getElementById('nextPill');
    const nd = Store.nextDrop();
    if (pill) {
      if (nd) { pill.classList.remove('hide'); pill.querySelector('b').textContent = hms(nd - Date.now()); }
      else pill.classList.add('hide');
    }
    const pip = document.getElementById('ciPip');
    if (pip) pip.classList.toggle('hide', Store.checkinState().claimed);
  }

  /* ================= four quick actions ================= */
  function quickActions() {
    const root = document.getElementById('qa');
    if (!root) return;
    const s = Store.settings();
    root.innerHTML = `
      <button class="qa-item qa--blue" type="button" data-qa="deposit">
        <span class="qa-orb">${icon('in')}</span><b>Deposit</b></button>
      <button class="qa-item qa--red" type="button" data-qa="withdraw">
        <span class="qa-orb">${icon('out')}</span><b>Withdraw</b></button>
      <button class="qa-item qa--pink" type="button" data-qa="checkin">
        <span class="qa-orb">${icon('flame')}</span><b>Check-In</b>
        <i class="pip hide" id="ciPip">1</i></button>
      <a class="qa-item qa--green" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">
        <span class="qa-orb">${icon('wa')}</span><b>WhatsApp</b></a>`;

    root.querySelectorAll('[data-qa]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.qa;
      if (k === 'deposit') depositSheet();
      else if (k === 'withdraw') withdrawSheet();
      else checkinSheet();
    }));
  }

  /* ================= catalogue ================= */
  function paintUnits() {
    const root = document.getElementById('units');
    if (!root) return;
    const list = Store.units();

    if (!list.length) {
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-art">${icon('building')}</div>
        <b>No residences released yet</b>
        <p>New units are published by management. Check back shortly.</p>
      </div></div>`;
      return;
    }

    root.innerHTML = list.map(u => {
      const left = Math.max(0, u.purchase_limit - Store.ownedCount(u.id));
      const live = u.status === 'live';
      const total = u.daily_yield * u.duration_days;
      return `<article class="unit rise">
        <div class="unit-img">${unitImg(u)}<span class="ribbon">${esc(u.tier)}</span></div>
        <div class="unit-body">
          <div class="unit-top">
            <h3 class="unit-name">${esc(u.name)}</h3>
            <span class="tag tag--${live ? 'live' : 'soon'}">${live ? 'Live' : 'Upcoming'}</span>
          </div>
          <div class="unit-specs">
            <span class="chip">${icon('bed')} ${u.bedrooms} bed</span>
            <span class="chip">${icon('bath')} ${u.bathrooms} bath</span>
            <span class="chip">${icon('area')} ${u.sqm} m²</span>
          </div>
          <div class="unit-econ">
            <div class="econ"><span class="k">Lease price</span><span class="v c-blue">${naira(u.price)}</span></div>
            <div class="econ"><span class="k">Every 24h</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
            <div class="econ"><span class="k">Income days</span><span class="v">${u.duration_days}</span></div>
            <div class="econ"><span class="k">Total return</span><span class="v c-pink">${naira(total)}</span></div>
          </div>
          <div class="unit-foot">
            <span class="limit">${live ? `<b>${left}</b> of ${u.purchase_limit} left` : 'Opens soon'}</span>
            <button class="btn btn--${live && left ? 'primary' : 'ghost'} btn--sm"
              type="button" data-rent="${u.id}" ${(!live || !left) ? 'disabled' : ''}>
              ${live ? (left ? 'Lease' : 'Limit reached') : 'Upcoming'}
            </button>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('[data-rent]').forEach(b =>
      b.addEventListener('click', () => rentFlow(b.dataset.rent)));
    [...root.querySelectorAll('.unit')].forEach((el, i) => { el.style.animationDelay = (0.04 * i) + 's'; });
  }

  function rentFlow(id) {
    const u = Store.unit(id);
    const w = Store.wallet();
    confirmSheet({
      title: 'Confirm lease',
      confirmText: 'Lease for ' + naira(u.price),
      kind: 'primary',
      body: `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <div class="lease-thumb">${unitImg(u)}</div>
          <div><b class="dsp" style="font-size:15px">${esc(u.name)}</b>
            <div class="c-muted" style="font-size:12px;font-weight:600">${esc(u.tier)} · ${u.sqm} m²</div></div>
        </div>
        <div class="total-box">
          <div class="kv"><span class="k">Lease price</span><span class="v">${naira(u.price)}</span></div>
          <div class="kv"><span class="k">Income every 24 hours</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
          <div class="kv"><span class="k">Income days</span><span class="v">${u.duration_days}</span></div>
          <div class="kv"><span class="k">Total return</span><span class="v c-pink">${naira(u.daily_yield * u.duration_days)}</span></div>
          <div class="kv grand"><span class="k">Balance after lease</span><span class="v">${naira(Math.max(0, w.balance - w.locked - u.price))}</span></div>
        </div>
        <p class="c-muted" style="font-size:12px;font-weight:600">Your first drop lands exactly 24 hours from now, then every 24 hours until all ${u.duration_days} income days are paid.</p>`,
      onConfirm: async () => {
        const r = await Store.rent(id);
        toast(r.unit.name + ' leased', 'ok', {
          sub: 'First drop in 24 hours',
          undo: () => { Store.undo(); refresh(); toast('Lease reversed', 'info'); }
        });
        refresh();
      }
    });
  }

  /* ================= leases ================= */
  function paintLeases() {
    const root = document.getElementById('leases');
    if (!root) return;
    const ls = Store.leases().slice(0, 4);

    if (!ls.length) {
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-art">${icon('rents')}</div>
        <b>No active leases</b>
        <p>Lease a residence below and income starts dropping every 24 hours.</p>
      </div></div>`;
      return;
    }

    root.innerHTML = ls.map(l => {
      const u = l.unit;
      const out = l.days_paid >= u.duration_days;
      const pct = Math.min(100, Math.round(l.days_paid / u.duration_days * 100));
      const next = l.started_at + (l.days_paid + 1) * Store.DAY;
      return `<article class="lease">
        <div class="lease-top">
          <div class="lease-thumb">${unitImg(u)}</div>
          <div class="lease-meta"><b>${esc(u.name)}</b><span>Leased ${dt(l.started_at)}</span></div>
          <span class="tag tag--${out ? 'out' : 'live'}">${out ? 'Ended' : 'Active'}</span>
        </div>
        <div class="timer ${out ? 'out' : ''}" data-drop="${out ? '' : next}">
          <span class="k">${out ? 'Income status' : 'Next drop in'}</span>
          <span class="clock">${out ? 'Out of income days' : hms(next - Date.now())}</span>
        </div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="lease-stats">
          <span>Drop <b>${l.days_paid}</b> of ${u.duration_days}</span>
          <span>Collected <b class="c-green">${naira(l.total_collected)}</b></span>
        </div>
      </article>`;
    }).join('');
  }

  function tickClocks() {
    let due = false;
    document.querySelectorAll('[data-drop]').forEach(el => {
      const t = +el.dataset.drop;
      if (!t) return;
      const left = t - Date.now();
      const c = el.querySelector('.clock');
      if (c) c.textContent = hms(left);
      if (left <= 0) due = true;
    });
    const pill = document.getElementById('nextPill');
    const nd = Store.nextDrop();
    if (pill && nd) pill.querySelector('b').textContent = hms(nd - Date.now());
    if (due && !refreshing) { Store.sweep(); refresh(); }
  }

  /* ================= deposit ================= */
  function depositSheet() {
    const s = Store.settings();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('in')} Fund your wallet</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="card" style="background:var(--blue-tint);border-color:var(--blue-tint-2);margin-bottom:14px">
        <div class="kv"><span class="k">Bank</span><span class="v">${esc(s.bank_name)}
          <button class="copy" type="button" data-copy="${esc(s.bank_name)}">Copy</button></span></div>
        <div class="kv"><span class="k">Account number</span><span class="v">${esc(s.account_number)}
          <button class="copy" type="button" data-copy="${esc(s.account_number)}">Copy</button></span></div>
        <div class="kv"><span class="k">Account name</span><span class="v">${esc(s.account_name)}
          <button class="copy" type="button" data-copy="${esc(s.account_name)}">Copy</button></span></div>
      </div>
      <div class="alert alert--info show">${icon('info')}<span>Transfer exactly the amount you enter, then submit below. Our team confirms deposits shortly.</span></div>
      <form id="depForm">
        <div class="field-row">
          <label class="label" for="depAmt">Amount (₦)</label>
          <div class="input-wrap">${icon('wallet')}
            <input class="input" id="depAmt" type="number" inputmode="numeric"
              min="${s.min_deposit}" max="${s.max_deposit}" placeholder="${s.min_deposit}" required></div>
          <p class="hint">Min ${naira(s.min_deposit)} · Max ${naira(s.max_deposit)}</p>
        </div>
        <div class="field-row">
          <label class="label" for="depRef">Transfer reference <span class="opt">(optional)</span></label>
          <div class="input-wrap">${icon('ticket')}
            <input class="input" id="depRef" placeholder="Session ID / narration"></div>
        </div>
        <button class="btn btn--blue btn--block" type="submit">Submit deposit</button>
      </form>`, 'sheet');

    l.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      navigator.clipboard.writeText(b.dataset.copy).then(() => {
        b.classList.add('done'); b.textContent = 'Copied';
        setTimeout(() => { b.classList.remove('done'); b.textContent = 'Copy'; }, 1600);
      }).catch(() => toast('Copy unavailable — select the text manually', 'warn'));
    }));

    l.querySelector('#depForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Submitting…';
      try {
        const r = await Store.deposit(l.querySelector('#depAmt').value, l.querySelector('#depRef').value.trim());
        closeLayer();
        toast('Deposit submitted', 'ok', {
          sub: 'Reference ' + r.reference,
          undo: () => { Store.undo(); refresh(); toast('Deposit request withdrawn', 'info'); }
        });
        refresh();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  /* ================= payout cards ================= */
  function cardVisual(c) {
    return `<div class="bankcard">
      ${c.is_default ? '<span class="bankcard-def">Default</span>' : ''}
      <div class="bankcard-top"><span class="bankcard-bank">${esc(c.bank_name)}</span><span class="bankcard-chip"></span></div>
      <div class="bankcard-no">${esc(c.account_number.replace(/(.{4})/g, '$1 ').trim())}</div>
      <div class="bankcard-name">${esc(c.account_name)}</div>
    </div>`;
  }

  function cardForm(onDone) {
    const l = layer(`
      <div class="sheet-head"><h3>${icon('bank')} Add payout card</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <form id="cardForm">
        <div class="field-row"><label class="label" for="cBank">Bank</label>
          <div class="input-wrap">${icon('bank')}
            <select class="input" id="cBank" required>
              <option value="">Select your bank</option>
              ${BANKS.map(b => `<option>${b}</option>`).join('')}
            </select></div></div>
        <div class="field-row"><label class="label" for="cNo">Account number</label>
          <div class="input-wrap">${icon('ticket')}
            <input class="input" id="cNo" inputmode="numeric" maxlength="10" placeholder="10 digits" required></div></div>
        <div class="field-row"><label class="label" for="cName">Account name</label>
          <div class="input-wrap">${icon('user')}
            <input class="input" id="cName" placeholder="As shown on your account" required></div></div>
        <label style="display:flex;gap:9px;align-items:center;font-size:13px;font-weight:700;margin-bottom:16px">
          <input type="checkbox" id="cDef" checked style="width:18px;height:18px;accent-color:var(--blue)">
          Make this my default payout card</label>
        <button class="btn btn--blue btn--block" type="submit">Save card</button>
      </form>`, 'sheet');

    l.querySelector('#cNo').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
    l.querySelector('#cardForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Saving…';
      try {
        await Store.saveCard({
          bank_name: l.querySelector('#cBank').value,
          account_number: l.querySelector('#cNo').value,
          account_name: l.querySelector('#cName').value,
          makeDefault: l.querySelector('#cDef').checked
        });
        closeLayer(); toast('Payout card saved', 'ok');
        if (onDone) setTimeout(onDone, 280);
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  function cardsSheet() {
    const cards = Store.cards();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('bank')} Payout cards</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${cards.length ? cards.map(c => `<div>
          ${cardVisual(c)}
          <div style="display:flex;gap:8px;margin-top:9px">
            ${c.is_default
              ? '<span class="btn btn--soft btn--xs" style="flex:1;cursor:default">Default card</span>'
              : `<button class="btn btn--soft btn--xs" type="button" style="flex:1" data-def="${c.id}">Set default</button>`}
            <button class="btn btn--ghost btn--xs" type="button" data-del="${c.id}">${icon('trash')} Remove</button>
          </div></div>`).join('')
        : `<div class="empty"><div class="empty-art">${icon('bank')}</div>
            <b>No cards yet</b><p>Add your bank account to enable withdrawals.</p></div>`}
      </div>
      <button class="btn btn--blue btn--block" type="button" id="addCard" style="margin-top:16px">${icon('plus')} Add new card</button>`, 'sheet');

    l.querySelector('#addCard').addEventListener('click', () => { closeLayer(); setTimeout(() => cardForm(cardsSheet), 280); });
    l.querySelectorAll('[data-def]').forEach(b => b.addEventListener('click', async () => {
      await Store.setDefaultCard(b.dataset.def);
      closeLayer(); toast('Default card updated', 'ok'); setTimeout(cardsSheet, 280);
    }));
    l.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.del;
      closeLayer();
      setTimeout(() => confirmSheet({
        title: 'Remove this card?', confirmText: 'Remove', kind: 'red',
        body: '<p class="c-muted" style="font-size:13px;font-weight:600">You can add it again at any time. Pending withdrawals are unaffected.</p>',
        onConfirm: async () => {
          await Store.deleteCard(id);
          toast('Card removed', 'info', { undo: () => { Store.undo(); toast('Card restored', 'ok'); } });
          setTimeout(cardsSheet, 280);
        }
      }), 280);
    }));
  }

  /* ================= withdraw ================= */
  function withdrawSheet() {
    const cards = Store.cards();
    if (!cards.length) {
      confirmSheet({
        title: 'Add a payout card', confirmText: 'Add card', kind: 'blue',
        body: `<div class="empty" style="padding:12px 0 4px"><div class="empty-art">${icon('bank')}</div>
          <b>No payout card saved</b><p>Save your bank account once and it will be used for every withdrawal.</p></div>`,
        onConfirm: async () => { setTimeout(() => cardForm(withdrawSheet), 280); }
      });
      return;
    }

    const r = Store.withdrawRules();
    const w = Store.wallet();
    const s = Store.settings();
    const def = Store.defaultCard();

    const l = layer(`
      <div class="sheet-head"><h3>${icon('out')} Withdraw</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="alert alert--${r.open ? 'info' : 'warn'} show">${icon(r.open ? 'clock' : 'alert')}
        <span>${r.open ? 'Window open' : 'Window closed'} · ${esc(r.days)} · ${esc(r.window)} WAT · ${r.usedToday}/${r.cap} used today</span></div>
      <div style="margin-bottom:14px">${cardVisual(def)}</div>
      ${cards.length > 1
        ? `<div class="field-row"><label class="label" for="wCard">Payout card</label>
            <div class="input-wrap">${icon('bank')}<select class="input" id="wCard">
              ${cards.map(c => `<option value="${c.id}" ${c.id === def.id ? 'selected' : ''}>${esc(c.bank_name)} · ${esc(c.account_number)}</option>`).join('')}
            </select></div></div>`
        : `<input type="hidden" id="wCard" value="${def.id}">`}
      <form id="wForm">
        <div class="field-row"><label class="label" for="wAmt">Amount (₦)</label>
          <div class="input-wrap">${icon('wallet')}
            <input class="input" id="wAmt" type="number" inputmode="numeric"
              min="${r.min}" max="${r.max}" placeholder="${r.min}" required></div>
          <p class="hint">Available ${naira(w.balance - w.locked)} · Min ${naira(r.min)} · Max ${naira(r.max)}</p></div>
        <div class="total-box">
          <div class="kv"><span class="k">Withdrawal amount</span><span class="v" id="wGross">${naira(0)}</span></div>
          <div class="kv"><span class="k">Processing fee (${s.withdrawal_fee}%)</span><span class="v c-red" id="wFee">${naira(0)}</span></div>
          <div class="kv grand"><span class="k">You receive</span><span class="v" id="wNet">${naira(0)}</span></div>
        </div>
        <button class="btn btn--red btn--block" type="submit" ${r.open ? '' : 'disabled'}>
          ${r.open ? 'Request withdrawal' : 'Withdrawals closed'}</button>
        <button class="btn btn--ghost btn--block btn--sm" type="button" id="wManage" style="margin-top:10px">Manage payout cards</button>
      </form>`, 'sheet');

    const calc = () => {
      const a = +l.querySelector('#wAmt').value || 0;
      const fee = Math.round(a * s.withdrawal_fee) / 100;
      l.querySelector('#wGross').textContent = naira(a);
      l.querySelector('#wFee').textContent = naira(fee);
      l.querySelector('#wNet').textContent = naira(a - fee);
    };
    l.querySelector('#wAmt').addEventListener('input', calc);
    l.querySelector('#wManage').addEventListener('click', () => { closeLayer(); setTimeout(cardsSheet, 280); });
    l.querySelector('#wForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Processing…';
      try {
        const res = await Store.withdraw(l.querySelector('#wAmt').value, l.querySelector('#wCard').value);
        closeLayer();
        toast('Withdrawal requested', 'ok', {
          sub: naira(res.net) + ' net · ' + res.reference,
          undo: () => { Store.undo(); refresh(); toast('Withdrawal cancelled', 'info'); }
        });
        refresh();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  /* ================= check-in ================= */
  function checkinSheet() {
    const st = Store.checkinState();
    const s = Store.settings();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('flame')} Daily attendance</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="streak"><span class="streak-flame">🔥</span>
        <div><b>${st.streak}</b><span>day streak · best ${st.longest || 0}</span></div></div>
      <div class="total-box">
        <div class="kv"><span class="k">Today’s attendance bonus</span><span class="v c-green">${naira(st.bonus)}</span></div>
        <div class="kv"><span class="k">Day 7 streak</span><span class="v">+${s.streak_7}%</span></div>
        <div class="kv"><span class="k">Day 14 streak</span><span class="v">+${s.streak_14}%</span></div>
        <div class="kv"><span class="k">Day 30 streak</span><span class="v">+${s.streak_30}%</span></div>
      </div>
      <div class="cal" style="margin-bottom:16px">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${st.calendar.map(c => `<div class="cal-day ${c.hit ? 'hit' : c.isToday ? 'today' : c.future ? 'future' : 'miss'}">${c.d}</div>`).join('')}
      </div>
      <p class="c-muted" style="font-size:12px;font-weight:600;margin-bottom:14px">Attendance is a bonus on top of your rental income. Missing a day resets your streak — your 24-hour drops continue regardless.</p>
      <button class="btn btn--primary btn--block" type="button" id="ciBtn" ${st.claimed ? 'disabled' : ''}>
        ${st.claimed ? 'Already checked in today' : 'Claim ' + naira(st.bonus)}</button>`, 'sheet');

    const b = l.querySelector('#ciBtn');
    if (!st.claimed) b.addEventListener('click', async () => {
      const old = b.innerHTML;
      b.disabled = true; b.innerHTML = '<i class="spin"></i> Claiming…';
      try {
        const r = await Store.checkin();
        closeLayer();
        toast('+' + naira(r.total) + ' attendance bonus', 'ok', {
          sub: 'Day ' + r.streak + (r.pct ? ' · +' + r.pct + '% streak boost' : ''),
          undo: () => { Store.undo(); refresh(); toast('Check-in reversed', 'info'); }
        });
        refresh();
      } catch (err) { toast(err.message, 'err'); b.disabled = false; b.innerHTML = old; }
    });
  }

  /* ================= history ================= */
  function historySheet() {
    const TYPES = [
      ['all', 'All'], ['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'],
      ['rental_income', 'Income'], ['checkin_bonus', 'Attendance'], ['lease_purchase', 'Leases']
    ];
    let filter = 'all';
    const l = layer(`
      <div class="sheet-head"><h3>${icon('hist')} Transaction history</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:10px;margin-bottom:6px">
        ${TYPES.map(([k, t], i) => `<button class="btn btn--${i === 0 ? 'blue' : 'ghost'} btn--xs" type="button" data-f="${k}">${t}</button>`).join('')}
      </div>
      <div class="rows" id="hRows"></div>`, 'sheet');

    const paint = () => {
      const tx = Store.transactions(filter);
      l.querySelector('#hRows').innerHTML = tx.length ? tx.map(t => {
        const inbound = ['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission'].includes(t.type);
        const ic = t.type === 'rental_income' ? 'in' : t.type === 'withdrawal' ? 'out' : t.type === 'lease_purchase' ? 'building' : 'gift';
        const cls = t.type === 'lease_purchase' ? 'rent' : t.type === 'withdrawal' ? 'out' : inbound ? 'in' : 'bonus';
        const st = t.status === 'completed' ? 'live' : t.status === 'pending' ? 'pending' : 'out';
        return `<div class="row"><span class="row-ic row-ic--${cls}">${icon(ic)}</span>
          <div class="row-main"><b>${esc(t.description)}</b><span>${dt(t.created_at)} · ${esc(t.reference)}</span></div>
          <div class="row-end"><div class="amt ${inbound ? 'in' : 'out'}">${inbound ? '+' : '−'}${naira(t.amount)}</div>
            <span class="tag tag--${st}">${t.status}</span></div></div>`;
      }).join('') : `<div class="empty"><div class="empty-art">${icon('hist')}</div>
        <b>Nothing here yet</b><p>Transactions of this type will appear once recorded.</p></div>`;
    };

    l.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f;
      l.querySelectorAll('[data-f]').forEach(x => { x.className = 'btn btn--ghost btn--xs'; });
      b.className = 'btn btn--blue btn--xs';
      paint();
    }));
    paint();
  }

  /* ================= gift / referral ================= */
  function giftSheet() {
    const s = Store.settings();
    const me = Store.me();
    const link = location.origin + '/register.html?ref=' + me.referral_code;
    const l = layer(`
      <div class="sheet-head"><h3>${icon('gift')} Rewards &amp; codes</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="card" style="background:var(--pink-tint);border-color:rgba(236,46,134,.24);margin-bottom:14px">
        <h4 style="margin-bottom:6px">Invite residents, earn on 3 levels</h4>
        <p class="c-muted" style="font-size:12.5px;font-weight:600">Level 1 pays ${s.referral_l1}% · Level 2 pays ${s.referral_l2}% · Level 3 pays ${s.referral_l3}% of every funded deposit in your network.</p>
      </div>
      <div class="code-big">${esc(me.referral_code)}</div>
      <div class="ref-box" style="margin-top:12px">
        <input id="gLink" readonly value="${esc(link)}">
        <button class="btn btn--primary btn--sm" type="button" id="gCopy">Copy</button>
      </div>
      <a class="btn btn--green btn--block" style="margin-top:14px" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">${icon('wa')} Get codes in the group</a>`, 'sheet');

    l.querySelector('#gCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(link)
        .then(() => toast('Referral link copied', 'ok'))
        .catch(() => { l.querySelector('#gLink').select(); toast('Select and copy the link', 'info'); });
    });
  }

  /* ================= refresh ================= */
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      paintBalance(); paintUnits(); paintLeases();
      const me = Store.me();
      if (!me) return;
      const g = document.getElementById('greet');
      if (g) g.textContent = (me.full_name || 'Member').trim().split(/\s+/)[0];

      const stats = document.getElementById('portStats');
      if (stats) {
        const ls = Store.leases();
        stats.innerHTML = `
          <div class="card" style="text-align:center;padding:14px 8px">
            <div class="c-muted" style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Active</div>
            <div class="dsp c-blue" style="font-size:22px;font-weight:800">${ls.filter(l => l.status === 'active').length}</div>
          </div>
          <div class="card" style="text-align:center;padding:14px 8px">
            <div class="c-muted" style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Per 24h</div>
            <div class="dsp c-green" style="font-size:20px;font-weight:800">${naira(Store.dailyIncome())}</div>
          </div>
          <div class="card" style="text-align:center;padding:14px 8px">
            <div class="c-muted" style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Collected</div>
            <div class="dsp c-pink" style="font-size:20px;font-weight:800">${naira(ls.reduce((s, l) => s + l.total_collected, 0))}</div>
          </div>`;
      }
    } finally { refreshing = false; }
  }

  /* ================= boot ================= */
  document.addEventListener('DOMContentLoaded', async () => {
    const sess = await UI.guard();
    if (!sess) return;

    Store.sweep();
    const me = Store.me();
    const s = Store.settings();

    UI.mountHeader({});
    UI.mountNav('dashboard.html');
    carousel();
    quickActions();
    refresh();

    const w = Store.wallet();
    countTo(document.getElementById('balMain'), w.balance, naira);
    countTo(document.getElementById('balIncome'), w.income, naira);

    document.getElementById('histBtn').addEventListener('click', historySheet);
    document.getElementById('fab').addEventListener('click', giftSheet);
    document.getElementById('seeLeases').addEventListener('click', () => {
      document.getElementById('leases').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    timers.push(setInterval(tickClocks, 1000));
    window.addEventListener('pinnacle:income', e => {
      refresh();
      toast('Income dropped', 'ok', {
        sub: naira(e.detail.amount) + ' across ' + e.detail.paid + ' drop' + (e.detail.paid > 1 ? 's' : '')
      });
    });
    window.addEventListener('beforeunload', clearTimers);

    UI.bootOff();
    setTimeout(() => welcome(me, s), 700);
  });
})();
