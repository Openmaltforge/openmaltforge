/* Enregistre la recette en cours dans la bibliothèque puis télécharge son PDF : <sortie>/recette.pdf */
const path = require('path');
module.exports = async (p, out) => {
  await p.evaluate(async () => {
    document.getElementById('dbsave').click();
    await new Promise(r => setTimeout(r, 800));
    show('biblio');
  });
  await p.waitForTimeout(500);
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('[data-bpdf="0"]')]);
  await d.saveAs(path.join(out, 'recette.pdf'));
};
