# Suite de tests frontend (QA-002)

## Pourquoi cette suite existe

Avant la Sous-phase QA-002, **0 test frontend** n'existait dans ce projet — toute
la détection des ~150 constats factices de l'audit initial (faux succès,
données locales fabriquées, boutons désactivés silencieusement) n'a été
possible qu'en lisant le JSX ligne par ligne. Rien n'empêchait qu'une
régression future réintroduise l'un des bugs déjà corrigés dans ce chantier
sans que personne ne s'en aperçoive avant la production.

Cette suite ne vise **pas** une couverture exhaustive du frontend (chantier
disproportionné pour l'objectif). Elle cible les corrections les plus
critiques — en priorité les emplacements où l'utilisateur pouvait être
activement trompé (faux succès affiché sur un échec réel).

## Lancer la suite

```bash
cd frontend
npm test              # une seule passe (CI / vérification ponctuelle)
npm run test:watch    # mode watch (développement)
```

## Organisation

- `vite.config.js` (clé `test`) — configuration Vitest (environnement jsdom,
  `globals: true`, fichier de setup).
- `src/test/setup.js` — setup global (matchers `@testing-library/jest-dom`,
  `cleanup()` automatique après chaque test).
- `src/pages/__tests__/*.test.jsx` — tests de non-régression par page,
  organisés par correction ciblée (voir en-tête de chaque fichier pour le
  constat d'origine et le commit qui l'a corrigé).

## Convention de test établie

Chaque test de non-régression :

1. **Monte le vrai composant** (page entière) avec le **vrai réducteur
   Redux** de la slice concernée dans un store minimal
   (`configureStore({ reducer: { <clé>: <reducer réel> } })`) — jamais un
   composant de remplacement ni un store factice qui contournerait la
   logique testée.
2. **Simule uniquement la frontière réseau** — `vi.mock('../../api', ...)`
   sur le module axios partagé — jamais la logique applicative elle-même
   (le vrai thunk / la vraie fonction du composant s'exécute réellement).
3. Neutralise les dépendances hors sujet qui exigeraient une reconstruction
   disproportionnée pour ce qui est testé (ex. `useRealtimeRefresh` exige un
   vrai `<SocketProvider>` + une connexion socket.io réelle — mocké en
   no-op quand le comportement temps réel n'est pas ce qui est vérifié).
4. Pour chaque bug corrigé : un test qui simule l'échec réel (ex. réponse
   HTTP 500/404 interceptée sur le mock `../../api`) et vérifie qu'aucun
   faux succès n'est affiché et qu'aucun état local n'est mis à jour comme
   si l'action avait réussi — **et** un test de contrôle négatif (succès
   réel) qui vérifie que le chemin nominal continue de fonctionner.

Chaque test a été vérifié manuellement contre une régression délibérée
(réintroduction temporaire du bug corrigé via `git diff`/édition directe,
confirmation que le test échoue, puis `git checkout --` pour annuler) — voir
les messages de commit correspondants pour la preuve avant/après.

## Ce qui est couvert (au 6 septembre 2026)

- **FE-BUG-001** (faux succès affiché sur échec réel) — les 5 emplacements
  connus : `Urgences.jsx` (assignation de mission ambulance),
  `Finance.jsx` (statut de facture), `Administration.jsx` (création
  d'utilisateur, enregistrement des paramètres), `Archive.jsx` (suppression
  définitive).
- **FE-BUG-003/004** (saisies non transmises) — mode de paiement
  (Consultations.jsx), renouvellement/annulation d'ordonnance
  (Prescriptions.jsx).
- Un échantillon représentatif des désactivations honnêtes (Option B) du
  chantier Sous-phase 5.x — vérifie qu'un bouton désactivé reste bien
  désactivé (non-régression contre une réactivation accidentelle future).

## Ce qui reste à couvrir (travail futur, hors périmètre de cette instruction)

Cette suite ne couvre pas encore, par choix de proportionnalité explicite :

- Les pages non listées comme prioritaires par l'instruction QA-002
  d'origine (la majorité des ~40 pages du frontend).
- Les flux de bout en bout multi-étapes (ex. parcours patient complet).
- Les tests de rendu visuel/snapshot (non demandés, et fragiles par nature).
- Un test par bouton désactivé du chantier 5.x (un échantillon
  représentatif a été retenu plutôt qu'une couverture exhaustive).

**Pour étendre la suite** : suivre la convention ci-dessus (monter le vrai
composant + le vrai réducteur, mocker `../../api`, tester échec réel +
contrôle négatif succès réel), et vérifier chaque nouveau test contre une
régression délibérée avant de le considérer fiable.
