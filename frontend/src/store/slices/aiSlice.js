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
      diagnostics: 0,
      precision: 0,
      interactions: 0,
      alertes_risque: 0,
    },
    filters: { type: '', patient: '' },
  },
  reducers: {
    setSuggestions(state, action) { state.suggestions = action.payload; },
    setWarnings(state, action) { state.warnings = action.payload; },
    toggleIA(state) { state.iaEnabled = !state.iaEnabled; },
    clearAnalysis(state) { state.currentAnalysis = null; state.suggestions = []; state.warnings = []; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
    clearError(state) { state.error = null; },
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
      });
  },
});

export const { setSuggestions, setWarnings, toggleIA, clearAnalysis, setFilters, clearError } = aiSlice.actions;

export const selectAIPredictions = (state) => state.ai.predictions;
export const selectAISuggestions = (state) => state.ai.suggestions;
export const selectAIWarnings = (state) => state.ai.warnings;
export const selectCurrentAnalysis = (state) => state.ai.currentAnalysis;
export const selectAILoading = (state) => state.ai.loading;
export const selectAIAnalyzing = (state) => state.ai.analyzing;
export const selectAIEnabled = (state) => state.ai.iaEnabled;
export const selectAIStats = (state) => state.ai.stats;

export default aiSlice.reducer;
