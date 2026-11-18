/* ============================================================
   CSC APARTMENTS — Payout cards
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, toast, dOnly } = UI;
  const A = Actions;

  function render() {
    const cards = Store.cards();
    const root = document.getElementById('list');

    if (!cards.length) {
      root.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty">
        <div class="empty-art">${icon('bank')}</div>
        <b>No payout cards yet</b>
        <p>Add the bank account you want your withdrawals paid into. You can save more than one.</p>
      </div></div>`;
      return;
    }

    root.innerHTML = cards.map(c => `
      <div>
        ${A.cardVisual(c)}
        <div class="card-actions">
          ${c.is_default
            ? `<span class="btn btn--soft btn--xs" style="flex:1;cursor:default">${icon('check')} Default card</span>`
            : `<button class="btn btn--soft btn--xs" type="button" style="flex:1" data-def="${c.id}">Set as default</button>`}
          <button class="btn btn--ghost btn--xs" type="button" data-copy="${esc(c.account_number)}">Copy number</button>
          <button class="btn btn--ghost btn--xs" type="button" data-del="${c.id}" aria-label="Remove card">${icon('trash')}</button>
        </div>
        <p class="c-muted" style="font-size:11px;font-weight:600;margin-top:8px">Added ${dOnly(c.created_at)}</p>
      </div>`).join('');

    A.wireCopy(root);
    root.querySelectorAll('[data-def]').forEach(b => b.addEventListener('click', async () => {
      await Store.setDefaultCard(b.dataset.def);
      toast('Default card updated', 'ok', { undo: () => { Store.undo(); render(); toast('Reverted', 'info'); } });
      render();
    }));
    root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => A.removeCard(b.dataset.del, render)));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    UI.mountHeader({ title: 'Bank Cards', back: 'withdraw.html' });
    UI.mountNav('profile.html');
    document.querySelectorAll('.row-ic').forEach((el, i) => {
      el.innerHTML = icon(['bank', 'shield', 'trash'][i] || 'bank');
    });
    render();
    document.getElementById('add').addEventListener('click', () => A.cardForm(render));
    UI.bootOff();
  });
})();
