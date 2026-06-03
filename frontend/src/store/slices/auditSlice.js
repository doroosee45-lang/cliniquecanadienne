import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchAuditLogs = createAsyncThunk(
  'audit/fetchAll',
  async ({ page = 1, limit = 30, user = '', action = '', resource = '', dateFrom = '', dateTo = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (user) params.set('user', user);
      if (action) params.set('action', action);
      if (resource) params.set('resource', resource);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const { data } = await api.get(`/audit?${params}`);
      return { logs: data.logs, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement logs audit');
    }
  }
);

const auditSlice = createSlice({
  name: 'audit',
  initialState: {
    logs: [],
    total: 0,
    page: 1,
    loading: false,
    error: null,
    filters: { user: '', action: '', resource: '', dateFrom: '', dateTo: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.logs;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setPage, setFilters, clearError } = auditSlice.actions;

export const selectAuditLogs = (state) => state.audit.logs;
export const selectAuditTotal = (state) => state.audit.total;
export const selectAuditLoading = (state) => state.audit.loading;
export const selectAuditPage = (state) => state.audit.page;
export const selectAuditFilters = (state) => state.audit.filters;

export default auditSlice.reducer;
