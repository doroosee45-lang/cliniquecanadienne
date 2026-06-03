import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchRadiologyExams = createAsyncThunk(
  'radiology/fetchAll',
  async ({ page = 1, limit = 20, statut = '', patient = '', type = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (patient) params.set('patient', patient);
      if (type) params.set('type', type);
      const { data } = await api.get(`/radiology?${params}`);
      return { exams: data.exams, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement examens imagerie');
    }
  }
);

export const createRadiologyExam = createAsyncThunk(
  'radiology/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/radiology', body);
      return data.exam;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création examen');
    }
  }
);

export const updateRadiologyExam = createAsyncThunk(
  'radiology/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/radiology/${id}`, body);
      return data.exam;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour examen');
    }
  }
);

export const validateRadiologyReport = createAsyncThunk(
  'radiology/validate',
  async ({ id, compte_rendu }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/radiology/${id}`, { statut: 'valide', compte_rendu });
      return data.exam;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur validation rapport');
    }
  }
);

const radiologySlice = createSlice({
  name: 'radiology',
  initialState: {
    list: [],
    current: null,
    aiAnomalies: [],
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    stats: { total: 0, pending: 0, completed: 0, anomalies: 0 },
    filters: { statut: '', patient: '', type: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setAIAnomalies(state, action) { state.aiAnomalies = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRadiologyExams.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchRadiologyExams.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.exams;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchRadiologyExams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createRadiologyExam.pending, (state) => { state.saving = true; })
      .addCase(createRadiologyExam.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createRadiologyExam.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateRadiologyExam.pending, (state) => { state.saving = true; })
      .addCase(updateRadiologyExam.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateRadiologyExam.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(validateRadiologyReport.fulfilled, (state, action) => {
        const idx = state.list.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setAIAnomalies, clearError } = radiologySlice.actions;

export const selectRadiologyExams = (state) => state.radiology.list;
export const selectCurrentExam = (state) => state.radiology.current;
export const selectAIAnomalies = (state) => state.radiology.aiAnomalies;
export const selectRadiologyTotal = (state) => state.radiology.total;
export const selectRadiologyLoading = (state) => state.radiology.loading;
export const selectRadiologySaving = (state) => state.radiology.saving;
export const selectRadiologyStats = (state) => state.radiology.stats;

export default radiologySlice.reducer;
