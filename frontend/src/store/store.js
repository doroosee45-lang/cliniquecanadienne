import { configureStore } from '@reduxjs/toolkit';
import patientsReducer from './slices/patientsSlice';
import appointmentsReducer from './slices/appointmentsSlice';
import consultationsReducer from './slices/consultationsSlice';
import hospitalizationReducer from './slices/hospitalizationSlice';
import aiReducer from './slices/aiSlice';
import auditReducer from './slices/auditSlice';
import analyticsReducer from './slices/analyticsSlice';
import administrationReducer from './slices/administrationSlice';
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
    ai: aiReducer,
    audit: auditReducer,
    analytics: analyticsReducer,
    administration: administrationReducer,
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
