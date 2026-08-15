# Ticket 0005 — Future Accessibility Pass: Form Labels & Legacy Forms

**Statut :** Ouvert — non traité (hors périmètre de T4.10, documenté à la demande explicite de l'utilisateur)
**Origine :** Phase 4, T4.10 — audit d'accessibilité final
**Sévérité :** High (impact réel sur l'accessibilité des formulaires) mais délibérément reporté — chantier trop large pour un audit

## Constat

399 occurrences de `placeholder=` recensées dans `frontend/src/pages/*.jsx`, très majoritairement sans `<label>` associé — le placeholder tient lieu de label, ce qui disparaît dès que l'utilisateur commence à saisir et n'est jamais lu par un lecteur d'écran comme un label de champ. Réparti sur la quasi-totalité des 24 pages du périmètre Hero, sur du balisage de formulaire écrit à la main (pas encore sur les composants partagés `FormInput`/`FormSelect`/`FormTextarea` introduits en T4.2).

Corriger un par un aurait dépassé de loin le périmètre d'un audit de cohérence du design system et risqué d'introduire des régressions sur des formulaires métier actifs (création de patients, prescriptions, admissions...).

## Objectif futur

- Remplacer les `placeholder` utilisés comme unique label par un vrai `<label>` (visible ou `sr-only` selon le contexte visuel de chaque page).
- Associer correctement chaque `<label>` à son contrôle via `htmlFor`/`id`.
- Migrer progressivement les formulaires "legacy" (balisage `.pinp`/`.uinp`/`.finp`/etc. propre à chaque page) vers `FormInput`, `FormSelect`, `FormTextarea` et `FormFileUpload` (`components/UI/`).
- Vérifier `aria-describedby`, `aria-invalid` et `required` à chaque champ migré — ces trois mécanismes existent déjà dans `FieldShell`/`FormInput`/`FormSelect`/`FormTextarea` (corrigés en T4.10) mais ne bénéficient qu'aux formulaires qui utilisent réellement ces composants.

## Pourquoi ce n'est pas traité maintenant

Explicitement mis hors périmètre par l'utilisateur lors de la clôture de T4.10 : chantier séparé, à traiter progressivement (probablement page par page, en même temps que la migration complète de chaque page vers le design system — une passe plus profonde que le rollout Hero de T4.3, qui n'a touché que l'en-tête/les onglets/les modales de chaque page, pas les formulaires internes).

## Constat annexe (mineur, découvert pendant T4.10)

`FormFileUpload` (`components/UI/FormFileUpload.jsx`) : le `cloneElement` de `FieldShell` cible `children`, qui pour ce composant est un `<label>` englobant l'`<input type="file">` réel, pas l'input lui-même — `aria-describedby`/`aria-invalid` atterrissent donc sur le mauvais élément pour ce composant spécifique (les trois autres — `FormInput`, `FormSelect`, `FormTextarea` — ne sont pas concernés, `children` y est directement le contrôle). À corriger dans le cadre de cette même passe future, en restructurant `FormFileUpload` pour que `FieldShell` clone directement l'`<input>`.
