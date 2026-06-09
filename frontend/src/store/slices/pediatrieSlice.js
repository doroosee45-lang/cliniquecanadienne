import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchPediatrieStats = createAsyncThunk(
  'pediatrie/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/pediatrie/stats');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement statistiques');
    }
  }
);

export const fetchEnfants = createAsyncThunk(
  'pediatrie/fetchEnfants',
  async ({ page = 1, limit = 50, q = '', statut = '', age = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (q)      params.set('q', q);
      if (statut) params.set('statut', statut);
      if (age)    params.set('age', age);
      const { data } = await api.get(`/pediatrie/enfants?${params}`);
      return { enfants: data.enfants, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement patients');
    }
  }
);

export const fetchEnfantById = createAsyncThunk(
  'pediatrie/fetchEnfantById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/pediatrie/enfants/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement dossier');
    }
  }
);

export const createEnfant = createAsyncThunk(
  'pediatrie/createEnfant',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/pediatrie/enfants', body);
      return data.enfant;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création dossier pédiatrique');
    }
  }
);

export const updateEnfant = createAsyncThunk(
  'pediatrie/updateEnfant',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/pediatrie/enfants/${id}`, body);
      return data.enfant;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour dossier');
    }
  }
);

export const addVaccination = createAsyncThunk(
  'pediatrie/addVaccination',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/pediatrie/enfants/${id}/vaccinations`, body);
      return data.enfant;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement vaccination');
    }
  }
);

export const addMesureCroissance = createAsyncThunk(
  'pediatrie/addMesure',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/pediatrie/enfants/${id}/mesures`, body);
      return data.enfant;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement mesure');
    }
  }
);

export const addMaladieChronique = createAsyncThunk(
  'pediatrie/addMaladieChron',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/pediatrie/enfants/${id}/chroniques`, body);
      return data.enfant;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement maladie chronique');
    }
  }
);

export const fetchConsultations = createAsyncThunk(
  'pediatrie/fetchConsultations',
  async ({ limit = 50, q = '', type = '', child_id = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit });
      if (q)        params.set('q', q);
      if (type)     params.set('type', type);
      if (child_id) params.set('child_id', child_id);
      const { data } = await api.get(`/pediatrie/consultations?${params}`);
      return { consultations: data.consultations, total: data.total };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement consultations');
    }
  }
);

export const createConsultation = createAsyncThunk(
  'pediatrie/createConsultation',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/pediatrie/consultations', body);
      return data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement consultation');
    }
  }
);

export const fetchUrgences = createAsyncThunk(
  'pediatrie/fetchUrgences',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/pediatrie/urgences');
      return { urgences: data.urgences, total: data.total };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement urgences');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const pediatrieSlice = createSlice({
  name: 'pediatrie',
  initialState: {
    stats: null,
    repartitionAge: [],
    topPatho: [],
    chart: null,

    enfants: [],
    enfantTotal: 0,
    enfantPage: 1,
    currentEnfant: null,
    currentConsultations: [],

    consultations: [],
    consultationTotal: 0,

    urgences: [],
    urgenceTotal: 0,

    filters: { q: '', statut: '', age: '' },

    loading: false,
    saving: false,
    error: null,
  },

  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      state.enfantPage = 1;
    },
    setEnfantPage(state, action) { state.enfantPage = action.payload; },
    setCurrentEnfant(state, action) { state.currentEnfant = action.payload; },
    clearError(state) { state.error = null; },
  },

  extraReducers: (builder) => {
    // ── Stats ──
    builder
      .addCase(fetchPediatrieStats.fulfilled, (state, action) => {
        state.stats          = action.payload.stats;
        state.repartitionAge = action.payload.repartitionAge;
        state.topPatho       = action.payload.topPatho;
        state.chart          = action.payload.chart;
      });

    // ── Enfants ──
    builder
      .addCase(fetchEnfants.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchEnfants.fulfilled, (state, action) => {
        state.loading     = false;
        state.enfants     = action.payload.enfants;
        state.enfantTotal = action.payload.total;
        state.enfantPage  = action.payload.page;
      })
      .addCase(fetchEnfants.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })
      .addCase(fetchEnfantById.fulfilled, (state, action) => {
        state.currentEnfant       = action.payload.enfant;
        state.currentConsultations = action.payload.consultations;
      })
      .addCase(createEnfant.pending,    (state) => { state.saving = true; })
      .addCase(createEnfant.fulfilled,  (state, action) => {
        state.saving = false;
        state.enfants.unshift(action.payload);
        state.enfantTotal += 1;
        if (state.stats) state.stats.totalEnfants += 1;
      })
      .addCase(createEnfant.rejected,   (state, action) => { state.saving = false; state.error = action.payload; })
      .addCase(updateEnfant.pending,    (state) => { state.saving = true; })
      .addCase(updateEnfant.fulfilled,  (state, action) => {
        state.saving = false;
        const idx = state.enfants.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.enfants[idx] = action.payload;
        if (state.currentEnfant?._id === action.payload._id) state.currentEnfant = action.payload;
      })
      .addCase(updateEnfant.rejected,   (state, action) => { state.saving = false; state.error = action.payload; });

    // ── Vaccination ──
    builder
      .addCase(addVaccination.pending,   (state) => { state.saving = true; })
      .addCase(addVaccination.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.enfants.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.enfants[idx] = action.payload;
        if (state.currentEnfant?._id === action.payload._id) state.currentEnfant = action.payload;
      })
      .addCase(addVaccination.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // ── Croissance ──
    builder
      .addCase(addMesureCroissance.pending,   (state) => { state.saving = true; })
      .addCase(addMesureCroissance.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.enfants.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.enfants[idx] = action.payload;
        if (state.currentEnfant?._id === action.payload._id) state.currentEnfant = action.payload;
      })
      .addCase(addMesureCroissance.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // ── Maladie chronique ──
    builder
      .addCase(addMaladieChronique.fulfilled, (state, action) => {
        const idx = state.enfants.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.enfants[idx] = action.payload;
        if (state.currentEnfant?._id === action.payload._id) state.currentEnfant = action.payload;
      });

    // ── Consultations ──
    builder
      .addCase(fetchConsultations.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.loading             = false;
        state.consultations       = action.payload.consultations;
        state.consultationTotal   = action.payload.total;
      })
      .addCase(fetchConsultations.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createConsultation.pending,   (state) => { state.saving = true; })
      .addCase(createConsultation.fulfilled, (state, action) => {
        state.saving = false;
        state.consultations.unshift(action.payload);
        state.consultationTotal += 1;
        if (action.payload.type === 'urgence' && state.stats) state.stats.urgences += 1;
        if (state.stats) state.stats.consultationsAujourdhui += 1;
      })
      .addCase(createConsultation.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // ── Urgences ──
    builder
      .addCase(fetchUrgences.pending,   (state) => { state.loading = true; })
      .addCase(fetchUrgences.fulfilled, (state, action) => {
        state.loading       = false;
        state.urgences      = action.payload.urgences;
        state.urgenceTotal  = action.payload.total;
      })
      .addCase(fetchUrgences.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { setFilters, setEnfantPage, setCurrentEnfant, clearError } = pediatrieSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectPediatrieStats      = (state) => state.pediatrie.stats;
export const selectRepartitionAge      = (state) => state.pediatrie.repartitionAge;
export const selectTopPatho            = (state) => state.pediatrie.topPatho;
export const selectPediatrieChart      = (state) => state.pediatrie.chart;
export const selectEnfants             = (state) => state.pediatrie.enfants;
export const selectEnfantTotal         = (state) => state.pediatrie.enfantTotal;
export const selectCurrentEnfant       = (state) => state.pediatrie.currentEnfant;
export const selectCurrentConsultations= (state) => state.pediatrie.currentConsultations;
export const selectConsultations       = (state) => state.pediatrie.consultations;
export const selectConsultationTotal   = (state) => state.pediatrie.consultationTotal;
export const selectUrgences            = (state) => state.pediatrie.urgences;
export const selectUrgenceTotal        = (state) => state.pediatrie.urgenceTotal;
export const selectPediatrieLoading    = (state) => state.pediatrie.loading;
export const selectPediatrieSaving     = (state) => state.pediatrie.saving;
export const selectPediatrieError      = (state) => state.pediatrie.error;
export const selectPediatrieFilters    = (state) => state.pediatrie.filters;

export default pediatrieSlice.reducer;
