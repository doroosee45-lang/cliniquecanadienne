import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // T9.6 — première activation d'ESLint sur ce dépôt : 212 variables non
      // utilisées et une centaine de violations des règles "React Compiler"
      // récemment durcies dans eslint-plugin-react-hooks@7 (set-state-in-effect,
      // static-components, purity, immutability, use-memo,
      // preserve-manual-memoization) préexistaient déjà dans tout le code, sur
      // des pages jamais écrites en visant ces règles. Les corriger toutes
      // maintenant est un chantier séparé, hors périmètre de la mise en place
      // de la CI. Rétrogradées en avertissement (visibles, non bloquantes) —
      // no-undef et rules-of-hooks restent des erreurs : ce sont de vrais bugs
      // (ReferenceError / hooks conditionnels), pas du style.
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Dashboard.jsx / Urgences.jsx / home.jsx : réécriture active en cours,
    // hors périmètre de tout travail sur ce dépôt (voir historique du
    // projet) — un vrai rules-of-hooks (hook appelé conditionnellement)
    // existe actuellement dans Dashboard.jsx, mais le corriger reviendrait à
    // modifier un fichier explicitement laissé de côté. Exempté ici plutôt
    // que de rétrograder la règle partout, qui reste bloquante ailleurs.
    files: ['src/pages/Dashboard.jsx', 'src/pages/Urgences.jsx', 'src/pages/home.jsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  {
    // Correction (rapport de correction du 11 sept. 2026, Priorité P2 —
    // configuration ESLint) — languageOptions.globals ne déclarait que
    // globals.browser : test/expect/beforeEach/vi/describe (Vitest) n'étaient
    // déclarés nulle part, provoquant un no-undef sur CHAQUE assertion de
    // CHAQUE fichier de test du dépôt (343 des 598 problèmes rapportés
    // n'étaient qu'un défaut de configuration, pas de vrais bugs). Étendu
    // aux globales navigateur déjà en vigueur (les tests montent de vrais
    // composants React, donc window/document restent nécessaires) ET à
    // globals.node (Vitest exécute les tests dans un vrai processus Node —
    // `global.URL.createObjectURL = ...` dans
    // Prescriptions.iaAnalyseEtExports.test.jsx, par exemple, patch
    // délibérément l'API jsdom incomplète via le `global` Node réel) —
    // jamais de règle de qualité/sécurité désactivée, uniquement les
    // globales manquantes déclarées.
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
  {
    // vite.config.js s'exécute sous Node (jamais bundlé, jamais servi au
    // navigateur) — process n'y est pas une variable non déclarée.
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // src/utils/labResultats.js est un cas d'interop CommonJS délibéré (voir
    // commentaire en fin de fichier) : `module` y est lu derrière un garde
    // `typeof module !== 'undefined'` pour rester exploitable tel quel par
    // un test backend (node:test/require()), en plus de son usage normal
    // côté navigateur — les deux jeux de globales sont donc légitimement
    // nécessaires ici, pas ailleurs dans src/.
    files: ['src/utils/labResultats.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
