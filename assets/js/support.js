/* ============================================================
   CSC APARTMENTS — Support centre
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, ago, toast } = UI;
  const KEY = 'pinnacle.tickets.v2';

  const FAQ = [
    ['When does my rental income arrive?', 'Exactly 24 hours after your lease begins, then every 24 hours until all income days are paid. Each lease shows a live countdown on the My Leases page. Drops are automatic — you never need to claim them.'],
    ['What does “Out of income days” mean?', 'That lease has received every drop it was entitled to. The countdown is replaced by this label, the progress bar sits at 100%, and no further income is issued from it. Your collected total stays visible.'],
    ['Why is my withdrawal blocked?', 'Withdrawals run inside the window set by management, with a daily cap and one pending request at a time. You also need at least one active lease and a saved payout card. The Withdraw page shows exactly which rule is limiting you.'],
    ['How long do deposits take?', 'Submit the form immediately after your transfer. Our team reviews and credits it, and your balance updates the moment it is approved. Referral commissions to your upline fire at the same time.'],
    ['What is the check-in bonus?', 'A daily attendance reward paid on top of your rental income. Consecutive days build a streak with boosts at day 7, 14 and 30. Missing a day resets the streak but never affects your 24-hour drops.'],
    ['How do referral commissions work?', 'You earn on three levels. When anyone in your level 1, 2 or 3 network has a deposit approved, the configured percentage is credited to your wallet automatically and appears in your transaction history.'],
    ['Can I change my payout account?', 'Yes. Open Bank Cards, add the new account and set it as default. Withdrawals already in review keep the account they were submitted with.']
  ];

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = t => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} };

  function paintTickets() {
    const mine = load().filter(t => t.user === Store.me().id).sort((a, b) => b.at - a.at);
    const openEl = document.getElementById('openCount');
    if (openEl) openEl.textContent = mine.filter(t => t.status === 'open').length;
    const root = document.getElementById('tickets');
    root.innerHTML = mine.length ? mine.map(t => `
      <div class="ticket">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="flex:1;min-width:0"><b>${esc(t.subject)}</b>
            <span class="c-muted" style="font-size:11px;font-weight:700">${esc(t.category)} · ${ago(t.at)} · ${esc(t.ref)}</span></div>
          <span class="tag tag--${t.status === 'answered' ? 'live' : 'pending'}">${t.status}</span>
        </div>
        <p class="msg">${esc(t.message)}</p>
        ${t.reply ? `<div class="reply"><b style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:4px">Care team</b>${esc(t.reply)}</div>` : ''}
      </div>`).join('')
      : `<div class="empty"><div class="empty-art">${icon('headset')}</div><b>No tickets yet</b><p>Most questions are answered in the FAQ above. If not, open a ticket and we will reply here.</p></div>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    UI.mountHeader({ title: 'Support', back: 'dashboard.html' });
    UI.mountNav('profile.html');
    const s = Store.settings();

    document.getElementById('channels').innerHTML = `
      <a class="wa-btn wa-btn--wa" href="${esc(s.support_link)}" target="_blank" rel="noopener">${icon('wa')}<span>WhatsApp Care<small>Fastest response</small></span>${icon('chev')}</a>
      <a class="wa-btn wa-btn--cs" href="${esc(s.telegram_link)}" target="_blank" rel="noopener">${icon('refer')}<span>Telegram Channel<small>Announcements &amp; help</small></span>${icon('chev')}</a>
      <a class="wa-btn" style="background:var(--g-pink);box-shadow:var(--sh-pink)" href="mailto:${esc(s.support_email)}">${icon('mail')}<span>Email Us<small>${esc(s.support_email)}</small></span>${icon('chev')}</a>`;

    document.getElementById('faq').innerHTML = FAQ.map(([q, a], i) => `
      <div class="faq-item" data-i="${i}">
        <button class="faq-q" type="button">${icon('chev')}<span>${esc(q)}</span></button>
        <div class="faq-a"><p>${esc(a)}</p></div>
      </div>`).join('');

    document.querySelectorAll('.faq-item').forEach(item => {
      const btn = item.querySelector('.faq-q'), panel = item.querySelector('.faq-a');
      btn.addEventListener('click', () => {
        const open = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(o => {
          o.classList.remove('open'); o.querySelector('.faq-a').style.maxHeight = '0px';
        });
        if (!open) { item.classList.add('open'); panel.style.maxHeight = panel.scrollHeight + 'px'; }
      });
    });

    paintTickets();

    const alertEl = document.getElementById('alert');
    document.getElementById('tForm').addEventListener('submit', e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
      const subject = document.getElementById('subj').value.trim();
      const message = document.getElementById('msg').value.trim();
      if (subject.length < 4 || message.length < 12) {
        alertEl.className = 'alert alert--err show';
        alertEl.innerHTML = icon('alert') + '<span>Add a short subject and a message of at least 12 characters.</span>';
        return;
      }
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Sending…';
      const refNo = 'TKT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const all = load();
      all.push({
        id: refNo, ref: refNo, user: Store.me().id, category: document.getElementById('cat').value,
        subject, message, status: 'open', reply: '', at: Date.now()
      });
      save(all);
      alertEl.className = 'alert alert--ok show';
      alertEl.innerHTML = icon('check') + '<span>Ticket ' + refNo + ' opened. Our care team will reply here and on your contact channel.</span>';
      toast('Ticket opened', 'ok', { sub: refNo });
      e.target.reset();
      paintTickets();
      btn.disabled = false; btn.innerHTML = old;
    });

    UI.bootOff();
  });
})();
