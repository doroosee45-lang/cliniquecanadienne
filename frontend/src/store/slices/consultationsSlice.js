import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchConsultations = createAsyncThunk(
  'consultations/fetchAll',
  async ({ page = 1, limit = 20, patient = '', medecin = '', statut = '', date = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (patient) params.set('patient', patient);
      if (medecin) params.set('medecin', medecin);
      if (statut) params.set('statut', statut);
      if (date) params.set('date', date);
      const { data } = await api.get(`/consultations?${params}`);
      return { consultations: data.consultations, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement consultations');
    }
  }
);

export const fetchConsultationById = createAsyncThunk(
  'consultations/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/consultations/${id}`);
      return data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Consultation introuvable');
    }
  }
);

export const createConsultation = createAsyncThunk(
  'consultations/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/consultations', body);
      return data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création consultation');
    }
  }
);

export const updateConsultation = createAsyncThunk(
  'consultations/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/consultations/${id}`, body);
      return data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour consultation');
    }
  }
);

const consultationsSlice = createSlice({
  name: 'consultations',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    iaEnabled: true,
    filters: { patient: '', medecin: '', statut: '', date: '' },
    vitals: {
      tension_systolique: '',
      tension_diastolique: '',
      pouls: '',
      temperature: '',
      spo2: '',
      glycemie: '',
      poids: '',
      taille: '',
    },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setVitals(state, action) { state.vitals = { ...state.vitals, ...action.payload }; },
    resetVitals(state) {
      state.vitals = { tension_systolique:'', tension_diastolique:'', pouls:'', temperature:'', spo2:'', glycemie:'', poids:'', taille:'' };
    },
    toggleIA(state) { state.iaEnabled = !state.iaEnabled; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConsultations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.consultations;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchConsultations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchConsultationById.fulfilled, (state, action) => {
        state.current = action.payload;
      })
      .addCase(createConsultation.pending, (state) => { state.saving = true; })
      .addCase(createConsultation.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createConsultation.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateConsultation.pending, (state) => { state.saving = true; })
      .addCase(updateConsultation.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(c => c._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.current?._id === action.payload._id) state.current = action.payload;
      })
      .addCase(updateConsultation.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setVitals, resetVitals, toggleIA, clearError } = consultationsSlice.actions;

export const selectConsultations = (state) => state.consultations.list;
export const selectCurrentConsultation = (state) => state.consultations.current;
export const selectConsultationsTotal = (state) => state.consultations.total;
export const selectConsultationsLoading = (state) => state.consultations.loading;
export const selectConsultationsSaving = (state) => state.consultations.saving;
export const selectConsultationsPage = (state) => state.consultations.page;
export const selectConsultationsFilters = (state) => state.consultations.filters;
export const selectVitals = (state) => state.consultations.vitals;
export const selectIAEnabled = (state) => state.consultations.iaEnabled;

export default consultationsSlice.reducer;
