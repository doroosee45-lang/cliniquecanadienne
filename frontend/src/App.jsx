// import { Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider, useAuth } from './contexts/AuthContext';
// import { SocketProvider } from './contexts/SocketContext';
// import Layout from './components/Layout/Layout';
// import Spinner from './components/UI/Spinner';


// import Home from './pages/acueil/Home';
// import Login from './pages/Login';
// import NotFound from './pages/NotFound';
// import Dashboard from './pages/Dashboard';
// import Patients from './pages/Patients';
// import PatientDetail from './pages/PatientDetail';
// import Appointments from './pages/Appointments';
// import Consultations from './pages/Consultations';
// import Hospitalization from './pages/Hospitalization';
// import Laboratory from './pages/Laboratory';
// import Radiology from './pages/Radiology';
// import Pharmacy from './pages/Pharmacy';
// import Prescriptions from './pages/Prescriptions';
// import HR from './pages/HR';
// import Finance from './pages/Finance';
// import InvoicePrint from './pages/InvoicePrint';
// import Messages from './pages/Messages';
// import AI from './pages/AI';
// import Archive from './pages/Archive';
// import Audit from './pages/Audit';
// import Analytics from './pages/Analytics';
// import Administration from './pages/Administration';
// import Settings from './pages/Settings';
// import Portal from './pages/Portal';
// import ActivationPatient from './pages/ActivationPatient';
// import ForgotPassword from './pages/ForgotPassword';
// import ResetPassword from './pages/ResetPassword';
// import Chirurgie from './pages/Chirurgie';
// import Blocoperatoire from './pages/Blocoperatoire';

// const ProtectedRoute = ({ children, roles }) => {
//   const { user, loading } = useAuth();
//   if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>;
//   if (!user) return <Navigate to="/login" replace />;
//   if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
//   return children;
// };

// const AppRoutes = () => {
//   const { user, loading } = useAuth();
//   if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>;

//   return (
//     <Routes>
//       {/* Public */}
//       <Route path="/home"                  element={<Home />} />
//       <Route path="/login"                 element={user ? <Navigate to="/" replace /> : <Login />} />
//       <Route path="/forgot-password"       element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
//       <Route path="/reset-password/:token" element={<ResetPassword />} />
//       <Route path="/activate/:token"       element={<ActivationPatient />} />

//       {/* Protected layout */}
//       <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
//         <Route index element={<Dashboard />} />

//         {/* Patients */}
//         <Route path="patients" element={<Patients />} />
//         <Route path="patients/:id" element={<PatientDetail />} />

//         {/* RDV + Consultations */}
//         <Route path="appointments" element={<Appointments />} />
//         <Route path="consultations" element={
//           <ProtectedRoute roles={['superadmin', 'medecin', 'infirmier']}>
//             <Consultations />
//           </ProtectedRoute>
//         } />

//         {/* Ordonnances */}
//         <Route path="prescriptions" element={
//           <ProtectedRoute roles={['superadmin', 'medecin', 'pharmacien', 'infirmier']}>
//             <Prescriptions />
//           </ProtectedRoute>
//         } />

//         {/* Hospitalisation */}
//         <Route path="hospitalization" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique', 'medecin', 'infirmier']}>
//             <Hospitalization />
//           </ProtectedRoute>
//         } />

//         {/* Paraclinique */}
//         <Route path="laboratory" element={<Laboratory />} />
//         <Route path="radiology" element={<Radiology />} />
//         <Route path="chirurgie" element={<Chirurgie />} />
//         <Route path="blocoperatoire" element={<Blocoperatoire />} />

//         {/* Pharmacie */}
//         <Route path="pharmacy" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique', 'pharmacien', 'medecin']}>
//             <Pharmacy />
//           </ProtectedRoute>
//         } />

//         {/* RH */}
//         <Route path="hr" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique']}>
//             <HR />
//           </ProtectedRoute>
//         } />

//         {/* Finance */}
//         <Route path="finance" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique', 'comptable']}>
//             <Finance />
//           </ProtectedRoute>
//         } />
//         <Route path="finance/:id/print" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique', 'comptable']}>
//             <InvoicePrint />
//           </ProtectedRoute>
//         } />

//         {/* Communication */}
//         <Route path="messages" element={<Messages />} />

//         {/* IA */}
//         <Route path="ai" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique', 'medecin']}>
//             <AI />
//           </ProtectedRoute>
//         } />

//         {/* Admin */}
//         <Route path="archive" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique']}>
//             <Archive />
//           </ProtectedRoute>
//         } />
//         <Route path="audit" element={
//           <ProtectedRoute roles={['superadmin']}>
//             <Audit />
//           </ProtectedRoute>
//         } />
//         <Route path="analytics" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique']}>
//             <Analytics />
//           </ProtectedRoute>
//         } />
//         <Route path="administration" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique']}>
//             <Administration />
//           </ProtectedRoute>
//         } />
//         <Route path="settings" element={
//           <ProtectedRoute roles={['superadmin', 'adminclinique']}>
//             <Settings />
//           </ProtectedRoute>
//         } />

//         {/* Portail patient */}
//         <Route path="portal" element={
//           <ProtectedRoute roles={['patient']}>
//             <Portal />
//           </ProtectedRoute>
//         } />

//         {/* 404 dans le layout */}
//         <Route path="*" element={<NotFound />} />
//       </Route>

//       {/* 404 hors layout */}
//       <Route path="*" element={<NotFound />} />
//     </Routes>
//   );
// };

// export default function App() {
//   return (
//     <AuthProvider>
//       <SocketProvider>
//         <AppRoutes />
//       </SocketProvider>
//     </AuthProvider>
//   );
// }




import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/Layout/Layout';
import Spinner from './components/UI/Spinner';

// ─── Pages Publiques ──────────────────────────────────────────────────────────
import Home             from './pages/home';
import Login            from './pages/Login';
import ForgotPassword   from './pages/ForgotPassword';
import ResetPassword    from './pages/ResetPassword';
import ActivationPatient from './pages/ActivationPatient';
import NotFound         from './pages/NotFound';

// ─── Tableau de bord ──────────────────────────────────────────────────────────
import Dashboard        from './pages/Dashboard';

// ─── Patients ─────────────────────────────────────────────────────────────────
import Patients         from './pages/Patients';
import PatientDetail    from './pages/PatientDetail';

// ─── Agenda & Consultations ───────────────────────────────────────────────────
import Appointments     from './pages/Appointments';
import Consultations    from './pages/Consultations';
import Prescriptions    from './pages/Prescriptions';

// ─── Hospitalisation & Chirurgie ──────────────────────────────────────────────
import Hospitalization  from './pages/Hospitalization';
import Chirurgie        from './pages/Chirurgie';
import Blocoperatoire   from './pages/Blocoperatoire';

// ─── Urgences & Spécialités ───────────────────────────────────────────────────
import Urgences         from './pages/Urgences';
import Pediatrie        from './pages/Pediatrie';
import Maternite        from './pages/Maternite';

// ─── Paraclinique ─────────────────────────────────────────────────────────────
import Laboratory       from './pages/Laboratory';
import Radiology        from './pages/Radiology';
import Echographie      from './pages/Echographie';

// ─── Pharmacie ────────────────────────────────────────────────────────────────
import Pharmacy         from './pages/Pharmacy';

// ─── Administration & Finance ─────────────────────────────────────────────────
import HR               from './pages/HR';
import Finance          from './pages/Finance';
import InvoicePrint     from './pages/InvoicePrint';
import Administration   from './pages/Administration';
import Settings         from './pages/Settings';

// ─── Outils & Communication ───────────────────────────────────────────────────
import Messages         from './pages/Messages';
import AI               from './pages/AI';
import Archive          from './pages/Archive';
import Audit            from './pages/Audit';
import Analytics        from './pages/Analytics';

// ─── Portail Patient ──────────────────────────────────────────────────────────
import Portal           from './pages/Portal';


// ─────────────────────────────────────────────────────────────────────────────
// Garde de route — vérifie l'authentification et le rôle
// ─────────────────────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

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
  superadmin  : ['superadmin'],
  admin       : ['superadmin', 'adminclinique'],
  medical     : ['superadmin', 'medecin', 'infirmier'],
  medecin     : ['superadmin', 'medecin'],
  pharmacie   : ['superadmin', 'adminclinique', 'pharmacien', 'medecin'],
  consultation: ['superadmin', 'medecin', 'infirmier'],
  finance     : ['superadmin', 'adminclinique', 'comptable'],
  hospitalisation: ['superadmin', 'adminclinique', 'medecin', 'infirmier'],
  prescription: ['superadmin', 'medecin', 'pharmacien', 'infirmier'],
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

        {/* ── Agenda & Consultations ───────────────────────────────────── */}
        <Route path="appointments"  element={<Appointments />} />
        <Route path="consultations" element={<Guard roles={ROLES.consultation}><Consultations /></Guard>} />
        <Route path="prescriptions" element={<Guard roles={ROLES.prescription}><Prescriptions /></Guard>} />

        {/* ── Hospitalisation & Chirurgie ──────────────────────────────── */}
        <Route path="hospitalization" element={<Guard roles={ROLES.hospitalisation}><Hospitalization /></Guard>} />
        <Route path="chirurgie"       element={<Chirurgie />} />
        <Route path="blocoperatoire"  element={<Blocoperatoire />} />

        {/* ── Urgences & Spécialités ───────────────────────────────────── */}
        <Route path="urgences"   element={<Urgences />} />
        <Route path="pediatrie"  element={<Pediatrie />} />
        <Route path="maternite"  element={<Maternite />} />

        {/* ── Paraclinique ─────────────────────────────────────────────── */}
        <Route path="laboratory"   element={<Laboratory />} />
        <Route path="radiology"    element={<Radiology />} />
        <Route path="echographie"  element={<Echographie />} />

        {/* ── Pharmacie ────────────────────────────────────────────────── */}
        <Route path="pharmacy" element={<Guard roles={ROLES.pharmacie}><Pharmacy /></Guard>} />

        {/* ── Administration & Finance ─────────────────────────────────── */}
        <Route path="hr"             element={<Guard roles={ROLES.admin}><HR /></Guard>} />
        <Route path="finance"        element={<Guard roles={ROLES.finance}><Finance /></Guard>} />
        <Route path="finance/:id/print" element={<Guard roles={ROLES.finance}><InvoicePrint /></Guard>} />
        <Route path="administration" element={<Guard roles={ROLES.admin}><Administration /></Guard>} />
        <Route path="settings"       element={<Guard roles={ROLES.admin}><Settings /></Guard>} />

        {/* ── Outils & Communication ───────────────────────────────────── */}
        <Route path="messages"  element={<Messages />} />
        <Route path="ai"        element={<Guard roles={ROLES.medecin}><AI /></Guard>} />
        <Route path="archive"   element={<Guard roles={ROLES.admin}><Archive /></Guard>} />
        <Route path="audit"     element={<Guard roles={ROLES.superadmin}><Audit /></Guard>} />
        <Route path="analytics" element={<Guard roles={ROLES.admin}><Analytics /></Guard>} />

        {/* ── Portail patient ──────────────────────────────────────────── */}
        <Route path="portal" element={<Guard roles={['patient']}><Portal /></Guard>} />

        {/* 404 dans le layout */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* 404 hors layout */}
      <Route path="*" element={<NotFound />} />

    </Routes>
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
      </SocketProvider>
    </AuthProvider>
  );
}