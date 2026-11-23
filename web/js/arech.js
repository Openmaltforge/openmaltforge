/* Paramètres › « À rechercher » : ingrédients rencontrés à l'import (PDF) mais absents de la base OpenMaltForge, et prompt prêt à copier pour les faire
   rechercher sur le net et obtenir des fichiers CSV à importer. La section n'apparaît que s'il y a quelque chose à rechercher. Chargé AVANT app.js. */
const ARC = {
  malts: { f: 'malts_nouveaux.csv', scr: 'Malts' },
  hops: { f: 'houblons_nouveaux.csv', scr: 'Houblons' },
  yeasts: { f: 'levures_nouvelles.csv', scr: 'Levures' },
  ings: { f: 'ingredients_nouveaux.csv', scr: 'Ingrédients' }
};
const arList = () =>
  ((S.kv && S.kv.equip && S.kv.equip.arech) || []).filter(x => !bxMatch(x.t, x.n) && !find(x.t, x.n));
const arEx = t => {
  const o =
    S[t] &&
    S[t].find(x =>
      CB(t)
        .filter(c => c !== 'name')
        .some(
          c => x[c] !== '' && x[c] !== 0 && x[c] != null && c !== 'prix_kg' && c !== 'prix_g' && c !== 'prix_sachet'
        )
    );
  return o ? CB(t).map(c => csvEsc(o[c])).join(';') : '';
};
/* textes du prompt dans chaque langue de l'interface (le prompt suit la langue choisie dans Paramètres › Réglages) */
const ARP = {
  fr: {
    cat: { malts: 'MALTS', hops: 'HOUBLONS', yeasts: 'LEVURES', ings: 'INGRÉDIENTS DIVERS (clarifiants, sels, épices…)' },
    intro:
      "Tu es un brasseur professionnel et tu as accès à Internet. Je construis ma base d'ingrédients dans l'application OpenMaltForge. Les ingrédients ci-dessous sont apparus dans des recettes importées mais n'existent pas dans ma base.\n\nMISSION : recherche sur le net les caractéristiques de chacun de ces ingrédients, puis génère pour chaque catégorie un FICHIER CSV prêt à être importé dans OpenMaltForge (bouton « Coller CSV » de l'écran correspondant).\n\n",
    file: 'fichier',
    data: 'données de la recette : ',
    seen: 'vu dans : ',
    common:
      'RÈGLES COMMUNES POUR LES CSV :\n- Un fichier CSV par catégorie ci-dessus, nommé comme indiqué, copiable à partir d’un bloc de texte brut.\n- Encodage UTF-8, séparateur point-virgule (;), point comme séparateur décimal, une ligne par ingrédient, aucune ligne vide, pas de guillemets sauf si une valeur contient un point-virgule.\n- Première ligne = en-têtes EXACTEMENT comme indiqué pour chaque fichier (même ordre, mêmes noms).\n- Colonne « name » : recopier le nom tel que donné dans ma liste (sans le modifier), pour que OpenMaltForge le reconnaisse dans mes recettes.\n- Ne rien inventer : laisser la cellule vide si la donnée est introuvable. Cherche d’abord chez le fabricant, puis sur des sites de référence (beermaverick.com, brewersfriend.com, hopslist.com, le laboratoire). Les CSV ne doivent contenir QUE les colonnes d’en-tête indiquées : aucune colonne « source », aucune URL, aucun lien, aucune référence ni note dans les cellules. Si tu veux citer tes sources, fais-le uniquement dans le récapitulatif final, jamais dans les CSV. Colonne de prix : mets 0 si tu ne trouves pas le prix (jamais de cellule vide pour le prix).\n- Après les CSV, ajoute un court récapitulatif : les ingrédients dont les données sont incertaines ou introuvables.\n\n',
    FILE: 'FICHIER',
    head: 'En-têtes : ',
    cols: 'Colonnes : ',
    ex: "Exemple d'une ligne de ma base (pour le format) : ",
    rules: {
      malts:
        'name = nom exact donné ci-dessus ; maltier = malterie / fabricant ; ebc = couleur en EBC ; potentiel = rendement extrait à sec (%) × 3,846 (ex. 77 % → 296,4) ; ppg et b46 : laisser vides (calculés par OpenMaltForge) ; cereale, biscuit, malte, caramel, chocolat, sucre, fruits_secs, cafe, toaste, raisin, vanille, miel, acide, amer, fume = notes aromatiques entières de 0 à 5 ; prix_kg = prix en €/kg ; 0 si introuvable.',
      hops: 'name = nom exact donné ci-dessus ; alpha_min / alpha_max = acides alpha en % (fourchette du fabricant ; si une seule valeur, la mettre dans les deux) ; citrus, tropical_fruit, stone_fruit, berry, floral, grassy, herbal, spice, resin_pin = notes aromatiques entières de 0 à 5 ; prix_g = prix en €/g ; 0 si introuvable.',
      yeasts:
        'name = nom exact donné ci-dessus ; labo = laboratoire ; att_min / att_max = atténuation apparente en % ; floc_min / floc_max = floculation en % (ex. moyenne = 30 à 50) ; t_min / t_max = température de fermentation en °C ; fruits_tropicaux, banane, pomme_verte, clou_girofle, acide, poivre, alcoolise, neutre, pomme_rouge = notes aromatiques entières de 0 à 5 ; prix_sachet = prix du sachet en € ; 0 si introuvable.',
      ings: "name = nom exact donné ci-dessus ; type = nature (clarifiant, sel minéral, épice, acide, nutriment de levure, sucre, fruit…) ; dose_g_L = dose habituelle en g par litre ; usage = moment d'ajout (empâtage, ébullition, fin d'ébullition, fermentation…) ; prix_g = prix en €/g ; 0 si introuvable."
    }
  },
  en: {
    cat: { malts: 'MALTS', hops: 'HOPS', yeasts: 'YEASTS', ings: 'MISCELLANEOUS INGREDIENTS (finings, salts, spices…)' },
    intro:
      'You are a professional brewer with Internet access. I am building my ingredient database in the OpenMaltForge application. The ingredients below appeared in imported recipes but do not exist in my database.\n\nMISSION: look up the characteristics of each of these ingredients on the web, then generate for each category a CSV FILE ready to be imported into OpenMaltForge (“Paste CSV” button of the matching screen).\n\n',
    file: 'file',
    data: 'recipe data: ',
    seen: 'seen in: ',
    common:
      'COMMON RULES FOR THE CSV FILES:\n- One CSV file per category above, named as indicated, copyable from a plain text block.\n- UTF-8 encoding, semicolon (;) separator, dot as decimal separator, one line per ingredient, no empty lines, no quotes unless a value contains a semicolon.\n- First line = headers EXACTLY as indicated for each file (same order, same names).\n- “name” column: copy the name exactly as given in my list (unchanged), so that OpenMaltForge recognises it in my recipes.\n- Do not invent anything: leave the cell empty if the data cannot be found. Look first at the manufacturer, then on reference sites (beermaverick.com, brewersfriend.com, hopslist.com, the yeast lab). The CSV files must contain ONLY the indicated header columns: no “source” column, no URL, no link, no reference or note in the cells. If you want to cite your sources, do it only in the final summary, never in the CSV files. Price column: put 0 if you cannot find the price (never an empty cell for the price).\n- After the CSV files, add a short summary: the ingredients whose data is uncertain or could not be found.\n\n',
    FILE: 'FILE',
    head: 'Headers: ',
    cols: 'Columns: ',
    ex: 'Example of a line from my database (for the format): ',
    rules: {
      malts:
        'name = exact name given above; maltier = maltster / manufacturer; ebc = colour in EBC; potentiel = dry basis extract yield (%) × 3.846 (e.g. 77 % → 296.4); ppg and b46: leave empty (calculated by OpenMaltForge); cereale, biscuit, malte, caramel, chocolat, sucre, fruits_secs, cafe, toaste, raisin, vanille, miel, acide, amer, fume = whole aroma scores from 0 to 5; prix_kg = price in €/kg; 0 if not found.',
      hops: 'name = exact name given above; alpha_min / alpha_max = alpha acids in % (manufacturer range; if only one value, put it in both); citrus, tropical_fruit, stone_fruit, berry, floral, grassy, herbal, spice, resin_pin = whole aroma scores from 0 to 5; prix_g = price in €/g; 0 if not found.',
      yeasts:
        'name = exact name given above; labo = laboratory; att_min / att_max = apparent attenuation in %; floc_min / floc_max = flocculation in % (e.g. medium = 30 to 50); t_min / t_max = fermentation temperature in °C; fruits_tropicaux, banane, pomme_verte, clou_girofle, acide, poivre, alcoolise, neutre, pomme_rouge = whole aroma scores from 0 to 5; prix_sachet = price per sachet in €; 0 if not found.',
      ings: 'name = exact name given above; type = nature (fining, mineral salt, spice, acid, yeast nutrient, sugar, fruit…); dose_g_L = usual dose in g per litre; usage = time of addition (mash, boil, end of boil, fermentation…); prix_g = price in €/g; 0 if not found.'
    }
  },
  es: {
    cat: { malts: 'MALTAS', hops: 'LÚPULOS', yeasts: 'LEVADURAS', ings: 'INGREDIENTES VARIOS (clarificantes, sales, especias…)' },
    intro:
      'Eres un cervecero profesional con acceso a Internet. Estoy construyendo mi base de ingredientes en la aplicación OpenMaltForge. Los ingredientes de abajo aparecieron en recetas importadas pero no existen en mi base.\n\nMISIÓN: busca en la web las características de cada uno de estos ingredientes y genera para cada categoría un ARCHIVO CSV listo para importar en OpenMaltForge (botón «Pegar CSV» de la pantalla correspondiente).\n\n',
    file: 'archivo',
    data: 'datos de la receta: ',
    seen: 'visto en: ',
    common:
      'REGLAS COMUNES PARA LOS CSV:\n- Un archivo CSV por categoría de arriba, con el nombre indicado, copiable desde un bloque de texto plano.\n- Codificación UTF-8, separador punto y coma (;), punto como separador decimal, una línea por ingrediente, sin líneas vacías, sin comillas salvo si un valor contiene un punto y coma.\n- Primera línea = encabezados EXACTAMENTE como se indica para cada archivo (mismo orden, mismos nombres).\n- Columna «name»: copia el nombre tal como figura en mi lista (sin modificarlo), para que OpenMaltForge lo reconozca en mis recetas.\n- No inventes nada: deja la celda vacía si el dato no se encuentra. Busca primero en el fabricante y luego en sitios de referencia (beermaverick.com, brewersfriend.com, hopslist.com, el laboratorio). Los CSV deben contener SOLO las columnas de encabezado indicadas: ninguna columna «source», ninguna URL, ningún enlace, ninguna referencia ni nota en las celdas. Si quieres citar tus fuentes, hazlo solo en el resumen final, nunca en los CSV. Columna de precio: pon 0 si no encuentras el precio (nunca una celda vacía para el precio).\n- Después de los CSV, añade un breve resumen: los ingredientes cuyos datos son inciertos o no se encontraron.\n\n',
    FILE: 'ARCHIVO',
    head: 'Encabezados: ',
    cols: 'Columnas: ',
    ex: 'Ejemplo de una línea de mi base (para el formato): ',
    rules: {
      malts:
        'name = nombre exacto indicado arriba; maltier = maltería / fabricante; ebc = color en EBC; potentiel = rendimiento de extracto en seco (%) × 3,846 (p. ej. 77 % → 296,4); ppg y b46: dejar vacíos (los calcula OpenMaltForge); cereale, biscuit, malte, caramel, chocolat, sucre, fruits_secs, cafe, toaste, raisin, vanille, miel, acide, amer, fume = notas aromáticas enteras de 0 a 5; prix_kg = precio en €/kg; 0 si no se encuentra.',
      hops: 'name = nombre exacto indicado arriba; alpha_min / alpha_max = ácidos alfa en % (rango del fabricante; si solo hay un valor, ponerlo en ambos); citrus, tropical_fruit, stone_fruit, berry, floral, grassy, herbal, spice, resin_pin = notas aromáticas enteras de 0 a 5; prix_g = precio en €/g; 0 si no se encuentra.',
      yeasts:
        'name = nombre exacto indicado arriba; labo = laboratorio; att_min / att_max = atenuación aparente en %; floc_min / floc_max = floculación en % (p. ej. media = 30 a 50); t_min / t_max = temperatura de fermentación en °C; fruits_tropicaux, banane, pomme_verte, clou_girofle, acide, poivre, alcoolise, neutre, pomme_rouge = notas aromáticas enteras de 0 a 5; prix_sachet = precio del sobre en €; 0 si no se encuentra.',
      ings: 'name = nombre exacto indicado arriba; type = naturaleza (clarificante, sal mineral, especia, ácido, nutriente de levadura, azúcar, fruta…); dose_g_L = dosis habitual en g por litro; usage = momento de adición (maceración, hervido, fin del hervido, fermentación…); prix_g = precio en €/g; 0 si no se encuentra.'
    }
  },
  it: {
    cat: { malts: 'MALTI', hops: 'LUPPOLI', yeasts: 'LIEVITI', ings: 'INGREDIENTI VARI (chiarificanti, sali, spezie…)' },
    intro:
      'Sei un birraio professionista con accesso a Internet. Sto costruendo il mio database di ingredienti nell’applicazione OpenMaltForge. Gli ingredienti qui sotto sono comparsi in ricette importate ma non esistono nel mio database.\n\nMISSIONE: cerca sul web le caratteristiche di ciascuno di questi ingredienti, poi genera per ogni categoria un FILE CSV pronto da importare in OpenMaltForge (pulsante «Incolla CSV» della schermata corrispondente).\n\n',
    file: 'file',
    data: 'dati della ricetta: ',
    seen: 'visto in: ',
    common:
      'REGOLE COMUNI PER I CSV:\n- Un file CSV per ciascuna categoria qui sopra, con il nome indicato, copiabile da un blocco di testo semplice.\n- Codifica UTF-8, separatore punto e virgola (;), punto come separatore decimale, una riga per ingrediente, nessuna riga vuota, niente virgolette salvo se un valore contiene un punto e virgola.\n- Prima riga = intestazioni ESATTAMENTE come indicato per ogni file (stesso ordine, stessi nomi).\n- Colonna «name»: copia il nome così come compare nel mio elenco (senza modificarlo), perché OpenMaltForge lo riconosca nelle mie ricette.\n- Non inventare nulla: lascia la cella vuota se il dato è introvabile. Cerca prima presso il produttore, poi su siti di riferimento (beermaverick.com, brewersfriend.com, hopslist.com, il laboratorio). I CSV devono contenere SOLO le colonne di intestazione indicate: nessuna colonna «source», nessun URL, nessun link, nessun riferimento né nota nelle celle. Se vuoi citare le fonti, fallo solo nel riepilogo finale, mai nei CSV. Colonna del prezzo: metti 0 se non trovi il prezzo (mai una cella vuota per il prezzo).\n- Dopo i CSV, aggiungi un breve riepilogo: gli ingredienti i cui dati sono incerti o introvabili.\n\n',
    FILE: 'FILE',
    head: 'Intestazioni: ',
    cols: 'Colonne: ',
    ex: 'Esempio di una riga del mio database (per il formato): ',
    rules: {
      malts:
        'name = nome esatto indicato sopra; maltier = malteria / produttore; ebc = colore in EBC; potentiel = resa in estratto secco (%) × 3,846 (es. 77 % → 296,4); ppg e b46: lasciare vuoti (calcolati da OpenMaltForge); cereale, biscuit, malte, caramel, chocolat, sucre, fruits_secs, cafe, toaste, raisin, vanille, miel, acide, amer, fume = note aromatiche intere da 0 a 5; prix_kg = prezzo in €/kg; 0 se introvabile.',
      hops: 'name = nome esatto indicato sopra; alpha_min / alpha_max = alfa acidi in % (intervallo del produttore; se c’è un solo valore, metterlo in entrambi); citrus, tropical_fruit, stone_fruit, berry, floral, grassy, herbal, spice, resin_pin = note aromatiche intere da 0 a 5; prix_g = prezzo in €/g; 0 se introvabile.',
      yeasts:
        'name = nome esatto indicato sopra; labo = laboratorio; att_min / att_max = attenuazione apparente in %; floc_min / floc_max = flocculazione in % (es. media = da 30 a 50); t_min / t_max = temperatura di fermentazione in °C; fruits_tropicaux, banane, pomme_verte, clou_girofle, acide, poivre, alcoolise, neutre, pomme_rouge = note aromatiche intere da 0 a 5; prix_sachet = prezzo della bustina in €; 0 se introvabile.',
      ings: 'name = nome esatto indicato sopra; type = natura (chiarificante, sale minerale, spezia, acido, nutriente per lievito, zucchero, frutta…); dose_g_L = dose abituale in g per litro; usage = momento di aggiunta (ammostamento, bollitura, fine bollitura, fermentazione…); prix_g = prezzo in €/g; 0 se introvabile.'
    }
  },
  pt: {
    cat: { malts: 'MALTES', hops: 'LÚPULOS', yeasts: 'LEVEDURAS', ings: 'INGREDIENTES DIVERSOS (clarificantes, sais, especiarias…)' },
    intro:
      'És um cervejeiro profissional com acesso à Internet. Estou a construir a minha base de ingredientes na aplicação OpenMaltForge. Os ingredientes abaixo apareceram em receitas importadas mas não existem na minha base.\n\nMISSÃO: pesquisa na web as características de cada um destes ingredientes e gera para cada categoria um FICHEIRO CSV pronto a importar no OpenMaltForge (botão «Colar CSV» do ecrã correspondente).\n\n',
    file: 'ficheiro',
    data: 'dados da receita: ',
    seen: 'visto em: ',
    common:
      'REGRAS COMUNS PARA OS CSV:\n- Um ficheiro CSV por cada categoria acima, com o nome indicado, copiável a partir de um bloco de texto simples.\n- Codificação UTF-8, separador ponto e vírgula (;), ponto como separador decimal, uma linha por ingrediente, sem linhas vazias, sem aspas exceto se um valor contiver um ponto e vírgula.\n- Primeira linha = cabeçalhos EXATAMENTE como indicado para cada ficheiro (mesma ordem, mesmos nomes).\n- Coluna «name»: copia o nome tal como aparece na minha lista (sem o alterar), para que o OpenMaltForge o reconheça nas minhas receitas.\n- Não inventes nada: deixa a célula vazia se o dado não for encontrado. Procura primeiro no fabricante e depois em sites de referência (beermaverick.com, brewersfriend.com, hopslist.com, o laboratório). Os CSV devem conter APENAS as colunas de cabeçalho indicadas: nenhuma coluna «source», nenhum URL, nenhuma ligação, nenhuma referência nem nota nas células. Se quiseres citar as fontes, fá-lo apenas no resumo final, nunca nos CSV. Coluna do preço: põe 0 se não encontrares o preço (nunca uma célula vazia para o preço).\n- Depois dos CSV, acrescenta um breve resumo: os ingredientes cujos dados são incertos ou não foram encontrados.\n\n',
    FILE: 'FICHEIRO',
    head: 'Cabeçalhos: ',
    cols: 'Colunas: ',
    ex: 'Exemplo de uma linha da minha base (para o formato): ',
    rules: {
      malts:
        'name = nome exato indicado acima; maltier = maltaria / fabricante; ebc = cor em EBC; potentiel = rendimento de extrato seco (%) × 3,846 (ex. 77 % → 296,4); ppg e b46: deixar vazios (calculados pelo OpenMaltForge); cereale, biscuit, malte, caramel, chocolat, sucre, fruits_secs, cafe, toaste, raisin, vanille, miel, acide, amer, fume = notas aromáticas inteiras de 0 a 5; prix_kg = preço em €/kg; 0 se não encontrado.',
      hops: 'name = nome exato indicado acima; alpha_min / alpha_max = ácidos alfa em % (intervalo do fabricante; se só houver um valor, pô-lo nos dois); citrus, tropical_fruit, stone_fruit, berry, floral, grassy, herbal, spice, resin_pin = notas aromáticas inteiras de 0 a 5; prix_g = preço em €/g; 0 se não encontrado.',
      yeasts:
        'name = nome exato indicado acima; labo = laboratório; att_min / att_max = atenuação aparente em %; floc_min / floc_max = floculação em % (ex. média = 30 a 50); t_min / t_max = temperatura de fermentação em °C; fruits_tropicaux, banane, pomme_verte, clou_girofle, acide, poivre, alcoolise, neutre, pomme_rouge = notas aromáticas inteiras de 0 a 5; prix_sachet = preço da saqueta em €; 0 se não encontrado.',
      ings: 'name = nome exato indicado acima; type = natureza (clarificante, sal mineral, especiaria, ácido, nutriente de levedura, açúcar, fruta…); dose_g_L = dose habitual em g por litro; usage = momento de adição (brassagem, fervura, fim da fervura, fermentação…); prix_g = preço em €/g; 0 se não encontrado.'
    }
  }
};
function arPrompt(L, lang) {
  L = L || arList();
  const P = ARP[lang || (typeof LANG !== 'undefined' ? LANG : 'fr')] || ARP.fr,
    by = t => L.filter(x => x.t === t),
    cats = Object.keys(ARC).filter(t => by(t).length);
  if (!cats.length) return '';
  const H = {
    malts: CB('malts').join(';'),
    hops: CB('hops').join(';'),
    yeasts: CB('yeasts').join(';'),
    ings: CB('ings').join(';')
  };
  let s = P.intro;
  for (const t of cats) {
    s +=
      '=== ' +
      P.cat[t] +
      ' (' +
      by(t).length +
      ') → ' +
      P.file +
      ' ' +
      ARC[t].f +
      ' ===\n' +
      by(t)
        .map(
          x =>
            '- ' +
            x.n +
            (x.i || (x.r && x.r.length)
              ? ' (' + [x.i && P.data + x.i, x.r && x.r.length && P.seen + x.r.join(' ; ')].filter(Boolean).join(' — ') + ')'
              : '')
        )
        .join('\n') +
      '\n\n';
  }
  s += P.common;
  for (const t of cats) {
    s +=
      P.FILE +
      ' ' +
      ARC[t].f +
      '\n' +
      P.head +
      H[t] +
      '\n' +
      P.cols +
      P.rules[t] +
      '\n' +
      (arEx(t) ? P.ex + arEx(t) + '\n' : '') +
      '\n';
  }
  return s.trim();
}
/* changement de langue : le prompt affiché est régénéré dans la nouvelle langue */
document.addEventListener('change', e => {
  if (!e.target || e.target.id !== 'langsel') return;
  const ta = document.getElementById('arprompt');
  if (ta) ta.value = arPrompt();
});
function arPanel() {
  const L = arList();
  if (!L.length) return '';
  const chips = L.map(
    x =>
      `<span class="archip" title="${esc((x.r || []).join(' ; '))}">${esc(ARC[x.t].scr === 'Ingrédients' ? 'Divers' : ARC[x.t].scr)} · ${esc(x.n)}<button class="x" data-arx="${esc(x.t + '|' + x.n)}" title="Retirer de la liste">✕</button></span>`
  ).join('');
  return `<div class="full"><div class="panel" id="arpanel"><h3>🔎 À rechercher (${L.length})<button id="arcopy" title="Copier le prompt pour l’envoyer à une IA ayant accès au web">📋 Copier le prompt</button><button id="arclr" class="dng">Tout effacer</button></h3><p class="arn">Ingrédients rencontrés à l’import (PDF) et absents de la base OpenMaltForge : ils sont restés en simple texte dans les recettes. Copiez le prompt ci-dessous : il demande de les rechercher sur le net et de générer des fichiers CSV à importer dans les écrans Malts, Houblons, Levures et Ingrédients. Une fois importés, ils disparaissent de cette liste.</p><div class="archips">${chips}</div><textarea id="arprompt" readonly spellcheck="false" rows="12">${hh(arPrompt(L))}</textarea></div></div>`;
}
document.addEventListener('click', e => {
  const t = e.target;
  if (!t || !t.closest) return;
  const c = t.closest('#arcopy');
  if (c) {
    const ta = document.getElementById('arprompt'),
      ok = () => {
        c.textContent = '✔ Copié';
        setTimeout(() => {
          c.textContent = '📋 Copier le prompt';
        }, 1500);
      };
    if (navigator.clipboard)
      navigator.clipboard.writeText(ta.value).then(ok, () => {
        ta.select();
        document.execCommand('copy');
        ok();
      });
    else {
      ta.select();
      document.execCommand('copy');
      ok();
    }
    return;
  }
  const x = t.closest('[data-arx]');
  if (x) {
    const k = x.dataset.arx,
      E = S.kv.equip;
    E.arech = (E.arech || []).filter(y => y.t + '|' + y.n !== k);
    save();
    params();
    return;
  }
  if (t.closest('#arclr')) {
    S.kv.equip.arech = [];
    save();
    params();
  }
});
