/* Boîtes de dialogue aux couleurs d’OpenMaltForge (remplacent confirm / alert natifs).
   bcAsk(message,{title,ok,cancel,danger,ico,body,cls}) → Promise<boolean> ; bcAlert(message,title) → Promise. Entrée = valider, Échap = annuler.
   Chargé après i18n.js (utilise tx pour traduire message, titre et boutons). */
const bcT = s => (typeof tx === 'function' ? tx(s) : s);
function bcDlg(msg, o) {
  return new Promise(res => {
    o = o || {};
    const d = document.createElement('div');
    d.className = 'bcdlg noprint' + (o.cls ? ' ' + o.cls : '');
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('aria-modal', 'true');
    const e = s =>
        String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;'),
      prev = document.activeElement;
    d.innerHTML = `<div class="bcbox${o.danger ? ' dg' : ''}${o.wide ? ' wide' : ''}"><div class="bcico">${o.ico || (o.alert ? '⚠' : o.danger ? '🗑' : '?')}</div><div class="bcbd"><h4>${e(bcT(o.title || (o.alert ? 'Information' : 'Confirmation')))}</h4><p>${e(bcT(msg)).replace(/\n/g, '<br>')}</p>${o.body || ''}${o.input ? `<input class="bcin" placeholder="${e(bcT(o.placeholder || ''))}" value="${e(o.value || '')}" autocomplete="off"${o.list ? ' list="bcin-list"' : ''}>${o.list ? '<datalist id="bcin-list">' + o.list.map(x => '<option value="' + e(x) + '"></option>').join('') + '</datalist>' : ''}` : ''}</div><div class="bcbt">${o.alert ? '' : `<button class="no">${e(bcT(o.cancel || 'Annuler'))}</button>`}<button class="ok${o.danger ? ' dg' : ''}">${e(bcT(o.ok || 'OK'))}</button></div></div>`;
    const inp = () => d.querySelector('.bcin'),
      done = v => {
        if (v && o.collect) {
          const r = o.collect(d);
          if (r === undefined) return;
          v = r;
        } else if (o.collect) v = null;
        if (v && o.input) v = inp().value;
        else if (o.input) v = null;
        document.removeEventListener('keydown', kd, true);
        d.remove();
        try {
          prev && prev.focus && prev.focus();
        } catch (_) {}
        res(v);
      },
      kd = ev => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          done(false);
        } else if (
          ev.key === 'Enter' &&
          !(
            document.activeElement &&
            (document.activeElement.classList.contains('no') || document.activeElement.tagName === 'TEXTAREA')
          )
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          done(true);
        }
      };
    d.querySelector('.ok').onclick = () => done(true);
    const n = d.querySelector('.no');
    if (n) n.onclick = () => done(false);
    d.addEventListener('mousedown', ev => {
      if (ev.target === d && !o.alert) done(false);
    });
    document.addEventListener('keydown', kd, true);
    document.body.appendChild(d);
    (o.input
      ? inp()
      : o.collect
        ? d.querySelector('textarea') || d.querySelector('input') || d.querySelector('.ok')
        : o.danger && n
          ? n
          : d.querySelector('.ok')
    ).focus();
  });
}
const bcForm = (m, o) => bcDlg(m, o),
  bcAsk = (m, o) => bcDlg(m, o),
  bcPrompt = (m, o) => bcDlg(m, { ...(o || {}), input: 1 }),
  bcAlert = (m, t) => bcDlg(m, { alert: 1, title: t || 'Attention' });
