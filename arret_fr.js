// Critère d'arrêt anticipé de la génération (français), source UNIQUE (publiée) : patch.js en recopie le
// corps dans localAI.js et scratch/vo/test_arret_anticipe.js le valide contre ge() du jeu.
// Vrai quand la suite de la génération ne peut plus changer ce que ge() affiche : 4 phrases (a2)
// fixées ET une suivante commencée, ou plus de Fd + 40 caractères. Sans geste déjà écrit, on
// attend 2 phrases de plus (« grâce ») : un geste final donne l'icône de réaction.
// Validé le 25/09/2026 sur 1 077 répliques : texte affiché identique à 100 %, icône à 98,3 %.
"use strict";
function hdfrPeutArreter(acc, a2, fd) {
    const ouvr = (acc.match(/\(/g) || []).length, ferm = (acc.match(/\)/g) || []).length;
    if (ouvr !== ferm || (acc.match(/\*/g) || []).length % 2) return false; // geste ouvert
    const propre = acc.replace(/\(([^)]*)\)|\*([^*]*)\*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // ge() retire les guillemets qui encadrent toute la réplique : impossible à trancher avant la fin
    if (!propre || '"“”«\''.includes(propre[0])) return false;
    const aGeste = /\(([^)]*)\)|\*([^*]*)\*/.test(acc);
    // Fin réelle de la n-ième phrase (et non la somme des longueurs : une réplique qui commence par
    // « … » décalait le calcul d'un caractère et coupait trop tôt, trouvé le 25/09/2026).
    const phrases = [...propre.matchAll(/[^.!?…]+[.!?…]+["”']?\s*/g)];
    const suite = (n) => phrases.length >= n &&
        propre.slice(phrases[n - 1].index + phrases[n - 1][0].length).trim().length > 0;
    const fixe = propre.length > fd + 40 || suite(a2);
    return fixe && (aGeste || suite(a2 + 2));
}
module.exports = { hdfrPeutArreter };
