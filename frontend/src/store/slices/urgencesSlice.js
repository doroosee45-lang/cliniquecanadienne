import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchUrgencesStats = createAsyncThunk(
  'urgences/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/urgences/stats');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur statistiques');
    }
  }
);

export const fetchUrgences = createAsyncThunk(
  'urgences/fetchAll',
  async ({ page = 1, limit = 20, q = '', niveau_triage = '', statut = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (q)             params.set('q', q);
      if (niveau_triage) params.set('niveau_triage', niveau_triage);
      if (statut)        params.set('statut', statut);
      const { data } = await api.get(`/urgences?${params}`);
      return { urgences: data.urgences, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement urgences');
    }
  }
);

export const createUrgence = createAsyncThunk(
  'urgences/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/urgences', body);
      return data.urgence;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création urgence');
    }
  }
);

export const updateUrgence = createAsyncThunk(
  'urgences/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/urgences/${id}`, body);
      return data.urgence;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour');
    }
  }
);

export const fetchDossierData = createAsyncThunk(
  'urgences/fetchDossier',
  async (id, { rejectWithValue }) => {
    try {
      const [s, pr, ex, tl] = await Promise.allSettled([
        api.get(`/urgences/${id}/soins`),
        api.get(`/urgences/${id}/prescriptions`),
        api.get(`/urgences/${id}/examens`),
        api.get(`/urgences/${id}/timeline`),
      ]);
      return {
        soins:         s.status  === 'fulfilled' ? (s.value.data.soins   || []) : [],
        prescriptions: pr.status === 'fulfilled' ? (pr.value.data.prescriptions || []) : [],
        examens:       ex.status === 'fulfilled' ? (ex.value.data.examens || []) : [],
        timeline:      tl.status === 'fulfilled' ? (tl.value.data.timeline || []) : [],
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement dossier');
    }
  }
);

export const addSoin = createAsyncThunk(
  'urgences/addSoin',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/urgences/${id}/soins`, body);
      return data.soin;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement soin');
    }
  }
);

export const addPrescription = createAsyncThunk(
  'urgences/addPrescription',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/urgences/${id}/prescriptions`, body);
      return data.prescription;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur prescription');
    }
  }
);

export const addExamen = createAsyncThunk(
  'urgences/addExamen',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/urgences/${id}/examens`, body);
      return data.examen;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur examen');
    }
  }
);

export const fetchAmbulances = createAsyncThunk(
  'urgences/fetchAmbulances',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/ambulances');
      return data.ambulances;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur ambulances');
    }
  }
);

export const assignMission = createAsyncThunk(
  'urgences/assignMission',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/ambulances/missions', body);
      return data.ambulance;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mission');
    }
  }
);

export const retourAmbulance = createAsyncThunk(
  'urgences/retourAmbulance',
  async (numero, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/ambulances/${numero}/retour`);
      return data.ambulance;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur retour ambulance');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const urgencesSlice = createSlice({
  name: 'urgences',
  initialState: {
    kpis:       { actives:0, attente:0, consultation:0, observation:0, critique:0, admissions_jour:0, sorties_jour:0, temps_attente_moy:0 },
    triageMap:  {},
    chart:      { labels:[], data:[] },

    urgences:   [],
    total:      0,
    page:       1,

    currentUrg: null,
    soins:         [],
    prescriptions: [],
    examens:       [],
    timeline:      [],

    ambulances:  [],

    filters: { q:'', niveau_triage:'', statut:'' },

    loading:      false,
    loadingDossier: false,
    saving:       false,
    error:        null,
  },

  reducers: {
    setCurrentUrg(state, action)  { state.currentUrg  = action.payload; },
    clearCurrentUrg(state)        { state.currentUrg  = null; state.soins = []; state.prescriptions = []; state.examens = []; state.timeline = []; },
    patchCurrentUrg(state, action){ state.currentUrg  = state.currentUrg ? { ...state.currentUrg, ...action.payload } : action.payload; },
    setFilters(state, action)     { state.filters     = { ...state.filters, ...action.payload }; state.page = 1; },
    setPage(state, action)        { state.page        = action.payload; },
    clearError(state)             { state.error       = null; },
    // mise à jour locale résultat examen
    setExamenResultat(state, action) {
      const { examenId, resultat } = action.payload;
      const idx = state.examens.findIndex(e => (e._id || e.id) === examenId);
      if (idx !== -1) { state.examens[idx].resultat = resultat; state.examens[idx].statut = 'resultat'; }
    },
  },

  extraReducers: (builder) => {
    // Stats
    builder
      .addCase(fetchUrgencesStats.fulfilled, (state, action) => {
        state.kpis      = action.payload.kpis      || state.kpis;
        state.triageMap = action.payload.triageMap || {};
        state.chart     = action.payload.chart     || state.chart;
      });

    // Urgences list
    builder
      .addCase(fetchUrgences.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUrgences.fulfilled, (state, action) => {
        state.loading  = false;
        state.urgences = action.payload.urgences;
        state.total    = action.payload.total;
        state.page     = action.payload.page;
      })
      .addCase(fetchUrgences.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // Create
    builder
      .addCase(createUrgence.pending,   (state) => { state.saving = true; })
      .addCase(createUrgence.fulfilled, (state, action) => {
        state.saving = false;
        state.urgences.unshift(action.payload);
        state.total += 1;
        if (action.payload.statut === 'attente') state.kpis.attente += 1;
        if (action.payload.niveau_triage === 'rouge') state.kpis.critique += 1;
        state.kpis.admissions_jour += 1;
        state.kpis.actives += 1;
      })
      .addCase(createUrgence.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Update
    builder
      .addCase(updateUrgence.pending,   (state) => { state.saving = true; })
      .addCase(updateUrgence.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.urgences.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) state.urgences[idx] = action.payload;
        if (state.currentUrg?._id === action.payload._id) state.currentUrg = action.payload;
      })
      .addCase(updateUrgence.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Dossier data
    builder
      .addCase(fetchDossierData.pending,   (state) => { state.loadingDossier = true; })
      .addCase(fetchDossierData.fulfilled, (state, action) => {
        state.loadingDossier  = false;
        state.soins           = action.payload.soins;
        state.prescriptions   = action.payload.prescriptions;
        state.examens         = action.payload.examens;
        state.timeline        = action.payload.timeline;
      })
      .addCase(fetchDossierData.rejected,  (state) => { state.loadingDossier = false; });

    // Soin
    builder
      .addCase(addSoin.pending,   (state) => { state.saving = true; })
      .addCase(addSoin.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) state.soins.unshift(action.payload);
      })
      .addCase(addSoin.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Prescription
    builder
      .addCase(addPrescription.pending,   (state) => { state.saving = true; })
      .addCase(addPrescription.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) state.prescriptions.push(action.payload);
      })
      .addCase(addPrescription.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Examen
    builder
      .addCase(addExamen.pending,   (state) => { state.saving = true; })
      .addCase(addExamen.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) state.examens.push(action.payload);
      })
      .addCase(addExamen.rejected,  (state, action) => { state.saving = false; state.error = action.payload; });

    // Ambulances
    builder
      .addCase(fetchAmbulances.fulfilled, (state, action) => { state.ambulances = action.payload; })
      .addCase(assignMission.fulfilled,   (state, action) => {
        const idx = state.ambulances.findIndex(a => a.numero === action.payload.numero);
        if (idx !== -1) state.ambulances[idx] = action.payload;
        else state.ambulances.push(action.payload);
      })
      .addCase(retourAmbulance.fulfilled, (state, action) => {
        const idx = state.ambulances.findIndex(a => a.numero === action.payload.numero);
        if (idx !== -1) state.ambulances[idx] = action.payload;
      });
  },
});

export const { setCurrentUrg, clearCurrentUrg, patchCurrentUrg, setFilters, setPage, clearError, setExamenResultat } = urgencesSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectUrgencesKpis        = (state) => state.urgences.kpis;
export const selectUrgencesTriageMap   = (state) => state.urgences.triageMap;
export const selectUrgencesChart       = (state) => state.urgences.chart;
export const selectUrgencesList        = (state) => state.urgences.urgences;
export const selectUrgencesTotal       = (state) => state.urgences.total;
export const selectUrgencesPage        = (state) => state.urgences.page;
export const selectCurrentUrg          = (state) => state.urgences.currentUrg;
export const selectSoins               = (state) => state.urgences.soins;
export const selectPrescriptions       = (state) => state.urgences.prescriptions;
export const selectExamens             = (state) => state.urgences.examens;
export const selectTimeline            = (state) => state.urgences.timeline;
export const selectAmbulances          = (state) => state.urgences.ambulances;
export const selectUrgencesFilters     = (state) => state.urgences.filters;
export const selectUrgencesLoading     = (state) => state.urgences.loading;
export const selectUrgencesSaving      = (state) => state.urgences.saving;
export const selectUrgencesLoadingDossier = (state) => state.urgences.loadingDossier;

export default urgencesSlice.reducer;
