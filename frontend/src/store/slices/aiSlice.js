import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchAIPredictions = createAsyncThunk(
  'ai/fetchPredictions',
  async ({ page = 1, limit = 20, type = '', patient = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (type) params.set('type', type);
      if (patient) params.set('patient', patient);
      const { data } = await api.get(`/ai/predictions?${params}`);
      return { predictions: data.predictions || [], total: data.total || 0 };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement prédictions IA');
    }
  }
);

export const runDiagnosis = createAsyncThunk(
  'ai/runDiagnosis',
  async ({ patientId, symptoms, vitals }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/ai/diagnose', { patientId, symptoms, vitals });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur analyse IA');
    }
  }
);

export const checkDrugInteractions = createAsyncThunk(
  'ai/checkInteractions',
  async (medications, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/ai/interactions', { medications });
      return data.warnings || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur vérification interactions');
    }
  }
);

export const fetchAIStats = createAsyncThunk(
  'ai/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/ai/stats');
      return data.stats || {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur stats IA');
    }
  }
);

export const fetchPatientSummary = createAsyncThunk(
  'ai/fetchPatientSummary',
  async (patientId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/ai/patient-summary/${patientId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur résumé patient IA');
    }
  }
);

export const fetchLabInsights = createAsyncThunk(
  'ai/fetchLabInsights',
  async (patientId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/ai/lab-insights/${patientId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur analyse laboratoire IA');
    }
  }
);

export const fetchImagingInsights = createAsyncThunk(
  'ai/fetchImagingInsights',
  async (patientId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/ai/imaging-insights/${patientId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur analyse imagerie IA');
    }
  }
);

const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    predictions: [],
    suggestions: [],
    warnings: [],
    currentAnalysis: null,
    total: 0,
    loading: false,
    analyzing: false,
    error: null,
    iaEnabled: true,
    stats: {
      analyses_mois:    0,
      diagnostics:      0,
      // AI-01 — renommé depuis "precision" : c'est un taux de traitement
      // des alertes (statut 'traite' / total), jamais une précision de
      // modèle IA (aucune vérité terrain n'existe dans ce système).
      taux_traitement:  0,
      interactions:     0,
      alertes_risque:   0,
      labo_critiques:   0,
      labo_anomalies_ia: 0,
      imagerie_urgentes: 0,
      patients_analyses: 0,
      // POST5-011 (audit indépendant post-Phase 5, 14 sept. 2026) — agrégation
      // réelle (ai.controller.js::getStats), plus jamais un tableau codé en
      // dur ([12,18,9,24,16,7,4]) côté composant.
      activite_7j: { labels: [], data: [] },
    },
    filters: { type: '', patient: '' },
    patientSummary: null,
    patientSummaryLoading: false,
    patientSummaryError: null,
    labInsights: null,
    labInsightsLoading: false,
    labInsightsError: null,
    imagingInsights: null,
    imagingInsightsLoading: false,
    imagingInsightsError: null,
  },
  reducers: {
    setSuggestions(state, action) { state.suggestions = action.payload; },
    setWarnings(state, action) { state.warnings = action.payload; },
    toggleIA(state) { state.iaEnabled = !state.iaEnabled; },
    clearAnalysis(state) { state.currentAnalysis = null; state.suggestions = []; state.warnings = []; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
    clearError(state) { state.error = null; },
    clearPatientSummary(state) { state.patientSummary = null; state.patientSummaryError = null; },
    clearLabInsights(state) { state.labInsights = null; state.labInsightsError = null; },
    clearImagingInsights(state) { state.imagingInsights = null; state.imagingInsightsError = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAIPredictions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAIPredictions.fulfilled, (state, action) => {
        state.loading = false;
        state.predictions = action.payload.predictions;
        state.total = action.payload.total;
      })
      .addCase(fetchAIPredictions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(runDiagnosis.pending, (state) => { state.analyzing = true; state.error = null; })
      .addCase(runDiagnosis.fulfilled, (state, action) => {
        state.analyzing = false;
        state.currentAnalysis = action.payload;
        state.suggestions = action.payload.suggestions || [];
      })
      .addCase(runDiagnosis.rejected, (state, action) => {
        state.analyzing = false;
        state.error = action.payload;
      })
      .addCase(checkDrugInteractions.fulfilled, (state, action) => {
        state.warnings = action.payload;
      })
      .addCase(fetchAIStats.fulfilled, (state, action) => {
        state.stats = { ...state.stats, ...action.payload };
      })
      .addCase(fetchPatientSummary.pending, (state) => { state.patientSummaryLoading = true; state.patientSummaryError = null; })
      .addCase(fetchPatientSummary.fulfilled, (state, action) => {
        state.patientSummaryLoading = false;
        state.patientSummary = action.payload;
      })
      .addCase(fetchPatientSummary.rejected, (state, action) => {
        state.patientSummaryLoading = false;
        state.patientSummaryError = action.payload;
      })
      .addCase(fetchLabInsights.pending, (state) => { state.labInsightsLoading = true; state.labInsightsError = null; })
      .addCase(fetchLabInsights.fulfilled, (state, action) => {
        state.labInsightsLoading = false;
        state.labInsights = action.payload;
      })
      .addCase(fetchLabInsights.rejected, (state, action) => {
        state.labInsightsLoading = false;
        state.labInsightsError = action.payload;
      })
      .addCase(fetchImagingInsights.pending, (state) => { state.imagingInsightsLoading = true; state.imagingInsightsError = null; })
      .addCase(fetchImagingInsights.fulfilled, (state, action) => {
        state.imagingInsightsLoading = false;
        state.imagingInsights = action.payload;
      })
      .addCase(fetchImagingInsights.rejected, (state, action) => {
        state.imagingInsightsLoading = false;
        state.imagingInsightsError = action.payload;
      });
  },
});

export const { setSuggestions, setWarnings, toggleIA, clearAnalysis, setFilters, clearError, clearPatientSummary, clearLabInsights, clearImagingInsights } = aiSlice.actions;

export const selectAIPredictions = (state) => state.ai.predictions;
export const selectAISuggestions = (state) => state.ai.suggestions;
export const selectAIWarnings = (state) => state.ai.warnings;
export const selectCurrentAnalysis = (state) => state.ai.currentAnalysis;
export const selectAILoading = (state) => state.ai.loading;
export const selectAIAnalyzing = (state) => state.ai.analyzing;
export const selectAIEnabled = (state) => state.ai.iaEnabled;
export const selectAIStats = (state) => state.ai.stats;
export const selectPatientSummary = (state) => state.ai.patientSummary;
export const selectPatientSummaryLoading = (state) => state.ai.patientSummaryLoading;
export const selectPatientSummaryError = (state) => state.ai.patientSummaryError;
export const selectLabInsights = (state) => state.ai.labInsights;
export const selectLabInsightsLoading = (state) => state.ai.labInsightsLoading;
export const selectLabInsightsError = (state) => state.ai.labInsightsError;
export const selectImagingInsights = (state) => state.ai.imagingInsights;
export const selectImagingInsightsLoading = (state) => state.ai.imagingInsightsLoading;
export const selectImagingInsightsError = (state) => state.ai.imagingInsightsError;

export default aiSlice.reducer;
