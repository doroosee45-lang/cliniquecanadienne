import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchPrescriptions = createAsyncThunk(
  'prescriptions/fetchAll',
  async ({ page = 1, limit = 20, patient = '', medecin = '', statut = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (patient) params.set('patient', patient);
      if (medecin) params.set('medecin', medecin);
      if (statut) params.set('statut', statut);
      const { data } = await api.get(`/prescriptions?${params}`);
      return { prescriptions: data.prescriptions, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement ordonnances');
    }
  }
);

export const createPrescription = createAsyncThunk(
  'prescriptions/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/prescriptions', body);
      return data.prescription;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création ordonnance');
    }
  }
);

export const updatePrescription = createAsyncThunk(
  'prescriptions/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/prescriptions/${id}`, body);
      return data.prescription;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour ordonnance');
    }
  }
);

export const dispensePrescription = createAsyncThunk(
  'prescriptions/dispense',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/prescriptions/${id}`, { statut: 'dispensee' });
      return data.prescription;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur dispensation');
    }
  }
);

const prescriptionsSlice = createSlice({
  name: 'prescriptions',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    filters: { patient: '', medecin: '', statut: '' },
    medications: [],
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setMedications(state, action) { state.medications = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPrescriptions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPrescriptions.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.prescriptions;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchPrescriptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createPrescription.pending, (state) => { state.saving = true; })
      .addCase(createPrescription.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createPrescription.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updatePrescription.pending, (state) => { state.saving = true; })
      .addCase(updatePrescription.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updatePrescription.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(dispensePrescription.fulfilled, (state, action) => {
        const idx = state.list.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setMedications, clearError } = prescriptionsSlice.actions;

export const selectPrescriptions = (state) => state.prescriptions.list;
export const selectCurrentPrescription = (state) => state.prescriptions.current;
export const selectPrescriptionsTotal = (state) => state.prescriptions.total;
export const selectPrescriptionsLoading = (state) => state.prescriptions.loading;
export const selectPrescriptionsSaving = (state) => state.prescriptions.saving;
export const selectPrescriptionsFilters = (state) => state.prescriptions.filters;

export default prescriptionsSlice.reducer;
