// Base d'interactions médicamenteuses connues — SOURCE UNIQUE DE VÉRITÉ.
// Avant centralisation, trois versions divergentes coexistaient :
//   - ai.controller.js       : 15 règles (la plus complète)
//   - prescriptions.controller.js : 2 règles codées en dur
//   - pharmacy.controller.js      : 1 règle codée en dur
// Un médicament dangereux détecté par l'IA pouvait donc passer inaperçu à
// la prescription ou à la dispensation, selon le contrôleur qui vérifiait.
const INTERACTIONS_DB = [
  { drugs: ['quinine', 'digoxin', 'digoxine'],        risque: 'elevé',   description: 'La quinine augmente les concentrations de digoxine — risque de toxicité digitalique (arythmie, bradycardie).' },
  { drugs: ['metronidazole', 'alcool', 'alcohol'],    risque: 'elevé',   description: 'Association contre-indiquée : effet antabuse (nausées, vomissements, bouffées vasomotrices).' },
  { drugs: ['warfarine', 'aspirine', 'ibuprofene', 'naproxene'], risque: 'elevé', description: 'AINS + anticoagulant : risque hémorragique majeur.' },
  { drugs: ['methotrexate', 'cotrimoxazole', 'trimethoprime'], risque: 'elevé', description: 'Potentialisation de la toxicité hématologique du méthotrexate.' },
  { drugs: ['chloroquine', 'amiodarone'],             risque: 'elevé',   description: 'Allongement du QT — risque de torsades de pointes.' },
  { drugs: ['rifampicine', 'contraceptifs'],          risque: 'modéré', description: 'La rifampicine réduit l\'efficacité des contraceptifs oraux.' },
  { drugs: ['inhibiteur_eca', 'spironolactone', 'amiloride'], risque: 'modéré', description: 'Risque d\'hyperkaliémie avec les diurétiques épargneurs de potassium.' },
  { drugs: ['aminoside', 'gentamicine', 'amikacine', 'furosemide'], risque: 'modéré', description: 'Association néphrotoxique et ototoxique — surveiller la fonction rénale et l\'audition.' },
  { drugs: ['quinine', 'mefloquine'],                 risque: 'elevé',   description: 'Association déconseillée : risque de convulsions et cardiotoxicité.' },
  { drugs: ['artemether', 'efavirenz', 'nevirapine'], risque: 'modéré', description: 'Les antirétroviraux inducteurs enzymatiques réduisent les concentrations d\'artémether.' },
  { drugs: ['isoniazide', 'rifampicine', 'pyrazinamide'], risque: 'modéré', description: 'Hépatotoxicité cumulée des antituberculeux — surveiller les enzymes hépatiques.' },
  { drugs: ['ciprofloxacine', 'theophylline'],        risque: 'modéré', description: 'Augmentation des concentrations de théophylline — risque de toxicité.' },
  { drugs: ['morphine', 'benzodiazepine', 'diazepam', 'midazolam'], risque: 'elevé', description: 'Dépression respiratoire additive — surveillance étroite requise.' },
  { drugs: ['paracetamol', 'acetaminophen'],          risque: 'faible',  description: 'Paracétamol : vérifier que la dose totale/24h ne dépasse pas 4g (3g si insuffisance hépatique).' },
  { drugs: ['metformine', 'produit_de_contraste'],    risque: 'modéré', description: 'Arrêter la metformine 48h avant injection de produit de contraste iodé — risque d\'acidose lactique.' },
];

/**
 * Détecte les interactions connues parmi une liste de noms de médicaments.
 * @param {string[]} medNames noms en minuscules (ex: ['warfarine','aspirine'])
 * @returns {{medicaments:string[], risque:string, description:string}[]}
 */
function detectInteractions(medNames) {
  const warnings = [];
  for (const rule of INTERACTIONS_DB) {
    const matched = rule.drugs.filter(d => medNames.some(m => m.includes(d)));
    if (matched.length >= 2) {
      warnings.push({ medicaments: matched, risque: rule.risque, description: rule.description });
    }
  }
  return warnings;
}

module.exports = { INTERACTIONS_DB, detectInteractions };
