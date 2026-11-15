/* Fiche recette (popup « Consulter ») : page soignée en lecture seule construite à partir de la bibliothèque */
const rvT = (h, rows, cls) =>
  `<table class="rvt${cls ? ' ' + cls : ''}"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`;
function rvHtml(b) {
  const R = b.recipe || {},
    E = S.kv.equip;
  let c = { og: 0, fg: 0, ibu: 0, ebc: 0, abv: 0, ibus: [] };
  try {
    withRec(b, () => {
      c = compute();
    });
  } catch (e) {}
  if (b.est) c = { ...c, ...Object.fromEntries(Object.entries(b.est).filter(([k, v]) => v != null)) };
  const tm = (R.malts || []).reduce((a, x) => a + (+x.g || 0), 0),
    ibus = c.ibus || [],
    miss = (t, n) =>
      n && !find(t, n) ? ' <span class="rvw" title="Absent de la base d’ingrédients">hors base</span>' : '';
  const tile = (l, v, u) => `<div class="rvk"><b>${v}</b>${u ? `<small>${u}</small>` : ''}<span>${l}</span></div>`;
  const eff = R.impd && R.impd.eff ? R.impd.eff : E.eff;
  const meta = [
    b.style ? hh(String(b.style).replace(/^\d+[A-Za-z]?\s+/, '')) : '',
    b.brasseur ? '👤 ' + hh(b.brasseur) : '',
    R.date ? '📅 ' + fd(R.date) : '',
    R.embou ? '🍾 Embouteillée le ' + fd(R.embou) : '',
    R.imp ? '<span class="rvi">🔒 Importée de ' + hh((R.impd && R.impd.src) || 'Beer.xml') + '</span>' : ''
  ]
    .filter(Boolean)
    .map(x => `<span>${x}</span>`)
    .join('');
  const malts = (R.malts || []).map(
    (m, i) =>
      `<tr><td class="n">${i + 1}</td><td>${hh(m.n)}${miss('malts', m.n)}</td><td class="r">${tm ? nf((m.g / tm) * 100, 0) + ' %' : '–'}</td><td class="r">${nf(m.g / 1000, 3)} kg</td></tr>`
  );
  const hops = (R.hops || []).map(
    (h, i) =>
      `<tr><td class="n">${i + 1}</td><td>${hh(h.n)}${miss('hops', h.n)}</td><td class="r">${nf(h.g, 1)} g</td><td>${hh(h.use || '')}</td><td class="r">${h.t === '' || h.t == null ? '–' : h.t + (h.use === 'Dry hop' ? ' j' : ' min')}</td><td class="r">${ibus[i] != null && !isNaN(+ibus[i]) ? nf(ibus[i], 1) : '–'}</td></tr>`
  );
  const ys = (R.yeasts || []).map(
    y =>
      `<tr><td>${hh(y.n)}${miss('yeasts', y.n)}</td><td class="r">${y.g || 1} sachet${(y.g || 1) > 1 ? 's' : ''}</td></tr>`
  );
  const ings = (R.ings || []).map(
    x =>
      `<tr><td>${hh(x.n)}${miss('ings', bxIngBase(x.n))}</td><td class="r">${x.g === '' || x.g == null ? '–' : nf(x.g, 1) + ' g'}</td></tr>`
  );
  const mash = (R.mash || [])
    .filter(r => r.t !== '' && r.t != null)
    .map(
      r =>
        `<tr><td>${hh(r.k)}</td><td class="r">${nf(r.t, 0)} °C</td><td class="r">${r.m === '' || r.m == null ? '–' : r.m + ' min'}</td></tr>`
    );
  const sec = (ic, t, body, cls) =>
    body ? `<section class="rvs${cls ? ' ' + cls : ''}"><h3><i>${ic}</i>${t}</h3>${body}</section>` : '';
  const kg = tm / 1000;
  return `<div class="rvbox" role="dialog" aria-modal="true"><header class="rvh"><div class="rvg">${bxGlass(bxColor(c.ebc))}</div><div class="rvhd"><h2>${hh(b.name || 'Sans nom')}</h2><div class="rvm">${meta}</div></div><button class="rvx" title="Fermer (Échap)" aria-label="Fermer">✕</button></header>
 <div class="rvbd"><div class="rvks">${tile('Densité init.', nf(c.og, 3))}${tile('Densité fin.', nf(c.fg, 3))}${tile('Amertume', '' + nf(c.ibu, 0), 'IBU')}${tile('Couleur', nf(c.ebc, 0), 'EBC')}${tile('Alcool', nf(c.abv, 1), '% vol.')}${tile('Volume', nf(b.vol || 20, 0), 'L')}${eff ? tile('Rendement', nf(eff, 0), '%') : ''}${kg ? tile('Grains', nf(kg, 2), 'kg') : ''}</div>
 <div class="rvgr">${sec('🌾', 'Malts', malts.length ? rvT(['#', 'Malt', '%', 'Poids'], malts) : '')}${sec('🌿', 'Houblons', hops.length ? rvT(['#', 'Houblon', 'Poids', 'Utilisation', 'Temps', 'IBU'], hops) : '')}
 ${sec('🧫', 'Levures', ys.length ? rvT(['Levure', 'Quantité'], ys) : '')}${sec('🧂', 'Autres ingrédients', ings.length ? rvT(['Ingrédient', 'Quantité'], ings) : '')}${sec('🌡', 'Empâtage et ébullition', mash.length ? rvT(['Étape', 'Température', 'Durée'], mash) : '')}</div>
 ${sec('📝', 'Notes', R.notes ? `<div class="rvn">${hh(R.notes)}</div>` : '', 'rvwide')}</div>
 <footer class="rvf"><button class="rvc">Fermer</button>${R.imp ? '<button class="rvcp go" data-bcopy="' + S.biblio.indexOf(b) + '">📄 Copier pour modifier</button>' : '<button class="rvo go">✎ Ouvrir dans la conception</button>'}</footer></div>`;
}
function rvOpen(i) {
  const b = S.biblio[i];
  if (!b) return;
  const d = document.createElement('div');
  d.className = 'rvov noprint';
  d.innerHTML = rvHtml(b);
  const prev = document.activeElement,
    close = () => {
      document.removeEventListener('keydown', kd, true);
      d.remove();
      try {
        prev && prev.focus && prev.focus();
      } catch (e) {}
    },
    kd = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
  d.addEventListener('mousedown', e => {
    if (e.target === d) close();
  });
  d.querySelector('.rvx').onclick = close;
  d.querySelector('.rvc').onclick = close;
  const o = d.querySelector('.rvo');
  if (o)
    o.onclick = () => {
      close();
      bxOpen(b);
    };
  const cp = d.querySelector('.rvcp');
  if (cp) cp.addEventListener('click', () => close());
  document.addEventListener('keydown', kd, true);
  document.body.appendChild(d);
  d.querySelector('.rvc').focus();
}
