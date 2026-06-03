import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchData',
  async (role, { rejectWithValue }) => {
    try {
      const endpoint = role === 'superadmin' ? '/dashboard/superadmin' : `/dashboard/${role}`;
      const { data } = await api.get(endpoint);
      return data.stats ?? data ?? {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    data: null,
    loading: false,
    error: null,
    lastUpdate: null,
    kpis: {},
    charts: { labels: [], ca: [], dep: [] },
    alerts: [],
    systemStatus: {
      db: 'ok',
      backup: 'ok',
      disk: 0,
      server_cpu: 0,
      server_ram: 0,
      services_actifs: 0,
    },
    staffPresence: {
      present: 0,
      absent: 0,
      conges: 0,
    },
  },
  reducers: {
    setKPIs(state, action) { state.kpis = { ...state.kpis, ...action.payload }; },
    setAlerts(state, action) { state.alerts = action.payload; },
    setSystemStatus(state, action) { state.systemStatus = { ...state.systemStatus, ...action.payload }; },
    setStaffPresence(state, action) { state.staffPresence = { ...state.staffPresence, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastUpdate = new Date().toISOString();
        const d = action.payload;
        if (d?.kpis) state.kpis = d.kpis;
        if (d?.alertes || d?.alertes_crit) state.alerts = d.alertes || d.alertes_crit || [];
        if (d?.sys_status) state.systemStatus = { ...state.systemStatus, ...d.sys_status };
        if (d?.personnel) {
          state.staffPresence = {
            present: (d.personnel.medecins_presents || 0) + (d.personnel.infirmiers_presents || 0),
            absent: d.personnel.absents || 0,
            conges: d.personnel.conges || 0,
          };
        }
        if (d?.chart_mois) state.charts = d.chart_mois;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setKPIs, setAlerts, setSystemStatus, setStaffPresence, clearError } = dashboardSlice.actions;

export const selectDashboardData = (state) => state.dashboard.data;
export const selectDashboardLoading = (state) => state.dashboard.loading;
export const selectDashboardError = (state) => state.dashboard.error;
export const selectDashboardKPIs = (state) => state.dashboard.kpis;
export const selectDashboardAlerts = (state) => state.dashboard.alerts;
export const selectSystemStatus = (state) => state.dashboard.systemStatus;
export const selectStaffPresence = (state) => state.dashboard.staffPresence;
export const selectDashboardLastUpdate = (state) => state.dashboard.lastUpdate;

export default dashboardSlice.reducer;
