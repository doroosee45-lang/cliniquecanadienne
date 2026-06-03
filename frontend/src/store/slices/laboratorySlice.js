import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchLabResults = createAsyncThunk(
  'laboratory/fetchAll',
  async ({ page = 1, limit = 20, statut = '', patient = '', priority = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (patient) params.set('patient', patient);
      if (priority) params.set('priority', priority);
      const { data } = await api.get(`/laboratory?${params}`);
      return { results: data.results, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement analyses');
    }
  }
);

export const fetchCriticalResults = createAsyncThunk(
  'laboratory/fetchCritical',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/laboratory?statut=critique&limit=50');
      return data.results || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur résultats critiques');
    }
  }
);

export const createLabResult = createAsyncThunk(
  'laboratory/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/laboratory', body);
      return data.result;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création analyse');
    }
  }
);

export const updateLabResult = createAsyncThunk(
  'laboratory/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/laboratory/${id}`, body);
      return data.result;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour analyse');
    }
  }
);

export const validateLabResult = createAsyncThunk(
  'laboratory/validate',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/laboratory/${id}`, { statut: 'valide' });
      return data.result;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur validation');
    }
  }
);

const laboratorySlice = createSlice({
  name: 'laboratory',
  initialState: {
    list: [],
    criticalResults: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    stats: { total: 0, pending: 0, completed: 0, critical: 0 },
    filters: { statut: '', patient: '', priority: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setStats(state, action) { state.stats = { ...state.stats, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLabResults.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchLabResults.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.results;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchLabResults.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchCriticalResults.fulfilled, (state, action) => {
        state.criticalResults = action.payload;
        state.stats.critical = action.payload.length;
      })
      .addCase(createLabResult.pending, (state) => { state.saving = true; })
      .addCase(createLabResult.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createLabResult.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateLabResult.pending, (state) => { state.saving = true; })
      .addCase(updateLabResult.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(r => r._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateLabResult.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(validateLabResult.fulfilled, (state, action) => {
        const idx = state.list.findIndex(r => r._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setStats, clearError } = laboratorySlice.actions;

export const selectLabResults = (state) => state.laboratory.list;
export const selectCriticalLabResults = (state) => state.laboratory.criticalResults;
export const selectCurrentLabResult = (state) => state.laboratory.current;
export const selectLabTotal = (state) => state.laboratory.total;
export const selectLabLoading = (state) => state.laboratory.loading;
export const selectLabSaving = (state) => state.laboratory.saving;
export const selectLabStats = (state) => state.laboratory.stats;
export const selectLabFilters = (state) => state.laboratory.filters;

export default laboratorySlice.reducer;
