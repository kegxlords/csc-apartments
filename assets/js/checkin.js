/* ============================================================
   CSC APARTMENTS — Daily attendance
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dOnly, toast, countTo } = UI;

  function render() {
    const st = Store.checkinState(), s = Store.settings(), me = Store.me();

    document.getElementById('streak').innerHTML = `
      <div class="streak"><span class="streak-flame">🔥</span>
        <div style="flex:1"><b>${st.streak}</b><span>day streak · personal best ${st.longest || 0}</span></div>
        <div style="text-align:right"><b style="font-size:18px">${naira(s.checkin_bonus)}</b><span>base per day</span></div>
      </div>`;

    const pct = st.streak >= 30 ? s.streak_30 : st.streak >= 14 ? s.streak_14 : st.streak >= 7 ? s.streak_7 : 0;
    const todayValue = s.checkin_bonus + Math.round(s.checkin_bonus * pct) / 100;

    document.getElementById('claim').innerHTML = `
      <div class="claim-hero">
        <div class="k">${st.claimed ? 'Claimed today' : 'Available to claim'}</div>
        <div class="amt" id="claimAmt">${naira(st.claimed ? 0 : todayValue)}</div>
        ${pct ? `<div style="font-size:12px;font-weight:800;margin-top:6px">includes +${pct}% streak boost</div>` : ''}
      </div>
      <button class="btn btn--primary btn--block" type="button" id="claimBtn" ${st.claimed ? 'disabled' : ''} style="margin-bottom:16px">
        ${st.claimed ? icon('check') + ' Checked in — come back tomorrow' : icon('flame') + ' Claim ' + naira(todayValue)}
      </button>`;

    if (!st.claimed) countTo(document.getElementById('claimAmt'), todayValue, naira);

    document.getElementById('ladder').innerHTML = [[7, s.streak_7], [14, s.streak_14], [30, s.streak_30]]
      .map(([d, p]) => `<div class="tier ${st.streak >= d ? 'on' : ''}"><b>+${p}%</b><span>DAY ${d}</span></div>`).join('');

    const now = new Date();
    document.getElementById('calTitle').textContent =
      now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    document.getElementById('cal').innerHTML =
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="cal-dow">${d}</div>`).join('') +
      Array.from({ length: firstDow }, () => '<div></div>').join('') +
      st.calendar.map(c => `<div class="cal-day ${c.hit ? 'hit' : c.isToday ? 'today' : c.future ? 'future' : 'miss'}">${c.d}</div>`).join('');

    const hist = Store.transactions('checkin_bonus').slice(0, 8);
    document.getElementById('recent').innerHTML = hist.length ? hist.map(t => `
      <div class="row"><span class="row-ic row-ic--bonus">${icon('flame')}</span>
        <div class="row-main"><b>${esc(t.description)}</b><span>${dOnly(t.created_at)}</span></div>
        <div class="row-end"><div class="amt in">+${naira(t.amount)}</div></div></div>`).join('')
      : `<div class="empty"><div class="empty-art">${icon('flame')}</div><b>No check-ins yet</b><p>Claim today’s bonus to start your streak.</p></div>`;

    const btn = document.getElementById('claimBtn');
    if (!st.claimed) btn.addEventListener('click', async () => {
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Claiming…';
      try {
        const r = await Store.checkin();
        toast('+' + naira(r.total) + ' attendance bonus', 'ok', {
          sub: 'Day ' + r.streak + (r.pct ? ' · +' + r.pct + '% streak boost' : ''),
          undo: () => { Store.undo(); render(); toast('Check-in reversed', 'info'); }
        });
        render();
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    UI.mountHeader({ title: 'Check-In', back: 'dashboard.html' });
    UI.mountNav('dashboard.html');
    render();
    UI.bootOff();
  });
})();
