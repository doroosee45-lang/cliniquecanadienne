# ADR-0003 — Palette canonique du système de design (navy + sarcelle)

**Statut :** Adopté
**Contexte :** Phase 4, T4.1 — harmonisation UI/UX complète de l'application

## Constat

Le frontend contenait trois systèmes de style qui coexistaient :

1. Le système global (`frontend/src/index.css` + `components/UI/`), câblé sur un bleu générique (`--primary:#2563eb`) — bien construit (boutons, cartes, badges, modales, alertes, responsive) mais utilisé par seulement 2 des 29 pages en périmètre.
2. Une palette navy + sarcelle, redéfinie **localement dans un bloc `<style>` par page**, sur 23 des 29 pages.
3. `Login.jsx`, en styles inline JS sans variable.

Avant de choisir une palette canonique, les 23 blocs `:root` locaux ont été comparés valeur par valeur (pas seulement par nom de variable, qui diffère d'une page à l'autre — `--fb` dans `Finance.jsx`, `--cb` dans `Consultations.jsx`, `--rb` dans `HR.jsx`... pour la même couleur).

**Résultat de la comparaison :** 19 des 23 pages utilisent un jeu de valeurs **strictement identique** :

```
#0B1E3B #132744 #1B4F9E #0EA5A0 #0D9490 #DC2626 #D97706 #059669 #7C3AED #E2EAF4 #6B7A99 #EEF4FF #F8FAFD
```

C'est donc, de fait, déjà la palette consensus de l'application — pas une invention. Quatre pages divergent et devront être réconciliées lors de leur migration individuelle (T4.5/T4.6), pas dans cette tâche de fondation :
- `Blocoperatoire.jsx` et `Hospitalization.jsx` partagent une **deuxième palette alternative**, cohérente entre elles mais différente de la majorité (`#0A1628 #0F2040 #1A5276 #17A589...`).
- `Maternite.jsx` reprend la palette majoritaire, étendue de deux teintes roses (`#EC4899 #DB2777`) pour un accent propre à la maternité — à conserver comme accent secondaire, pas en remplacement.
- `Pediatrie.jsx` reprend la majorité avec une variante de bleu isolée (`#154396`), probablement un état hover calculé à la main — à aligner sur `--primary-dark` lors de sa migration.

## Décision

Adopter les valeurs majoritaires comme palette unique de l'application, portées par les variables déjà nommées dans `index.css` (pour que `.btn-primary`, `.card`, `.badge-*`, `.modal-box` se rethémisent automatiquement) plus de nouvelles variables pour les rôles qui n'avaient pas d'équivalent global :

| Variable | Valeur | Rôle (déduit de l'usage réel, ex. `Finance.jsx` : `--fb` sur `.fbtn-primary`, `--ft` sur `.fbtn-teal`/focus, `--fn` sur les titres/fonds sombres) |
|---|---|---|
| `--primary` | `#1B4F9E` | Action principale (boutons primaires, liens, focus) |
| `--primary-dark` | `#174391` | Hover/gradient de `--primary` — valeur déjà utilisée telle quelle par `.fbtn-primary:hover` dans les pages sources |
| `--accent` (nouveau) | `#0EA5A0` | Action secondaire, onglet actif, anneau de focus des champs |
| `--accent-dark` (nouveau) | `#0D9490` | Hover de `--accent` |
| `--ink` (nouveau) | `#0B1E3B` | Titres, texte fort, fond des bandeaux/dégradés sombres |
| `--ink-2` (nouveau) | `#132744` | Deuxième couleur des dégradés sombres avec `--ink` |
| `--tertiary` (nouveau) | `#7C3AED` | Accent tertiaire (peu utilisé — un KPI/badge parmi d'autres) |
| `--success` | `#059669` | (remplace `#22c55e`) |
| `--danger` | `#DC2626` | (remplace `#ef4444`) |
| `--warning` | `#D97706` | (remplace `#f59e0b`) |
| `--info` | `#0EA5A0` | Alias de `--accent` — la palette source n'a pas de 5ᵉ teinte dédiée à l'information |
| `--border` (nouveau) | `#E2EAF4` | Bordure de carte/champ |
| `--muted` (nouveau) | `#6B7A99` | Texte secondaire/atténué |
| `--tint` (nouveau) | `#EEF4FF` | Fond clair (hover ghost, icônes) |
| `--surface` (nouveau) | `#F8FAFD` | Fond de section/onglet actif |
| `--radius` | `18px` | (remplace `16px` — valeur `.fin-card`/`.caisse-card` etc. majoritaire sur les pages sources) |
| `--shadow` | `0 1px 3px rgba(11,30,59,.08)` | (remplace le neutre `rgba(0,0,0,...)` — teinté navy, valeur `--sh` des pages sources) |
| `--shadow-md` | `0 4px 16px rgba(11,30,59,.10)` | (valeur `--shm` des pages sources) |
| `--shadow-lg` | `0 12px 40px rgba(11,30,59,.14)` | (valeur `--shl` des pages sources) |

Le dégradé de `.sidebar` dans `index.css` (`#0f172a`/`#1e293b`, un slate Tailwind générique) est également aligné sur `--ink`/`--ink-2` (`#0B1E3B`/`#132744`) — même intention (fond sombre) que les pages, valeurs différentes par coïncidence d'origine.

## Conséquences

- Toute page migrée (T4.3-T4.9) supprime son bloc `:root` local et ses classes dupliquées, et consomme ces variables globales.
- `Blocoperatoire.jsx`/`Hospitalization.jsx` (palette alternative) et `Pediatrie.jsx` (bleu isolé) demandent une réconciliation explicite au moment de leur migration — pas un simple retrait de bloc `<style>`, la teinte doit changer.
- `Maternite.jsx` conserve son accent rose comme variante locale légitime (propre au contexte maternité), documentée comme telle plutôt que supprimée.
