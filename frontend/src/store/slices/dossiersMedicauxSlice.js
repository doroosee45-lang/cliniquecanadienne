import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const searchMedicalRecords = createAsyncThunk(
  'dossiersMedicaux/search',
  async ({ q = '', types = [], dateFrom = '', dateTo = '', praticien = '', statut = 'tous', page = 1, limit = 25 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit, statut });
      if (q)         params.set('q', q);
      if (dateFrom)  params.set('dateFrom', dateFrom);
      if (dateTo)    params.set('dateTo', dateTo);
      if (praticien) params.set('praticien', praticien);
      types.forEach((t) => params.append('types', t));
      const { data } = await api.get(`/medical-records/search?${params}`);
      return { results: data.results, total: data.total, page: data.page, limit: data.limit };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur lors de la recherche de dossiers médicaux');
    }
  }
);

const dossiersMedicauxSlice = createSlice({
  name: 'dossiersMedicaux',
  initialState: {
    list: [],
    total: 0,
    page: 1,
    limit: 25,
    loading: false,
    error: null,
    filters: { q: '', types: [], dateFrom: '', dateTo: '', praticien: '', statut: 'tous' },
  },
  reducers: {
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setPage(state, action) { state.page = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchMedicalRecords.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(searchMedicalRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.results;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
      })
      .addCase(searchMedicalRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setFilters, setPage, clearError } = dossiersMedicauxSlice.actions;

export const selectMedicalRecords        = (state) => state.dossiersMedicaux.list;
export const selectMedicalRecordsTotal   = (state) => state.dossiersMedicaux.total;
export const selectMedicalRecordsPage    = (state) => state.dossiersMedicaux.page;
export const selectMedicalRecordsLimit   = (state) => state.dossiersMedicaux.limit;
export const selectMedicalRecordsLoading = (state) => state.dossiersMedicaux.loading;
export const selectMedicalRecordsError   = (state) => state.dossiersMedicaux.error;
export const selectMedicalRecordsFilters = (state) => state.dossiersMedicaux.filters;

export default dossiersMedicauxSlice.reducer;
