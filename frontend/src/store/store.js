import { configureStore } from '@reduxjs/toolkit';
import patientsReducer from './slices/patientsSlice';
import appointmentsReducer from './slices/appointmentsSlice';
import consultationsReducer from './slices/consultationsSlice';
import hospitalizationReducer from './slices/hospitalizationSlice';
import laboratoryReducer from './slices/laboratorySlice';
import radiologyReducer from './slices/radiologySlice';
import pharmacyReducer from './slices/pharmacySlice';
import prescriptionsReducer from './slices/prescriptionsSlice';
import financeReducer from './slices/financeSlice';
import hrReducer from './slices/hrSlice';
import aiReducer from './slices/aiSlice';
import auditReducer from './slices/auditSlice';
import analyticsReducer from './slices/analyticsSlice';
import administrationReducer from './slices/administrationSlice';
import chirurgieReducer from './slices/chirurgieSlice';
import blocoperatoireReducer from './slices/blocoperatoireSlice';
import archiveReducer from './slices/archiveSlice';
import invoicePrintReducer from './slices/invoicePrintSlice';
import portalReducer from './slices/portalSlice';
import materniteReducer from './slices/materniteSlice';
import pediatrieReducer from './slices/pediatrieSlice';
import urgencesReducer from './slices/urgencesSlice';
import echographieReducer from './slices/echographieSlice';
import dossiersMedicauxReducer from './slices/dossiersMedicauxSlice';

const store = configureStore({
  reducer: {
    patients: patientsReducer,
    appointments: appointmentsReducer,
    consultations: consultationsReducer,
    hospitalization: hospitalizationReducer,
    laboratory: laboratoryReducer,
    radiology: radiologyReducer,
    pharmacy: pharmacyReducer,
    prescriptions: prescriptionsReducer,
    finance: financeReducer,
    hr: hrReducer,
    ai: aiReducer,
    audit: auditReducer,
    analytics: analyticsReducer,
    administration: administrationReducer,
    chirurgie: chirurgieReducer,
    blocoperatoire: blocoperatoireReducer,
    archive: archiveReducer,
    invoicePrint: invoicePrintReducer,
    portal: portalReducer,
    maternite: materniteReducer,
    pediatrie: pediatrieReducer,
    urgences:     urgencesReducer,
    echographie:  echographieReducer,
    dossiersMedicaux: dossiersMedicauxReducer,
  },
});

export default store;
