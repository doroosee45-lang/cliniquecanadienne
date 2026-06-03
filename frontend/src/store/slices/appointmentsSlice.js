import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchAppointments = createAsyncThunk(
  'appointments/fetchAll',
  async ({ page = 1, limit = 20, statut = '', date = '', medecin = '', patient = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (date) params.set('date', date);
      if (medecin) params.set('medecin', medecin);
      if (patient) params.set('patient', patient);
      const { data } = await api.get(`/appointments?${params}`);
      return { appointments: data.appointments, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement RDV');
    }
  }
);

export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/appointments', body);
      return data.appointment;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création RDV');
    }
  }
);

export const updateAppointment = createAsyncThunk(
  'appointments/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/appointments/${id}`, body);
      return data.appointment;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour RDV');
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'appointments/cancel',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/appointments/${id}`, { statut: 'annule' });
      return data.appointment;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur annulation RDV');
    }
  }
);

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    filters: { statut: '', date: '', medecin: '', patient: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppointments.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.appointments;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createAppointment.pending, (state) => { state.saving = true; })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateAppointment.pending, (state) => { state.saving = true; })
      .addCase(updateAppointment.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(a => a._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateAppointment.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        const idx = state.list.findIndex(a => a._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, clearError } = appointmentsSlice.actions;

export const selectAppointments = (state) => state.appointments.list;
export const selectCurrentAppointment = (state) => state.appointments.current;
export const selectAppointmentsTotal = (state) => state.appointments.total;
export const selectAppointmentsLoading = (state) => state.appointments.loading;
export const selectAppointmentsSaving = (state) => state.appointments.saving;
export const selectAppointmentsPage = (state) => state.appointments.page;
export const selectAppointmentsFilters = (state) => state.appointments.filters;

export default appointmentsSlice.reducer;
