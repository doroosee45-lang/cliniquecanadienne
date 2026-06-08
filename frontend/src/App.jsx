import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/Layout/Layout';
import Spinner from './components/UI/Spinner';

import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Hospitalization from './pages/Hospitalization';
import Laboratory from './pages/Laboratory';
import Radiology from './pages/Radiology';
import Pharmacy from './pages/Pharmacy';
import Prescriptions from './pages/Prescriptions';
import HR from './pages/HR';
import Finance from './pages/Finance';
import InvoicePrint from './pages/InvoicePrint';
import Messages from './pages/Messages';
import AI from './pages/AI';
import Archive from './pages/Archive';
import Audit from './pages/Audit';
import Analytics from './pages/Analytics';
import Administration from './pages/Administration';
import Settings from './pages/Settings';
import Portal from './pages/Portal';
import ActivationPatient from './pages/ActivationPatient';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Chirurgie from './pages/Chirurgie';
import Blocoperatoire from './pages/Blocoperatoire';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>;

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"                 element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password"       element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/activate/:token"       element={<ActivationPatient />} />

      {/* Protected layout */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />

        {/* Patients */}
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />

        {/* RDV + Consultations */}
        <Route path="appointments" element={<Appointments />} />
        <Route path="consultations" element={
          <ProtectedRoute roles={['superadmin', 'medecin', 'infirmier']}>
            <Consultations />
          </ProtectedRoute>
        } />

        {/* Ordonnances */}
        <Route path="prescriptions" element={
          <ProtectedRoute roles={['superadmin', 'medecin', 'pharmacien', 'infirmier']}>
            <Prescriptions />
          </ProtectedRoute>
        } />

        {/* Hospitalisation */}
        <Route path="hospitalization" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique', 'medecin', 'infirmier']}>
            <Hospitalization />
          </ProtectedRoute>
        } />

        {/* Paraclinique */}
        <Route path="laboratory" element={<Laboratory />} />
        <Route path="radiology" element={<Radiology />} />
        <Route path="chirurgie" element={<Chirurgie />} />
        <Route path="blocoperatoire" element={<Blocoperatoire />} />

        {/* Pharmacie */}
        <Route path="pharmacy" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique', 'pharmacien', 'medecin']}>
            <Pharmacy />
          </ProtectedRoute>
        } />

        {/* RH */}
        <Route path="hr" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique']}>
            <HR />
          </ProtectedRoute>
        } />

        {/* Finance */}
        <Route path="finance" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique', 'comptable']}>
            <Finance />
          </ProtectedRoute>
        } />
        <Route path="finance/:id/print" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique', 'comptable']}>
            <InvoicePrint />
          </ProtectedRoute>
        } />

        {/* Communication */}
        <Route path="messages" element={<Messages />} />

        {/* IA */}
        <Route path="ai" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique', 'medecin']}>
            <AI />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="archive" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique']}>
            <Archive />
          </ProtectedRoute>
        } />
        <Route path="audit" element={
          <ProtectedRoute roles={['superadmin']}>
            <Audit />
          </ProtectedRoute>
        } />
        <Route path="analytics" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique']}>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="administration" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique']}>
            <Administration />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute roles={['superadmin', 'adminclinique']}>
            <Settings />
          </ProtectedRoute>
        } />

        {/* Portail patient */}
        <Route path="portal" element={
          <ProtectedRoute roles={['patient']}>
            <Portal />
          </ProtectedRoute>
        } />

        {/* 404 dans le layout */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* 404 hors layout */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}
