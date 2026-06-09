import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchMaterniteStats = createAsyncThunk(
  'maternite/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/maternite/stats');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement statistiques');
    }
  }
);

export const fetchGrossesses = createAsyncThunk(
  'maternite/fetchGrossesses',
  async ({ page = 1, limit = 50, q = '', statut = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (q) params.set('q', q);
      if (statut) params.set('statut', statut);
      const { data } = await api.get(`/maternite/grossesses?${params}`);
      return { grossesses: data.grossesses, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement dossiers grossesse');
    }
  }
);

export const fetchGrossesseById = createAsyncThunk(
  'maternite/fetchGrossesseById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/maternite/grossesses/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement dossier');
    }
  }
);

export const createGrossesse = createAsyncThunk(
  'maternite/createGrossesse',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/maternite/grossesses', body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création dossier grossesse');
    }
  }
);

export const updateGrossesse = createAsyncThunk(
  'maternite/updateGrossesse',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/maternite/grossesses/${id}`, body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour grossesse');
    }
  }
);

export const addCPN = createAsyncThunk(
  'maternite/addCPN',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/maternite/grossesses/${id}/cpn`, body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement CPN');
    }
  }
);

export const addEcho = createAsyncThunk(
  'maternite/addEcho',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/maternite/grossesses/${id}/echo`, body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement échographie');
    }
  }
);

export const updateTravail = createAsyncThunk(
  'maternite/updateTravail',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/maternite/grossesses/${id}/travail`, body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour salle de travail');
    }
  }
);

export const addPostnatal = createAsyncThunk(
  'maternite/addPostnatal',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/maternite/grossesses/${id}/postnatal`, body);
      return data.grossesse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement suivi postnatal');
    }
  }
);

export const fetchAccouchements = createAsyncThunk(
  'maternite/fetchAccouchements',
  async ({ limit = 50, q = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit });
      if (q) params.set('q', q);
      const { data } = await api.get(`/maternite/accouchements?${params}`);
      return { accouchements: data.accouchements, total: data.total };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement accouchements');
    }
  }
);

export const createAccouchement = createAsyncThunk(
  'maternite/createAccouchement',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/maternite/accouchements', body);
      return data.accouchement;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur déclaration accouchement');
    }
  }
);

export const fetchNouveauxNes = createAsyncThunk(
  'maternite/fetchNouveauxNes',
  async ({ limit = 50, q = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit });
      if (q) params.set('q', q);
      const { data } = await api.get(`/maternite/nouveau-nes?${params}`);
      return { nouveauNes: data.nouveaunes, total: data.total };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement nouveau-nés');
    }
  }
);

export const createNouveauNe = createAsyncThunk(
  'maternite/createNouveauNe',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/maternite/nouveau-nes', body);
      return data.nouveau_ne;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement nouveau-né');
    }
  }
);

export const updateNouveauNe = createAsyncThunk(
  'maternite/updateNouveauNe',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/maternite/nouveau-nes/${id}`, body);
      return data.nouveau_ne;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour nouveau-né');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const materniteSlice = createSlice({
  name: 'maternite',
  initialState: {
    // Stats
    stats: null,
    chart: null,

    // Grossesses
    grossesses: [],
    grossesseTotal: 0,
    grossessePage: 1,
    currentGrossesse: null,

    // Accouchements
    accouchements: [],
    accouchementTotal: 0,

    // Nouveau-nés
    nouveauNes: [],
    nouveauNeTotal: 0,

    // Filtres
    filters: { q: '', statut: '' },

    // UI
    loading: false,
    saving: false,
    error: null,
  },

  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      state.grossessePage = 1;
    },
    setGrossessePage(state, action) { state.grossessePage = action.payload; },
    setCurrentGrossesse(state, action) { state.currentGrossesse = action.payload; },
    clearError(state) { state.error = null; },
  },

  extraReducers: (builder) => {
    // ── Stats ──
    builder
      .addCase(fetchMaterniteStats.fulfilled, (state, action) => {
        state.stats = action.payload.stats;
        state.chart = action.payload.chart;
      });

    // ── Grossesses ──
    builder
      .addCase(fetchGrossesses.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchGrossesses.fulfilled, (state, action) => {
        state.loading = false;
        state.grossesses = action.payload.grossesses;
        state.grossesseTotal = action.payload.total;
        state.grossessePage = action.payload.page;
      })
      .addCase(fetchGrossesses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchGrossesseById.fulfilled, (state, action) => {
        state.currentGrossesse = action.payload.grossesse;
      })
      .addCase(createGrossesse.pending, (state) => { state.saving = true; })
      .addCase(createGrossesse.fulfilled, (state, action) => {
        state.saving = false;
        state.grossesses.unshift(action.payload);
        state.grossesseTotal += 1;
        if (state.stats) state.stats.totalGrossesses += 1;
      })
      .addCase(createGrossesse.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateGrossesse.pending, (state) => { state.saving = true; })
      .addCase(updateGrossesse.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.grossesses.findIndex(g => g._id === action.payload._id);
        if (idx !== -1) state.grossesses[idx] = action.payload;
        if (state.currentGrossesse?._id === action.payload._id) state.currentGrossesse = action.payload;
      })
      .addCase(updateGrossesse.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });

    // ── CPN ──
    builder
      .addCase(addCPN.pending, (state) => { state.saving = true; })
      .addCase(addCPN.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.grossesses.findIndex(g => g._id === action.payload._id);
        if (idx !== -1) state.grossesses[idx] = action.payload;
        if (state.currentGrossesse?._id === action.payload._id) state.currentGrossesse = action.payload;
      })
      .addCase(addCPN.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });

    // ── Echo ──
    builder
      .addCase(addEcho.pending, (state) => { state.saving = true; })
      .addCase(addEcho.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.grossesses.findIndex(g => g._id === action.payload._id);
        if (idx !== -1) state.grossesses[idx] = action.payload;
        if (state.currentGrossesse?._id === action.payload._id) state.currentGrossesse = action.payload;
      })
      .addCase(addEcho.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });

    // ── Travail ──
    builder
      .addCase(updateTravail.fulfilled, (state, action) => {
        const idx = state.grossesses.findIndex(g => g._id === action.payload._id);
        if (idx !== -1) state.grossesses[idx] = action.payload;
        if (state.currentGrossesse?._id === action.payload._id) state.currentGrossesse = action.payload;
      });

    // ── Postnatal ──
    builder
      .addCase(addPostnatal.fulfilled, (state, action) => {
        const idx = state.grossesses.findIndex(g => g._id === action.payload._id);
        if (idx !== -1) state.grossesses[idx] = action.payload;
        if (state.currentGrossesse?._id === action.payload._id) state.currentGrossesse = action.payload;
      });

    // ── Accouchements ──
    builder
      .addCase(fetchAccouchements.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAccouchements.fulfilled, (state, action) => {
        state.loading = false;
        state.accouchements = action.payload.accouchements;
        state.accouchementTotal = action.payload.total;
      })
      .addCase(fetchAccouchements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createAccouchement.pending, (state) => { state.saving = true; })
      .addCase(createAccouchement.fulfilled, (state, action) => {
        state.saving = false;
        state.accouchements.unshift(action.payload);
        state.accouchementTotal += 1;
        if (state.stats) state.stats.accouchementsAujourdhui += 1;
        // Mettre à jour la grossesse dans la liste si elle y est
        const g = state.grossesses.find(x => x._id === action.payload.grossesse_id);
        if (g) g.statut = 'accouchee';
      })
      .addCase(createAccouchement.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });

    // ── Nouveau-nés ──
    builder
      .addCase(fetchNouveauxNes.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchNouveauxNes.fulfilled, (state, action) => {
        state.loading = false;
        state.nouveauNes = action.payload.nouveauNes;
        state.nouveauNeTotal = action.payload.total;
      })
      .addCase(fetchNouveauxNes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createNouveauNe.pending, (state) => { state.saving = true; })
      .addCase(createNouveauNe.fulfilled, (state, action) => {
        state.saving = false;
        state.nouveauNes.unshift(action.payload);
        state.nouveauNeTotal += 1;
        if (state.stats) state.stats.nouveaunes += 1;
      })
      .addCase(createNouveauNe.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateNouveauNe.fulfilled, (state, action) => {
        const idx = state.nouveauNes.findIndex(n => n._id === action.payload._id);
        if (idx !== -1) state.nouveauNes[idx] = action.payload;
      });
  },
});

export const { setFilters, setGrossessePage, setCurrentGrossesse, clearError } = materniteSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectMaterniteStats       = (state) => state.maternite.stats;
export const selectMaterniteChart       = (state) => state.maternite.chart;
export const selectGrossesses           = (state) => state.maternite.grossesses;
export const selectGrossesseTotal       = (state) => state.maternite.grossesseTotal;
export const selectGrossessePage        = (state) => state.maternite.grossessePage;
export const selectCurrentGrossesse     = (state) => state.maternite.currentGrossesse;
export const selectAccouchements        = (state) => state.maternite.accouchements;
export const selectAccouchementTotal    = (state) => state.maternite.accouchementTotal;
export const selectNouveauNes           = (state) => state.maternite.nouveauNes;
export const selectNouveauNeTotal       = (state) => state.maternite.nouveauNeTotal;
export const selectMaterniteLoading     = (state) => state.maternite.loading;
export const selectMaterniteSaving      = (state) => state.maternite.saving;
export const selectMaterniteError       = (state) => state.maternite.error;
export const selectMaterniteFilters     = (state) => state.maternite.filters;

export default materniteSlice.reducer;
