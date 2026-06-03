import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchBlocPlanning = createAsyncThunk(
  'blocoperatoire/fetchPlanning',
  async ({ date = '', salle = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (salle) params.set('salle', salle);
      const query = params.toString() ? `?${params}` : '';
      const { data } = await api.get(`/blocoperatoire/planning${query}`);
      return data.planning || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement planning bloc');
    }
  }
);

export const fetchSalles = createAsyncThunk(
  'blocoperatoire/fetchSalles',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/blocoperatoire/salles');
      return data.salles || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement salles');
    }
  }
);

export const scheduleBlocIntervention = createAsyncThunk(
  'blocoperatoire/schedule',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/blocoperatoire/planning', body);
      return data.intervention;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur programmation bloc');
    }
  }
);

export const updateBlocIntervention = createAsyncThunk(
  'blocoperatoire/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/blocoperatoire/planning/${id}`, body);
      return data.intervention;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour bloc');
    }
  }
);

const blocoperatoireSlice = createSlice({
  name: 'blocoperatoire',
  initialState: {
    planning: [],
    salles: [],
    current: null,
    loading: false,
    saving: false,
    error: null,
    stats: { salles_dispo: 0, interventions_auj: 0, urgences: 0, sterilisation_ok: 0 },
    filters: { date: '', salle: '' },
  },
  reducers: {
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
    setCurrent(state, action) { state.current = action.payload; },
    setStats(state, action) { state.stats = { ...state.stats, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlocPlanning.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchBlocPlanning.fulfilled, (state, action) => {
        state.loading = false;
        state.planning = action.payload;
      })
      .addCase(fetchBlocPlanning.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchSalles.fulfilled, (state, action) => {
        state.salles = action.payload;
        state.stats.salles_dispo = action.payload.filter(s => s.statut === 'disponible').length;
      })
      .addCase(scheduleBlocIntervention.pending, (state) => { state.saving = true; })
      .addCase(scheduleBlocIntervention.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) state.planning.push(action.payload);
      })
      .addCase(scheduleBlocIntervention.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateBlocIntervention.pending, (state) => { state.saving = true; })
      .addCase(updateBlocIntervention.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const idx = state.planning.findIndex(p => p._id === action.payload._id);
          if (idx !== -1) state.planning[idx] = action.payload;
        }
      })
      .addCase(updateBlocIntervention.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { setFilters, setCurrent, setStats, clearError } = blocoperatoireSlice.actions;

export const selectBlocPlanning = (state) => state.blocoperatoire.planning;
export const selectSalles = (state) => state.blocoperatoire.salles;
export const selectCurrentBlocIntervention = (state) => state.blocoperatoire.current;
export const selectBlocLoading = (state) => state.blocoperatoire.loading;
export const selectBlocSaving = (state) => state.blocoperatoire.saving;
export const selectBlocStats = (state) => state.blocoperatoire.stats;

export default blocoperatoireSlice.reducer;
