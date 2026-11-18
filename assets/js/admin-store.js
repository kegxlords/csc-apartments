/* ============================================================
   PINNACLE APARTMENTS — Console data engine
   Single source of state on admin pages. Same store key as the
   member app, richly seeded, every mutation atomic + undoable.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'pinnacle.v1';
  const DAY = 86400000;
  const now = () => Date.now();
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const clone = o => JSON.parse(JSON.stringify(o));
  const code6 = () => Array.from({ length: 6 }, () => 'ACDEFGHJKLMNPQRTUVWXY3479'[Math.random() * 25 | 0]).join('');
  const ref = p => p + '-' + code6();
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- artwork (shared with member app) ---------- */
  const PAL = {
    studio: ['#3D9BFF', '#1F6FEB', '#123A8F'], 'one-bed': ['#FF6FB0', '#EC2E86', '#C2186B'],
    'two-bed': ['#35D68C', '#14A867', '#0B7A4B'], 'three-bed': ['#FF6A5E', '#E23B33', '#B3121B'],
    duplex: ['#3D9BFF', '#EC2E86', '#123A8F'], penthouse: ['#EC2E86', '#1F6FEB', '#123A8F']
  };
  function facade(tier, seed) {
    const p = PAL[tier] || PAL.studio;
    let s = seed || 1; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const floors = { studio: 4, 'one-bed': 5, 'two-bed': 6, 'three-bed': 7, duplex: 8, penthouse: 10 }[tier] || 5;
    let win = '';
    for (let f = 0; f < floors; f++) for (let c = 0; c < 4; c++) {
      const lit = rnd() > .38;
      win += `<rect x="${26 + c * 15}" y="${92 - f * (74 / floors)}" width="10" height="${Math.max(5, 60 / floors - 3)}" rx="1.5" fill="${lit ? '#FFD9EC' : '#123A8F'}" opacity="${lit ? .92 : .45}"/>`;
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs><rect width="120" height="120" fill="url(#s)"/><circle cx="94" cy="24" r="13" fill="#fff" opacity=".26"/><path d="M0 104 L20 96 L44 104 L70 94 L96 104 L120 96 L120 120 L0 120Z" fill="${p[2]}" opacity=".55"/><rect x="20" y="16" width="72" height="88" rx="3" fill="url(#b)"/><rect x="20" y="16" width="72" height="6" rx="3" fill="#FFD9EC" opacity=".8"/>${win}<rect x="50" y="92" width="14" height="12" rx="1.5" fill="#FFD9EC" opacity=".95"/></svg>`);
  }
  function banner(i) {
    const sets = [['#123A8F', '#1F6FEB', '#3D9BFF'], ['#C2186B', '#EC2E86', '#FF6FB0'], ['#0B7A4B', '#14A867',
