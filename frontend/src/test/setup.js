// QA-002 — setup global de la suite vitest (voir vite.config.js::test.setupFiles).
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Démonte le DOM rendu après chaque test — sans ça, un test qui rend un
// composant avec un texte/rôle commun (ex. "Enregistrer") ferait échouer le
// test suivant en trouvant deux éléments au lieu d'un.
afterEach(() => {
  cleanup();
});
