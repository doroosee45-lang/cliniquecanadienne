import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchPatients = createAsyncThunk(
  'patients/fetchAll',
  async ({ page = 1, limit = 20, search = '', statut = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('q', search);
      if (statut) params.set('statut', statut);
      const { data } = await api.get(`/patients?${params}`);
      return { patients: data.patients, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement patients');
    }
  }
);

export const fetchPatientById = createAsyncThunk(
  'patients/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/patients/${id}`);
      return data.patient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Patient introuvable');
    }
  }
);

export const createPatient = createAsyncThunk(
  'patients/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/patients', body);
      return data; // { patient, email_envoye, message }
    } catch (err) {
      // Passe l'objet complet pour récupérer redirect:'update' en cas de 409
      return rejectWithValue(err.response?.data || { message: 'Erreur création patient' });
    }
  }
);

export const updatePatient = createAsyncThunk(
  'patients/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/patients/${id}`, body);
      return data.patient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour patient');
    }
  }
);

export const deletePatient = createAsyncThunk(
  'patients/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/patients/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur suppression patient');
    }
  }
);

export const searchPatients = createAsyncThunk(
  'patients/search',
  async (q, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/patients/search?q=${encodeURIComponent(q)}`);
      return data.patients || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur recherche');
    }
  }
);

const patientsSlice = createSlice({
  name: 'patients',
  initialState: {
    list: [],
    searchResults: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    filters: { search: '', statut: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    clearCurrent(state) { state.current = null; },
    clearSearch(state) { state.searchResults = []; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatients.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.patients;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPatientById.pending, (state) => { state.loading = true; })
      .addCase(fetchPatientById.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchPatientById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createPatient.pending, (state) => { state.saving = true; })
      .addCase(createPatient.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload?.patient) {
          state.list.unshift(action.payload.patient);
          state.total += 1;
        }
      })
      .addCase(createPatient.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updatePatient.pending, (state) => { state.saving = true; })
      .addCase(updatePatient.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.current?._id === action.payload._id) state.current = action.payload;
      })
      .addCase(updatePatient.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(deletePatient.fulfilled, (state, action) => {
        state.list = state.list.filter(p => p._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.searchResults = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, clearCurrent, clearSearch, clearError } = patientsSlice.actions;

export const selectPatients = (state) => state.patients.list;
export const selectPatientSearchResults = (state) => state.patients.searchResults;
export const selectCurrentPatient = (state) => state.patients.current;
export const selectPatientsTotal = (state) => state.patients.total;
export const selectPatientsLoading = (state) => state.patients.loading;
export const selectPatientsSaving = (state) => state.patients.saving;
export const selectPatientsPage = (state) => state.patients.page;
export const selectPatientsFilters = (state) => state.patients.filters;
export const selectPatientsError = (state) => state.patients.error;

export default patientsSlice.reducer;
