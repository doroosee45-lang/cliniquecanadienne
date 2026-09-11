




import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/Layout/Layout';
import Spinner from './components/UI/Spinner';
import { Toaster, toast } from 'react-hot-toast';

// AUDIT-F3 — aucun découpage de code : toutes les pages étaient importées
// statiquement, donc chargées d'un bloc dans le bundle principal quel que
// soit le rôle connecté ou la route visitée (3,4 Mo / 881 Ko gzippé avant ce
// correctif). Converti en React.lazy() par route : chaque page devient son
// propre chunk, chargé au moment de la navigation, pas au chargement initial.
// ─── Pages Publiques ──────────────────────────────────────────────────────────
const Home              = lazy(() => import('./pages/home'));
const Login             = lazy(() => import('./pages/Login'));
const ForgotPassword    = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword     = lazy(() => import('./pages/ResetPassword'));
const ActivationPatient = lazy(() => import('./pages/ActivationPatient'));
const NotFound          = lazy(() => import('./pages/NotFound'));

// ─── Tableau de bord ──────────────────────────────────────────────────────────
const Dashboard         = lazy(() => import('./pages/Dashboard'));

// ─── Patients ─────────────────────────────────────────────────────────────────
const Patients          = lazy(() => import('./pages/Patients'));
const PatientDetail     = lazy(() => import('./pages/PatientDetail'));
const DossiersMedicaux  = lazy(() => import('./pages/DossiersMedicaux'));

// ─── Agenda & Consultations ───────────────────────────────────────────────────
const Appointments      = lazy(() => import('./pages/Appointments'));
const Consultations     = lazy(() => import('./pages/Consultations'));
const Prescriptions     = lazy(() => import('./pages/Prescriptions'));

// ─── Hospitalisation & Chirurgie ──────────────────────────────────────────────
const Hospitalization   = lazy(() => import('./pages/Hospitalization'));
const Chirurgie         = lazy(() => import('./pages/Chirurgie'));
const Blocoperatoire    = lazy(() => import('./pages/Blocoperatoire'));

// ─── Urgences & Spécialités ───────────────────────────────────────────────────
const Urgences          = lazy(() => import('./pages/Urgences'));
const Pediatrie         = lazy(() => import('./pages/Pediatrie'));
const Maternite         = lazy(() => import('./pages/Maternite'));

// ─── Paraclinique ─────────────────────────────────────────────────────────────
const Laboratory        = lazy(() => import('./pages/Laboratory'));
const Radiology         = lazy(() => import('./pages/Radiology'));
const Echographie       = lazy(() => import('./pages/Echographie'));

// ─── Pharmacie ────────────────────────────────────────────────────────────────
const Pharmacy          = lazy(() => import('./pages/Pharmacy'));

// ─── Administration & Finance ─────────────────────────────────────────────────
const HR                = lazy(() => import('./pages/HR'));
const Finance            = lazy(() => import('./pages/Finance'));
const InvoicePrint       = lazy(() => import('./pages/InvoicePrint'));
const Administration     = lazy(() => import('./pages/Administration'));
const Settings           = lazy(() => import('./pages/Settings'));

// ─── Outils & Communication ───────────────────────────────────────────────────
const Messages           = lazy(() => import('./pages/Messages'));
const AI                 = lazy(() => import('./pages/AI'));
const Archive            = lazy(() => import('./pages/Archive'));
const Audit              = lazy(() => import('./pages/Audit'));
const Analytics          = lazy(() => import('./pages/Analytics'));
const AnalyticsGlobal     = lazy(() => import('./pages/AnalyticsGlobal'));

// ─── Portail Patient ──────────────────────────────────────────────────────────
const Portal             = lazy(() => import('./pages/Portal'));


// ─────────────────────────────────────────────────────────────────────────────
// Garde de route — vérifie l'authentification et le rôle
// ─────────────────────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  // AUDIT-ELEVE-1 — la redirection sur rôle non autorisé était totalement
  // silencieuse : un lien vers une page inaccessible (ex. raccourci de
  // tableau de bord mal configuré) ramenait à l'accueil sans aucune
  // indication, indiscernable d'un clic qui n'aurait rien fait. useEffect
  // (pas un appel direct dans le rendu) pour ne déclencher le toast qu'une
  // fois par tentative de navigation bloquée, jamais pendant le rendu lui-même.
  const denied = !loading && !!user && roles && !roles.includes(user.role);
  useEffect(() => {
    if (denied) toast.error('Accès non autorisé — vous n\'avez pas les droits pour cette page.');
  }, [denied]);

  if (loading) return <FullPageSpinner />;
  if (!user)   return <Navigate to="/home" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const FullPageSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner size="lg" />
  </div>
);

// Raccourcis pour les rôles fréquents
const ROLES = {
  superadmin      : ['superadmin'],
  // AUDIT-ELEVE-1 — distinct de ROLES.superadmin (partagé avec
  // analytics-global, volontairement réservé au superadmin seul, voir plus
  // bas) : le backend (audit.routes.js) autorise déjà adminclinique sur
  // /audit depuis le chantier Archivage/Audit — cette garde frontend n'avait
  // jamais été mise en miroir, bloquant l'accès à la page malgré une API
  // désormais accessible.
  audit           : ['superadmin', 'adminclinique'],
  admin           : ['superadmin', 'adminclinique'],
  medical         : ['superadmin', 'medecin', 'infirmier'],
  // P1-03 (audit du 11 sept. 2026) — adminclinique manquait ici alors que
  // les deux autres signaux du même flux l'incluent déjà : le backend
  // (ai.routes.js) l'autorise explicitement sur toutes les routes /ai, et
  // le Sidebar (withAdmins('medecin')) affiche déjà le lien "Intelligence
  // IA" à adminclinique — seule cette Guard route, seule utilisatrice de
  // cette clé (uniquement /ai), l'excluait, bloquant un accès que le
  // backend et le Sidebar accordent déjà réellement. Même schéma déjà
  // corrigé pour ROLES.audit (AUDIT-ELEVE-1).
  medecin         : ['superadmin', 'adminclinique', 'medecin'],
  // AUDIT-ELEVE-1 — infirmier a déjà un accès backend réel en lecture à ce
  // module (pharmacy.routes.js::CAN_READ) sans jamais avoir pu atteindre la
  // page elle-même.
  pharmacie       : ['superadmin', 'adminclinique', 'pharmacien', 'medecin', 'infirmier'],
  consultation    : ['superadmin', 'medecin', 'infirmier'],
  finance         : ['superadmin', 'adminclinique', 'comptable'],
  hospitalisation : ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
  chirurgie       : ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
  blocoperatoire  : ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
  prescription    : ['superadmin', 'medecin', 'pharmacien', 'infirmier'],
  // ── Spécialités & Paraclinique ─────────────────────────────────────────────
  maternite       : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'],
  // Union des rôles autorisés par AU MOINS un des 9 types de dossiers
  // recherchés (voir medicalRecordsController.js::SOURCES) — la matrice
  // fine par collection est appliquée côté backend, cette garde ne fait
  // qu'empêcher d'atteindre une page qui ne montrerait jamais rien.
  dossiersMedicaux: ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'laborantin', 'radiologue', 'sage_femme', 'pharmacien'],
  pediatrie       : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'],
  // Phase 3 (audit du 11 sept. 2026, alignement Backend↔Guard↔Sidebar) —
  // urgences.routes.js::CAN et echographie.routes.js::CAN autorisent déjà
  // sage_femme ; laboratory.routes.js::CAN_READ et radiology.routes.js::
  // CAN_READ autorisent déjà infirmier. Ces 4 Guards ne les reflétaient
  // pas (Sidebar.jsx avait le même écart, corrigé au même endroit) — même
  // schéma AUDIT-ELEVE-1/P1-03 : accès backend réel jamais atteignable.
  urgences        : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme'],
  laboratoire     : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'laborantin'],
  imagerie        : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'radiologue'],
  echographie     : ['superadmin', 'adminclinique', 'medecin', 'radiologue', 'infirmier', 'sage_femme'],
  // Correction 1 (relecture du 5 sept. 2026, découverte pendant SEC-004/005) —
  // même liste que STAFF (backend/utils/roles.js), qui exclut explicitement
  // 'patient' : la page Messages.jsx (annuaire du personnel, ouverture de
  // conversation avec n'importe quel utilisateur) n'a pas d'équivalent
  // patient — Portal.jsx a son propre onglet "Messagerie" séparé (pour
  // l'instant non fonctionnel, bouton désactivé, cf. commentaire AUDIT-11 in
  // situ), jamais cette page-ci.
  messages        : ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme',
                      'laborantin', 'radiologue', 'pharmacien', 'comptable', 'receptionniste'],
};

// Composant raccourci pour éviter la répétition
const Guard = ({ roles, children }) => (
  <ProtectedRoute roles={roles}>{children}</ProtectedRoute>
);


// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;

  return (
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>

      {/* ── Pages publiques (sans connexion) ─────────────────────────────── */}
      <Route path="/home"                  element={<Home />} />
      <Route path="/login"                 element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password"       element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/activate/:token"       element={<ActivationPatient />} />

      {/* ── Application principale (connexion requise) ───────────────────── */}
      <Route
        path="/"
        element={
          user
            ? <Guard><Layout /></Guard>
            : <Navigate to="/home" replace />
        }
      >
        {/* Tableau de bord */}
        <Route index element={<Dashboard />} />

        {/* ── Patients ─────────────────────────────────────────────────── */}
        <Route path="patients"      element={<Patients />} />
        <Route path="patients/:id"  element={<PatientDetail />} />
        <Route path="dossiers-medicaux" element={<Guard roles={ROLES.dossiersMedicaux}><DossiersMedicaux /></Guard>} />

        {/* ── Agenda & Consultations ───────────────────────────────────── */}
        <Route path="appointments"  element={<Appointments />} />
        <Route path="consultations" element={<Guard roles={ROLES.consultation}><Consultations /></Guard>} />
        <Route path="prescriptions" element={<Guard roles={ROLES.prescription}><Prescriptions /></Guard>} />

        {/* ── Hospitalisation & Chirurgie ──────────────────────────────── */}
        <Route path="hospitalization" element={<Guard roles={ROLES.hospitalisation}><Hospitalization /></Guard>} />
        <Route path="chirurgie"       element={<Guard roles={ROLES.chirurgie}><Chirurgie /></Guard>} />
        <Route path="blocoperatoire"  element={<Guard roles={ROLES.blocoperatoire}><Blocoperatoire /></Guard>} />

        {/* ── Urgences & Spécialités ───────────────────────────────────── */}
        <Route path="urgences"   element={<Guard roles={ROLES.urgences}><Urgences /></Guard>} />
        <Route path="pediatrie"  element={<Guard roles={ROLES.pediatrie}><Pediatrie /></Guard>} />
        <Route path="maternite"  element={<Guard roles={ROLES.maternite}><Maternite /></Guard>} />

        {/* ── Paraclinique ─────────────────────────────────────────────── */}
        <Route path="laboratory"   element={<Guard roles={ROLES.laboratoire}><Laboratory /></Guard>} />
        <Route path="radiology"    element={<Guard roles={ROLES.imagerie}><Radiology /></Guard>} />
        <Route path="echographie"  element={<Guard roles={ROLES.echographie}><Echographie /></Guard>} />

        {/* ── Pharmacie ────────────────────────────────────────────────── */}
        <Route path="pharmacy" element={<Guard roles={ROLES.pharmacie}><Pharmacy /></Guard>} />

        {/* ── Administration & Finance ─────────────────────────────────── */}
        <Route path="hr"             element={<Guard roles={ROLES.admin}><HR /></Guard>} />
        <Route path="finance"        element={<Guard roles={ROLES.finance}><Finance /></Guard>} />
        <Route path="finance/:id/print" element={<Guard roles={ROLES.finance}><InvoicePrint /></Guard>} />
        <Route path="administration" element={<Guard roles={ROLES.admin}><Administration /></Guard>} />
        <Route path="settings"       element={<Guard roles={ROLES.admin}><Settings /></Guard>} />

        {/* ── Outils & Communication ───────────────────────────────────── */}
        <Route path="messages"  element={<Guard roles={ROLES.messages}><Messages /></Guard>} />
        <Route path="ai"        element={<Guard roles={ROLES.medecin}><AI /></Guard>} />
        <Route path="archive"   element={<Guard roles={ROLES.admin}><Archive /></Guard>} />
        <Route path="audit"     element={<Guard roles={ROLES.audit}><Audit /></Guard>} />
        <Route path="analytics" element={<Guard roles={ROLES.admin}><Analytics /></Guard>} />
        {/* Dashboard Global & Analytics — réservé au SuperAdmin uniquement (pas adminclinique) */}
        <Route path="analytics-global" element={<Guard roles={ROLES.superadmin}><AnalyticsGlobal /></Guard>} />

        {/* ── Portail patient ──────────────────────────────────────────── */}
        <Route path="portal" element={<Guard roles={['patient']}><Portal /></Guard>} />

        {/* 404 dans le layout */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* 404 hors layout */}
      <Route path="*" element={<NotFound />} />

    </Routes>
    </Suspense>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// App Root
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#0B1E3B',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '.875rem',
              fontWeight: 500,
              borderRadius: '14px',
              padding: '10px 16px',
              boxShadow: '0 12px 40px rgba(11,30,59,.14)',
              border: '1px solid #E2EAF4',
            },
            success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
          }}
        />
      </SocketProvider>
    </AuthProvider>
  );
}