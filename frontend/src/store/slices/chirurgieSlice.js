import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchSurgeries = createAsyncThunk(
  'chirurgie/fetchAll',
  async ({ page = 1, limit = 20, statut = '', patient = '', chirurgien = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (patient) params.set('patient', patient);
      if (chirurgien) params.set('chirurgien', chirurgien);
      const { data } = await api.get(`/chirurgie?${params}`);
      return { surgeries: data.dossiers || data.surgeries || data.interventions || [], total: data.total || 0, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement chirurgies');
    }
  }
);

export const createSurgery = createAsyncThunk(
  'chirurgie/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/chirurgie', body);
      return data.surgery || data.intervention;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur programmation chirurgie');
    }
  }
);

export const updateSurgery = createAsyncThunk(
  'chirurgie/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/chirurgie/${id}`, body);
      return data.surgery || data.intervention;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour chirurgie');
    }
  }
);

const chirurgieSlice = createSlice({
  name: 'chirurgie',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    stats: { programmees: 0, realisees: 0, reportees: 0, urgences: 0 },
    filters: { statut: '', patient: '', chirurgien: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setStats(state, action) { state.stats = { ...state.stats, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSurgeries.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSurgeries.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.surgeries;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchSurgeries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createSurgery.pending, (state) => { state.saving = true; })
      .addCase(createSurgery.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) { state.list.unshift(action.payload); state.total += 1; }
      })
      .addCase(createSurgery.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateSurgery.pending, (state) => { state.saving = true; })
      .addCase(updateSurgery.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const idx = state.list.findIndex(s => s._id === action.payload._id);
          if (idx !== -1) state.list[idx] = action.payload;
        }
      })
      .addCase(updateSurgery.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setStats, clearError } = chirurgieSlice.actions;

export const selectSurgeries = (state) => state.chirurgie.list;
export const selectCurrentSurgery = (state) => state.chirurgie.current;
export const selectChirurgieTotal = (state) => state.chirurgie.total;
export const selectChirurgieLoading = (state) => state.chirurgie.loading;
export const selectChirurgieSaving = (state) => state.chirurgie.saving;
export const selectChirurgieStats = (state) => state.chirurgie.stats;

export default chirurgieSlice.reducer;
