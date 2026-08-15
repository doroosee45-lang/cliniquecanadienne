/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { poppins: ['Poppins', 'sans-serif'] },
      colors: {
        // ADR-0003 — palette canonique navy + sarcelle, alignée sur les
        // variables CSS de index.css (mêmes valeurs, deux syntaxes).
        primary: { DEFAULT: '#1B4F9E', dark: '#174391' },
        accent:  { DEFAULT: '#0EA5A0', dark: '#0D9490' },
        ink:     { DEFAULT: '#0B1E3B', 2: '#132744' },
        success: '#059669',
        danger:  '#DC2626',
        warning: '#D97706',
        info:    '#0EA5A0',
        muted:   '#556685', // 6B7A99 était sous le seuil WCAG AA (4.31:1 sur blanc)
      },
      // Clés nommées (pas de DEFAULT) : additives, ne changent pas le
      // comportement des classes rounded-*/shadow-* déjà utilisées ailleurs
      // dans l'app. La source de vérité reste les variables CSS de
      // index.css (--radius, --shadow*), consommées par .card/.btn-*/
      // .modal-box ; ces utilitaires Tailwind existent pour les nouveaux
      // composants qui préfèrent des classes directes.
      borderRadius: { card: '18px' },
      boxShadow: {
        card: '0 1px 3px rgba(11,30,59,.08)',
        'card-md': '0 4px 16px rgba(11,30,59,.10)',
        'card-lg': '0 12px 40px rgba(11,30,59,.14)',
      },
    },
  },
  plugins: [],
};
