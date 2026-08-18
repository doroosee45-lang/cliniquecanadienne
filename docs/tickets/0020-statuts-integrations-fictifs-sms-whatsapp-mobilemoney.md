# Ticket 0020 — Statuts d'intégration fictifs affichés comme "connecté" (SMS, WhatsApp Business, Mobile Money)

**Statut :** Ouvert — non corrigé
**Origine :** Découvert en marge de l'Étape 3 / P7-8 (bouton "Envoyer SMS" factice, `Appointments.jsx`)
**Catégorie :** Transparence produit — proche de R-11 (bandeau de transparence IA, `AI.jsx`, T9.4), mais ici l'écart est inverse : R-11 informe honnêtement d'une limite réelle, alors que ce constat affiche activement un statut **faux** ("connecté") pour des capacités qui n'existent pas.
**Sévérité :** Moyenne — n'affecte aucune donnée clinique ni aucune action réelle (contrairement à P6-5), mais induit directement en erreur le personnel administratif qui consulte `Settings.jsx` pour évaluer l'état réel du système.

## Constat

En corrigeant P7-8 (bouton "Envoyer SMS" factice sur `Appointments.jsx`), une recherche plus large a montré que l'illusion d'une capacité SMS/WhatsApp/Mobile Money fonctionnelle dépasse largement ce seul bouton, déjà neutralisé :

1. **`frontend/src/pages/Settings.jsx:231-239`** — la constante `INTEGRATIONS` affiche explicitement :
   ```js
   { nom:"SMS Gateway (Orange)",  statut:"connecté", ... }
   { nom:"WhatsApp Business API", statut:"connecté", ... }
   { nom:"Paiement Mobile Money", statut:"connecté", ... }
   ```
   Un badge vert "connecté" est un **statut affirmatif actif**, pas un bouton inerte : un administrateur consultant cette page conclut à tort que ces trois canaux fonctionnent réellement. C'est plus grave qu'un bouton factice — c'est une déclaration d'état fausse sur une page de configuration système.
2. **`frontend/src/pages/Messages.jsx:1438`** — une carte statistique affiche `{ icon:"📱", titre:"SMS", desc:"Envoi de SMS groupés ou individuels", nb:128 }` : un compteur "128" laisse croire à un historique réel d'envois.
3. **`frontend/src/pages/Messages.jsx:1461-1465`** — des modèles de notification affichent `canal:"SMS"` / `"SMS + Email"` / `"SMS + WhatsApp"` comme s'ils étaient effectivement acheminés par ces canaux.
4. **`frontend/src/pages/Prescriptions.jsx:1550,1758`** et **`frontend/src/pages/Pediatrie.jsx:1330`** — textes descriptifs promettant des alertes/rappels SMS automatiques ("Le système envoie automatiquement des alertes SMS/Email...").

## Pourquoi ce n'est pas corrigé ici

Hors périmètre de P7-8, qui portait sur un bouton précis (`Appointments.jsx`), déjà neutralisé. Ce constat touche 4 fichiers différents avec des UI variées (badge de statut, compteur, libellé de canal, texte descriptif) — un balayage cohérent nécessite une décision produit préalable (voir pistes ci-dessous), pas une correction ponctuelle fichier par fichier.

## Pistes pour correction future

1. **Option minimale (honnêteté d'affichage)** : dans `Settings.jsx::INTEGRATIONS`, passer SMS Gateway / WhatsApp Business / Mobile Money de `statut:"connecté"` à `statut:"déconnecté"` (la valeur déjà utilisée pour Labo externe CHL, Radiologie externe, Stripe — cohérent avec le reste de la liste) ; ajuster en cascade les textes de `Messages.jsx` (retirer ou griser les canaux SMS, retirer le compteur "128") et les textes descriptifs de `Prescriptions.jsx`/`Pediatrie.jsx`.
2. **Option complète** : intégrer réellement une passerelle SMS (Twilio, déjà en commentaire dans `.env` mais jamais provisionné) si le besoin métier est confirmé — décision produit, coût récurrent, hors périmètre technique seul.
