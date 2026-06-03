import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import patientsReducer from './slices/patientsSlice';
import appointmentsReducer from './slices/appointmentsSlice';
import consultationsReducer from './slices/consultationsSlice';
import hospitalizationReducer from './slices/hospitalizationSlice';
import laboratoryReducer from './slices/laboratorySlice';
import radiologyReducer from './slices/radiologySlice';
import pharmacyReducer from './slices/pharmacySlice';
import prescriptionsReducer from './slices/prescriptionsSlice';
import financeReducer from './slices/financeSlice';
import dashboardReducer from './slices/dashboardSlice';
import hrReducer from './slices/hrSlice';
import messagesReducer from './slices/messagesSlice';
import aiReducer from './slices/aiSlice';
import auditReducer from './slices/auditSlice';
import analyticsReducer from './slices/analyticsSlice';
import administrationReducer from './slices/administrationSlice';
import chirurgieReducer from './slices/chirurgieSlice';
import blocoperatoireReducer from './slices/blocoperatoireSlice';
import archiveReducer from './slices/archiveSlice';
import invoicePrintReducer from './slices/invoicePrintSlice';
import uiReducer from './slices/uiSlice';
import portalReducer from './slices/portalSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    patients: patientsReducer,
    appointments: appointmentsReducer,
    consultations: consultationsReducer,
    hospitalization: hospitalizationReducer,
    laboratory: laboratoryReducer,
    radiology: radiologyReducer,
    pharmacy: pharmacyReducer,
    prescriptions: prescriptionsReducer,
    finance: financeReducer,
    dashboard: dashboardReducer,
    hr: hrReducer,
    messages: messagesReducer,
    ai: aiReducer,
    audit: auditReducer,
    analytics: analyticsReducer,
    administration: administrationReducer,
    chirurgie: chirurgieReducer,
    blocoperatoire: blocoperatoireReducer,
    archive: archiveReducer,
    invoicePrint: invoicePrintReducer,
    ui: uiReducer,
    portal: portalReducer,
  },
});

export default store;
