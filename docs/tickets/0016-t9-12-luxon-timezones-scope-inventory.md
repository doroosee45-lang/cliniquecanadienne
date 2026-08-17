# Ticket 0016 — T9.12 (fuseaux horaires / Luxon) : ampleur réelle constatée, reporté

**Statut :** Ouvert — reporté après vérification explicite de l'ampleur (décision utilisateur, 2026-08-17)
**Origine :** T9.12 (plan de phases, clôture Phase 9)
**Sévérité :** Moyenne — pas un bug actif signalé à ce jour, mais un vrai risque de cohérence entre date stockée en base (UTC) et date affichée (fuseau du navigateur/serveur, jamais explicité)

## Constat

T9.12 demandait d'introduire Luxon pour tout affichage de date destiné à l'utilisateur, avec la consigne explicite de vérifier l'ampleur réelle du changement avant de s'engager, et de reporter la décision de découpage à l'utilisateur si ça dépassait le périmètre d'une tâche isolée. Vérification faite par `grep` sur `develop` :

| Périmètre | Fichiers concernés | Occurrences brutes |
|---|---|---|
| Frontend — pages | 26 | 222+ (`.toLocaleDateString`/`.toLocaleString`, motifs `'fr-FR'` variés, du simple `.toLocaleDateString('fr-FR')` à des options `{day,month,year,hour,minute}` codées en dur et parfois formatées différemment d'un fichier à l'autre) |
| Frontend — composants partagés | 1 (`components/Layout/Header.jsx`) | non compté précisément, marginal |
| Backend — contrôleurs/emails/exports | 9 | non compté précisément (utilisé pour les emails et les exports PDF/rapport, formats de date inclus dans le contenu envoyé) |

**Liste complète des 26 pages frontend concernées** (`grep -rl` sur `frontend/src/pages`, ordre alphabétique) :
`AI.jsx`, `Administration.jsx`, `Analytics.jsx`, `Appointments.jsx`, `Archive.jsx`, `Audit.jsx`, `Blocoperatoire.jsx`, `Chirurgie.jsx`, `Consultations.jsx`, `Dashboard.jsx`, `Echographie.jsx`, `Finance.jsx`, `HR.jsx`, `Hospitalization.jsx`, `InvoicePrint.jsx`, `Laboratory.jsx`, `Maternite.jsx`, `Messages.jsx`, `PatientDetail.jsx`, `Patients.jsx`, `Pediatrie.jsx`, `Pharmacy.jsx`, `Portal.jsx`, `Prescriptions.jsx`, `Radiology.jsx`, `Urgences.jsx`.

**Backend concerné** (emails et exports, pas seulement l'interface) : `archive.controller.js`, `audit.controller.js`, `chirurgieController.js`, `dashboard.controller.js`, `echographieController.js`, `finance.controller.js`, `maternityController.js`, `pediatrieController.js`, `utils/mail.js`.

⚠ **Deux fichiers de la liste (`Dashboard.jsx`, `Urgences.jsx`) sont explicitement hors périmètre** de toute intervention pour l'instant — travail actif de l'utilisateur sur ces pages, à ne jamais toucher sans instruction directe. Toute future exécution de ce ticket devra soit les exclure du lot, soit attendre la fin du travail en cours dessus.

## Pourquoi ce n'est pas traité maintenant

Ampleur comparable à un mini-audit transverse (26+ fichiers frontend, 9 fichiers backend, 222+ points d'affichage), pas à une tâche isolée telle que T9.12 était initialement cadrée dans le plan. Traiter ça au fil de l'eau dans la même session que la clôture de Phase 9 risquait de reproduire le problème de dérive de périmètre déjà rencontré avec P2-1 (qui s'est révélé couvrir 16 endpoints au lieu d'un seul une fois vérifié). Décision explicite de l'utilisateur : reporter, documenter l'inventaire exact plutôt que de découper à la volée sans son arbitrage.

## Pistes pour correction future (à valider avec l'utilisateur avant de commencer)

Plusieurs découpages possibles, à décider explicitement plutôt que supposés ici :
1. **Par couche** : backend (emails/exports — périmètre plus restreint, 9 fichiers) d'abord, frontend (26 pages) ensuite.
2. **Par lot de pages** : regroupements thématiques (cœur clinique, spécialités, admin/finance) sur le même modèle que les groupes P2-1.
3. **Outillage seul, sans migration rétrospective** : ajouter la dépendance Luxon et l'imposer pour tout nouveau code à partir de maintenant, sans toucher aux 222 points existants — referme la tâche au sens "outil disponible" sans résoudre le risque de cohérence sous-jacent sur l'existant.

Dans tous les cas : `Dashboard.jsx` et `Urgences.jsx` doivent être explicitement exclus ou traités séparément une fois le travail de l'utilisateur dessus terminé.
