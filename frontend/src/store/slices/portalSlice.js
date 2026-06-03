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
export const selectPortalLoading       = (s) => s.portal.loading;
export const selectPortalSaving        = (s) => s.portal.saving;
export const selectPortalError         = (s) => s.portal.error;

export default portalSlice.reducer;
