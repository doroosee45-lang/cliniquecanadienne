import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchAnalyticsReport = createAsyncThunk(
  'analytics/fetchReport',
  async ({ type = 'global', periode = 'mois', departement = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ type, periode });
      if (departement) params.set('departement', departement);
      const { data } = await api.get(`/analytics?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement analytics');
    }
  }
);

export const fetchFinancialReport = createAsyncThunk(
  'analytics/fetchFinancial',
  async ({ periode = 'mois' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/analytics/financial?periode=${periode}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur rapport financier');
    }
  }
);

export const fetchPatientStats = createAsyncThunk(
  'analytics/fetchPatientStats',
  async ({ periode = 'mois' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/analytics/patients?periode=${periode}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur statistiques patients');
    }
  }
);

// AUDIT-ANALYTICS-P1 — date_debut/date_fin transmis seulement quand
// periode==='custom' : c'est la seule route (getStats) à les interpréter
// réellement aujourd'hui (getReport/getFinancial/getPatientStats restent
// figées sur l'année civile en cours, limitation préexistante hors périmètre).
export const fetchKpis = createAsyncThunk(
  'analytics/fetchKpis',
  async ({ periode = 'mois', dateDebut = '', dateFin = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ periode });
      if (periode === 'custom') {
        if (dateDebut) params.set('date_debut', dateDebut);
        if (dateFin) params.set('date_fin', dateFin);
      }
      const { data } = await api.get(`/analytics/stats?${params}`);
      return data.kpi || {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur KPIs');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    reports: [],
    selectedReport: null,
    chartData: {},
    financialData: null,
    patientStats: null,
    kpi: {},
    loading: false,
    kpiLoading: false,
    error: null,
    filters: { type: 'global', periode: 'mois', departement: '' },
  },
  reducers: {
    setSelectedReport(state, action) { state.selectedReport = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsReport.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAnalyticsReport.fulfilled,  (state, action) => {
        state.loading = false;
        state.chartData = action.payload.charts || action.payload;
      })
      .addCase(fetchAnalyticsReport.rejected,   (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchFinancialReport.fulfilled,  (state, action) => { state.financialData = action.payload; })
      .addCase(fetchPatientStats.fulfilled,     (state, action) => { state.patientStats = action.payload; })
      .addCase(fetchKpis.pending,   (state) => { state.kpiLoading = true; })
      .addCase(fetchKpis.fulfilled, (state, action) => { state.kpiLoading = false; state.kpi = action.payload; })
      .addCase(fetchKpis.rejected,  (state) => { state.kpiLoading = false; });
  },
});

export const { setSelectedReport, setFilters, clearError } = analyticsSlice.actions;

export const selectAnalyticsChartData  = (state) => state.analytics.chartData;
export const selectFinancialData       = (state) => state.analytics.financialData;
export const selectPatientStats        = (state) => state.analytics.patientStats;
export const selectAnalyticsKpi        = (state) => state.analytics.kpi;
export const selectAnalyticsLoading    = (state) => state.analytics.loading;
export const selectAnalyticsKpiLoading = (state) => state.analytics.kpiLoading;
export const selectAnalyticsFilters    = (state) => state.analytics.filters;

export default analyticsSlice.reducer;
