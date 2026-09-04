# Phase H — Préparation production

**Statut :** Revue de préparation effectuée (2026-09-04) — plusieurs points bloquants restent à traiter par l'utilisateur avant toute mise en ligne réelle.
**Origine :** Plan de correction consolidé MediSync, Phase H.
**Méthode :** revue du code existant (`server.js`, `checkProductionConfig.js`) + vérification de ce qui est déjà mécanisé vs ce qui reste une action manuelle au moment du déploiement.

## Constat général

La plupart des mécanismes de sécurité attendus en Phase H existaient déjà avant cette session (AUDIT-2.3 et antérieurs) : `server.js` refuse de démarrer en production si `checkProductionConfig()` détecte un écart. Cette phase n'a donc pas eu besoin d'écrire du nouveau code de garde-fou — le travail réel consistait à vérifier que ces mécanismes existent bien, fonctionnent, et à lister précisément ce qui reste une action humaine (rotation de clés, choix d'hébergeur) plutôt qu'un défaut de code.

## Checklist

| # | Point | État | Détail |
|---|---|---|---|
| 1 | `NODE_ENV=production` correctement positionné | ✅ Mécanisé | `server.js` lit `env.NODE_ENV` pour activer le rate-limiting strict (300 req/15min au lieu de 2000), désactiver `morgan`, et déclencher `checkProductionConfig()` au démarrage. Reste une variable d'environnement à positionner correctement sur l'hébergeur réel — pas un défaut de code. |
| 2 | Nouvelle clé API OpenAI en place, ancienne révoquée | ⛔ **Bloquant — action utilisateur** | Toujours pas fait. Aggravé : le G1 de cette session a confirmé que la clé actuelle est réelle mais **sans crédits** ("You have no credits remaining"), donc de toute façon inutilisable en l'état. |
| 3 | Nouveaux identifiants Twilio en place, anciens révoqués | ⛔ **Bloquant — action utilisateur** | Toujours pas fait. Aggravé : le G1 de cette session a confirmé que les identifiants actuels **n'authentifient pas** auprès de Twilio ("Authenticate" error) — inutilisables en l'état, indépendamment de la question de sécurité. |
| 4 | Historique Git de `.env.example` vérifié/purgé | ✅ Fait (session sécurité, phase 1) | `git log -p --all` confirmé sans trace des anciennes valeurs réelles — jamais commitées. Aucune purge nécessaire. |
| 5 | Secrets SMTP/Twilio via mécanisme sécurisé | ⚠️ État actuel : `.env` local + variables d'environnement serveur (pas de coffre-fort dédié type Vault/AWS Secrets Manager). Acceptable pour un déploiement simple, à réévaluer si l'équipe grandit — non bloquant. |
| 6 | CORS restreint au(x) domaine(s) réel(s) | ✅ Mécanisé | `server.js` : liste blanche stricte via `CLIENT_URL` (`cors.origin` + Socket.IO `cors.origin`), rejette toute origine non listée. Reste à positionner `CLIENT_URL` sur le(s) vrai(s) domaine(s) de production au déploiement. |
| 7 | Comptes de démonstration/seed supprimés ou désactivés | ✅ Mécanisé | `checkProductionConfig()` recherche les 28 emails créés par `seed.js` et refuse le démarrage en production s'ils sont présents. Reste une vérification/nettoyage de la base réelle au moment du déploiement (pas un défaut de code). |
| 8 | HTTPS activé et forcé | ⚠️ Non mécanisé côté application (pas de redirection HTTP→HTTPS dans Express). **Décision prise avec l'utilisateur (2026-09-04) : délégué à l'hébergement/reverse proxy** (Vercel, Render, Railway, nginx+certbot… forcent déjà HTTPS en amont dans la plupart des cas) — à vérifier explicitement une fois l'hébergeur choisi, aucun code ajouté ici. |
| 9 | Aucun statut d'intégration factice affiché comme actif | ✅ Fait (ticket 0020, cette session) | `Settings.jsx` neutralisé (AUDIT-03, déjà en place) + 6 foyers supplémentaires trouvés et corrigés (Appointments.jsx ×3, Messages.jsx ×2, Prescriptions.jsx ×2, Pediatrie.jsx). |
| 10 | Suite de tests automatisés à 100 % | ⚠️ 809/816 (99,1 %) — voir G1. Les 7 échecs restants ont une cause externe claire (clé OpenAI sans crédits, identifiants Twilio invalides), pas un défaut de code ; confirment d'ailleurs les points 2 et 3 ci-dessus. |
| 11 | Checklist de validation fonctionnelle manuelle terminée | ⚠️ Partiel — voir G2. Vérification réelle en navigateur effectuée sur un échantillon représentatif (login, dashboard, patients, must_change_password, profil à compléter, SMS), pas sur l'intégralité des rôles/écrans. Non exhaustif, mais plus qu'une simple lecture de code. |
| 12 | Sauvegarde de la base de données testée et fonctionnelle | ✅ Fait | `backup.js`/`restore.js` (T9.11) couverts par un test dédié (`backupRestoreT911.test.js`), confirmé vert dans la suite G1 (parmi les 809 tests passants). |

## Ce qui reste bloquant avant toute mise en production réelle

1. **Régénérer la clé API OpenAI** (créditée) et **les identifiants Twilio** (valides) — les deux sont aujourd'hui inutilisables en l'état, indépendamment de la question de sécurité soulevée en Phase A.
2. **Choisir l'hébergement** et vérifier que HTTPS y est bien forcé (point 8) et que `CLIENT_URL`/`NODE_ENV` y sont correctement positionnés (points 1, 6).
3. **Nettoyer les comptes seed** de la base de données réelle de production avant bascule (point 7) — `checkProductionConfig()` le détectera de toute façon et refusera de démarrer si oublié.
4. **Compléter la validation manuelle** (point 11) au-delà de l'échantillon couvert en G2, idéalement avec un vrai testeur humain sur chaque rôle.

Aucun de ces points ne nécessite de nouveau développement — ce sont des actions de configuration/déploiement et des décisions produit (identifiants, hébergeur), pas des correctifs de code.
