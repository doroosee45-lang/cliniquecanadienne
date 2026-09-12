import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchPortalMe = createAsyncThunk(
  'portal/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/me');
      return data; // { patient, stats, must_change_password }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement profil');
    }
  }
);

export const fetchPortalAppointments = createAsyncThunk(
  'portal/fetchAppointments',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/appointments');
      return data.appointments;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur rendez-vous');
    }
  }
);

// PORTAL-RDV-001 — options réelles (services actifs + médecins actifs,
// portal.controller.js::getBookingOptions) pour peupler les sélecteurs de la
// modale "Prendre un rendez-vous", auparavant vide/désactivée (AUDIT-11).
export const fetchPortalBookingOptions = createAsyncThunk(
  'portal/fetchBookingOptions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/booking-options');
      return { services: data.services, medecins: data.medecins };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement des options de rendez-vous');
    }
  }
);

export const createPortalAppointment = createAsyncThunk(
  'portal/createAppointment',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/portal/appointments', body);
      return data.appointment;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur lors de la demande de rendez-vous');
    }
  }
);

export const cancelPortalAppointment = createAsyncThunk(
  'portal/cancelAppointment',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/portal/appointments/${id}/cancel`);
      return data.appointment;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Erreur lors de l'annulation du rendez-vous");
    }
  }
);

export const fetchPortalPrescriptions = createAsyncThunk(
  'portal/fetchPrescriptions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/prescriptions');
      return data.prescriptions;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur ordonnances');
    }
  }
);

export const fetchPortalLabResults = createAsyncThunk(
  'portal/fetchLabResults',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/lab-results');
      return data.labResults;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur laboratoire');
    }
  }
);

export const fetchPortalImaging = createAsyncThunk(
  'portal/fetchImaging',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/imaging');
      return data.imaging;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur imagerie');
    }
  }
);

export const fetchPortalInvoices = createAsyncThunk(
  'portal/fetchInvoices',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/invoices');
      return data.invoices;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur factures');
    }
  }
);

export const fetchPortalNotifications = createAsyncThunk(
  'portal/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/notifications');
      return data.notifications;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur notifications');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'portal/markNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.put('/portal/notifications/read-all');
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur');
    }
  }
);

// Sous-phase 5.1 (relecture du 6 sept. 2026) — expose les vraies constantes
// du patient (dernière + historique réel, portal.controller.js::getDashboard)
// pour remplacer CONSTANTES codée en dur dans Portal.jsx.
export const fetchPortalDashboard = createAsyncThunk(
  'portal/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/dashboard');
      return data.stats;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur tableau de bord');
    }
  }
);

// Sous-phase 5.4 — expose les vraies vaccinations du patient
// (Child.vaccinations[], portal.controller.js::getVaccinations) pour
// remplacer VACCINS codée en dur (4 vaccins/dates inventés, identiques pour
// tout patient) dans Portal.jsx.
export const fetchPortalVaccinations = createAsyncThunk(
  'portal/fetchVaccinations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/vaccinations');
      return data.vaccinations;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur vaccinations');
    }
  }
);

// PORTAL-DOSSIER-001 — "Mon dossier" n'exposait ni consultations, ni
// hospitalisations, ni documents (aucun endpoint portail ne les servait).
export const fetchPortalConsultations = createAsyncThunk(
  'portal/fetchConsultations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/consultations');
      return data.consultations;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement des consultations');
    }
  }
);

export const fetchPortalHospitalizations = createAsyncThunk(
  'portal/fetchHospitalizations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/hospitalizations');
      return data.hospitalizations;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement des hospitalisations');
    }
  }
);

export const fetchPortalDocuments = createAsyncThunk(
  'portal/fetchDocuments',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/portal/documents');
      return data.documents;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement des documents');
    }
  }
);

export const updatePortalProfile = createAsyncThunk(
  'portal/updateProfile',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/portal/profile', body);
      return data.patient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour profil');
    }
  }
);

export const changePortalPassword = createAsyncThunk(
  'portal/changePassword',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/portal/change-password', body);
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur changement mot de passe');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const portalSlice = createSlice({
  name: 'portal',
  initialState: {
    patient:            null,
    stats:              { nbRdv:0, nbOrd:0, nbLabo:0, nbImag:0, nbFact:0, nbFactImpayees:0 },
    mustChangePassword: false,
    appointments:       [],
    prescriptions:      [],
    labResults:         [],
    imaging:            [],
    invoices:           [],
    notifications:      [],
    constantes:         {},
    constantesHistorique: [],
    vaccinations:       [],
    consultations:      [],
    hospitalizations:   [],
    documents:          [],
    bookingOptions:     { services: [], medecins: [] },
    loading:            false,
    saving:             false,
    error:              null,
  },
  reducers: {
    clearPortalError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    const pending   = (state) => { state.loading = true;  state.error = null; };
    const rejected  = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      // fetchMe
      .addCase(fetchPortalMe.pending,   pending)
      .addCase(fetchPortalMe.fulfilled, (state, action) => {
        state.loading            = false;
        state.patient            = action.payload.patient;
        state.stats              = action.payload.stats;
        state.mustChangePassword = action.payload.must_change_password;
      })
      .addCase(fetchPortalMe.rejected,  rejected)

      // appointments
      .addCase(fetchPortalAppointments.pending,   pending)
      .addCase(fetchPortalAppointments.fulfilled, (state, action) => { state.loading = false; state.appointments = action.payload; })
      .addCase(fetchPortalAppointments.rejected,  rejected)

      // booking options (services/médecins actifs pour la prise de RDV)
      .addCase(fetchPortalBookingOptions.fulfilled, (state, action) => { state.bookingOptions = action.payload; })
      .addCase(fetchPortalBookingOptions.rejected,  (state, action) => { state.error = action.payload; })

      // création de RDV — insère en tête, cohérent avec le tri -date_heure du backend
      .addCase(createPortalAppointment.pending,   (state) => { state.saving = true; state.error = null; })
      .addCase(createPortalAppointment.fulfilled, (state, action) => { state.saving = false; state.appointments = [action.payload, ...state.appointments]; })
      .addCase(createPortalAppointment.rejected,  (state, action) => { state.saving = false; state.error = action.payload; })

      // annulation de RDV — remplace l'entrée mise à jour (statut: annule)
      .addCase(cancelPortalAppointment.pending,   (state) => { state.saving = true; state.error = null; })
      .addCase(cancelPortalAppointment.fulfilled, (state, action) => {
        state.saving = false;
        state.appointments = state.appointments.map(a => (a._id === action.payload._id ? action.payload : a));
      })
      .addCase(cancelPortalAppointment.rejected,  (state, action) => { state.saving = false; state.error = action.payload; })

      // prescriptions
      .addCase(fetchPortalPrescriptions.pending,   pending)
      .addCase(fetchPortalPrescriptions.fulfilled, (state, action) => { state.loading = false; state.prescriptions = action.payload; })
      .addCase(fetchPortalPrescriptions.rejected,  rejected)

      // labResults
      .addCase(fetchPortalLabResults.pending,   pending)
      .addCase(fetchPortalLabResults.fulfilled, (state, action) => { state.loading = false; state.labResults = action.payload; })
      .addCase(fetchPortalLabResults.rejected,  rejected)

      // imaging
      .addCase(fetchPortalImaging.pending,   pending)
      .addCase(fetchPortalImaging.fulfilled, (state, action) => { state.loading = false; state.imaging = action.payload; })
      .addCase(fetchPortalImaging.rejected,  rejected)

      // invoices
      .addCase(fetchPortalInvoices.pending,   pending)
      .addCase(fetchPortalInvoices.fulfilled, (state, action) => { state.loading = false; state.invoices = action.payload; })
      .addCase(fetchPortalInvoices.rejected,  rejected)

      // notifications
      .addCase(fetchPortalNotifications.pending,   (state) => { state.error = null; })
      .addCase(fetchPortalNotifications.fulfilled, (state, action) => { state.notifications = action.payload; })
      .addCase(fetchPortalNotifications.rejected,  rejected)

      // dashboard (constantes réelles)
      .addCase(fetchPortalDashboard.fulfilled, (state, action) => {
        state.constantes = action.payload.constantes || {};
        state.constantesHistorique = action.payload.constantes_historique || [];
      })
      .addCase(fetchPortalDashboard.rejected, (state) => {
        state.constantes = {};
        state.constantesHistorique = [];
      })

      // vaccinations (réelles, Child.vaccinations[])
      .addCase(fetchPortalVaccinations.fulfilled, (state, action) => { state.vaccinations = action.payload || []; })
      .addCase(fetchPortalVaccinations.rejected,  (state) => { state.vaccinations = []; })

      // consultations / hospitalisations / documents (Mon dossier)
      .addCase(fetchPortalConsultations.fulfilled, (state, action) => { state.consultations = action.payload || []; })
      .addCase(fetchPortalConsultations.rejected,  (state) => { state.consultations = []; })
      .addCase(fetchPortalHospitalizations.fulfilled, (state, action) => { state.hospitalizations = action.payload || []; })
      .addCase(fetchPortalHospitalizations.rejected,  (state) => { state.hospitalizations = []; })
      .addCase(fetchPortalDocuments.fulfilled, (state, action) => { state.documents = action.payload || []; })
      .addCase(fetchPortalDocuments.rejected,  (state) => { state.documents = []; })

      // mark all read
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map(n => ({ ...n, lu: true }));
      })

      // updateProfile
      .addCase(updatePortalProfile.pending,   (state) => { state.saving = true;  state.error = null; })
      .addCase(updatePortalProfile.fulfilled, (state, action) => { state.saving = false; state.patient = action.payload; })
      .addCase(updatePortalProfile.rejected,  (state, action) => { state.saving = false; state.error = action.payload; })

      // changePassword
      .addCase(changePortalPassword.pending,   (state) => { state.saving = true;  state.error = null; })
      .addCase(changePortalPassword.fulfilled, (state) => { state.saving = false; state.mustChangePassword = false; })
      .addCase(changePortalPassword.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });
  },
});

export const { clearPortalError } = portalSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectPortalPatient       = (s) => s.portal.patient;
export const selectPortalStats         = (s) => s.portal.stats;
export const selectMustChangePassword  = (s) => s.portal.mustChangePassword;
export const selectPortalAppointments  = (s) => s.portal.appointments;
export const selectPortalPrescriptions = (s) => s.portal.prescriptions;
export const selectPortalLabResults    = (s) => s.portal.labResults;
export const selectPortalImaging       = (s) => s.portal.imaging;
export const selectPortalInvoices      = (s) => s.portal.invoices;
export const selectPortalNotifications = (s) => s.portal.notifications;
export const selectPortalConstantes    = (s) => s.portal.constantes;
export const selectPortalConstantesHistorique = (s) => s.portal.constantesHistorique;
export const selectPortalVaccinations  = (s) => s.portal.vaccinations;
export const selectPortalConsultations = (s) => s.portal.consultations;
export const selectPortalHospitalizations = (s) => s.portal.hospitalizations;
export const selectPortalDocuments     = (s) => s.portal.documents;
export const selectPortalBookingOptions = (s) => s.portal.bookingOptions;
export const selectPortalLoading       = (s) => s.portal.loading;
export const selectPortalSaving        = (s) => s.portal.saving;
export const selectPortalError         = (s) => s.portal.error;

export default portalSlice.reducer;
