import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchAnalyticsReport = createAsyncThunk(
  'analytics/fetchReport',
  async ({ type = 'global', period = '30d', departement = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ type, period });
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
  async ({ period = '30d' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/analytics/financial?period=${period}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur rapport financier');
    }
  }
);

export const fetchPatientStats = createAsyncThunk(
  'analytics/fetchPatientStats',
  async ({ period = '30d' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/analytics/patients?period=${period}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur statistiques patients');
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
    loading: false,
    error: null,
    filters: { type: 'global', period: '30d', departement: '' },
  },
  reducers: {
    setSelectedReport(state, action) { state.selectedReport = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsReport.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAnalyticsReport.fulfilled, (state, action) => {
        state.loading = false;
        state.chartData = action.payload;
        if (action.payload.charts) state.chartData = action.payload.charts;
      })
      .addCase(fetchAnalyticsReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchFinancialReport.fulfilled, (state, action) => {
        state.financialData = action.payload;
      })
      .addCase(fetchPatientStats.fulfilled, (state, action) => {
        state.patientStats = action.payload;
      });
  },
});

export const { setSelectedReport, setFilters, clearError } = analyticsSlice.actions;

export const selectAnalyticsChartData = (state) => state.analytics.chartData;
export const selectFinancialData = (state) => state.analytics.financialData;
export const selectPatientStats = (state) => state.analytics.patientStats;
export const selectAnalyticsLoading = (state) => state.analytics.loading;
export const selectAnalyticsFilters = (state) => state.analytics.filters;

export default analyticsSlice.reducer;
