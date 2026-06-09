import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchEchographieStats = createAsyncThunk(
  'echographie/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/echographie/stats');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur statistiques');
    }
  }
);

export const fetchDemandes = createAsyncThunk(
  'echographie/fetchAll',
  async ({ page = 1, limit = 100, q = '', type = '', statut = '', priorite = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (q)       params.set('q', q);
      if (type)    params.set('type', type);
      if (statut)  params.set('statut', statut);
      if (priorite)params.set('priorite', priorite);
      const { data } = await api.get(`/echographie?${params}`);
      return { demandes: data.demandes, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement demandes');
    }
  }
);

export const createDemande = createAsyncThunk(
  'echographie/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/echographie', body);
      return data.demande;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création demande');
    }
  }
);

export const updateDemande = createAsyncThunk(
  'echographie/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/echographie/${id}`, body);
      return data.demande;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour');
    }
  }
);

export const planifierDemande = createAsyncThunk(
  'echographie/planifier',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/echographie/${id}/planifier`, body);
      return data.demande;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur planification');
    }
  }
);

export const saveRapport = createAsyncThunk(
  'echographie/saveRapport',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/echographie/${id}/rapport`, body);
      return data.demande;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur rapport');
    }
  }
);

export const annulerDemande = createAsyncThunk(
  'echographie/annuler',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/echographie/${id}/annuler`);
      return data.demande;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur annulation');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const echographieSlice = createSlice({
  name: 'echographie',
  initialState: {
    kpis: {
      total: 0, en_attente: 0, planifiees: 0, realisees: 0, validees: 0,
      urgentes: 0, planifiees_aujourd_hui: 0, realisees_aujourd_hui: 0,
    },
    typeMap: {},
    chart:   { labels: [], data: [] },

    demandes: [],
    total:    0,
    page:     1,

    filters: { q: '', type: '', statut: '', priorite: '' },

    loading: false,
    saving:  false,
    error:   null,
  },

  reducers: {
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setPage(state, action)    { state.page = action.payload; },
    clearError(state)         { state.error = null; },
    patchDemande(state, action) {
      const id  = action.payload._id || action.payload.id;
      const idx = state.demandes.findIndex(d => (d._id || d.id) === id);
      if (idx !== -1) state.demandes[idx] = { ...state.demandes[idx], ...action.payload };
    },
  },

  extraReducers: (builder) => {
    // Stats
    builder.addCase(fetchEchographieStats.fulfilled, (state, action) => {
      state.kpis    = action.payload.kpis    || state.kpis;
      state.typeMap = action.payload.typeMap || {};
      state.chart   = action.payload.chart   || state.chart;
    });

    // List
    builder
      .addCase(fetchDemandes.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDemandes.fulfilled, (state, action) => {
        state.loading  = false;
        state.demandes = action.payload.demandes;
        state.total    = action.payload.total;
        state.page     = action.payload.page;
      })
      .addCase(fetchDemandes.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // Create
    builder
      .addCase(createDemande.pending,   (state) => { state.saving = true; })
      .addCase(createDemande.fulfilled, (state, action) => {
        state.saving = false;
        state.demandes.unshift(action.payload);
        state.total += 1;
        state.kpis.total += 1;
        state.kpis.en_attente += 1;
        if (action.payload.priorite === 'urgente') state.kpis.urgentes += 1;
      })
      .addCase(createDemande.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Shared fulfilled handler: patch the item in the list
    const patchFulfilled = (state, action) => {
      state.saving = false;
      const idx = state.demandes.findIndex(d => d._id === action.payload._id);
      if (idx !== -1) state.demandes[idx] = action.payload;
    };
    const pendingFn  = (state) => { state.saving = true; };
    const rejectFn   = (state, action) => { state.saving = false; state.error = action.payload; };

    builder
      .addCase(updateDemande.pending,   pendingFn)
      .addCase(updateDemande.fulfilled, patchFulfilled)
      .addCase(updateDemande.rejected,  rejectFn);

    builder
      .addCase(planifierDemande.pending,   pendingFn)
      .addCase(planifierDemande.fulfilled, patchFulfilled)
      .addCase(planifierDemande.rejected,  rejectFn);

    builder
      .addCase(saveRapport.pending,   pendingFn)
      .addCase(saveRapport.fulfilled, patchFulfilled)
      .addCase(saveRapport.rejected,  rejectFn);

    builder
      .addCase(annulerDemande.pending,   pendingFn)
      .addCase(annulerDemande.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.demandes.findIndex(d => d._id === action.payload._id);
        if (idx !== -1) state.demandes[idx] = action.payload;
        state.kpis.en_attente = Math.max(0, state.kpis.en_attente - 1);
      })
      .addCase(annulerDemande.rejected, rejectFn);
  },
});

export const { setFilters, setPage, clearError, patchDemande } = echographieSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectEchographieKpis    = (state) => state.echographie.kpis;
export const selectEchographieTypeMap = (state) => state.echographie.typeMap;
export const selectEchographieChart   = (state) => state.echographie.chart;
export const selectDemandesList       = (state) => state.echographie.demandes;
export const selectDemandesTotal      = (state) => state.echographie.total;
export const selectDemandesPage       = (state) => state.echographie.page;
export const selectDemandesFilters    = (state) => state.echographie.filters;
export const selectEchographieLoading = (state) => state.echographie.loading;
export const selectEchographieSaving  = (state) => state.echographie.saving;

export default echographieSlice.reducer;
