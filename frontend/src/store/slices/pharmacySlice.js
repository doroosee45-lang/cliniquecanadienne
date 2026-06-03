import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchMedications = createAsyncThunk(
  'pharmacy/fetchAll',
  async ({ page = 1, limit = 20, search = '', categorie = '', alert = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('q', search);
      if (categorie) params.set('categorie', categorie);
      if (alert) params.set('alert', alert);
      const { data } = await api.get(`/pharmacy?${params}`);
      return { medications: data.medications, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement médicaments');
    }
  }
);

export const fetchInventory = createAsyncThunk(
  'pharmacy/fetchInventory',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/pharmacy/inventory');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur inventaire');
    }
  }
);

export const fetchStockAlerts = createAsyncThunk(
  'pharmacy/fetchAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/pharmacy?alert=rupture&limit=100');
      return { rupture: data.medications || [] };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur alertes stock');
    }
  }
);

export const createMedication = createAsyncThunk(
  'pharmacy/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/pharmacy', body);
      return data.medication;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création médicament');
    }
  }
);

export const updateMedication = createAsyncThunk(
  'pharmacy/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/pharmacy/${id}`, body);
      return data.medication;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour médicament');
    }
  }
);

export const addStockMovement = createAsyncThunk(
  'pharmacy/addMovement',
  async ({ id, mouvement }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/pharmacy/${id}/mouvements`, mouvement);
      return data.medication;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mouvement stock');
    }
  }
);

const pharmacySlice = createSlice({
  name: 'pharmacy',
  initialState: {
    list: [],
    movements: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    stockAlerts: { rupture: [], critique: [], bas: [] },
    perempAlerts: [],
    inventory: { total_meds: 0, ruptures: 0, bas: 0, expires: 0 },
    filters: { search: '', categorie: '', alert: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setMovements(state, action) { state.movements = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMedications.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMedications.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.medications;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchMedications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.inventory = { ...state.inventory, ...action.payload };
      })
      .addCase(fetchStockAlerts.fulfilled, (state, action) => {
        state.stockAlerts = { ...state.stockAlerts, ...action.payload };
      })
      .addCase(createMedication.pending, (state) => { state.saving = true; })
      .addCase(createMedication.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createMedication.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateMedication.pending, (state) => { state.saving = true; })
      .addCase(updateMedication.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(m => m._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.current?._id === action.payload._id) state.current = action.payload;
      })
      .addCase(updateMedication.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(addStockMovement.fulfilled, (state, action) => {
        const idx = state.list.findIndex(m => m._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setMovements, clearError } = pharmacySlice.actions;

export const selectMedications = (state) => state.pharmacy.list;
export const selectCurrentMedication = (state) => state.pharmacy.current;
export const selectPharmacyTotal = (state) => state.pharmacy.total;
export const selectPharmacyLoading = (state) => state.pharmacy.loading;
export const selectPharmacySaving = (state) => state.pharmacy.saving;
export const selectStockAlerts = (state) => state.pharmacy.stockAlerts;
export const selectPharmacyInventory = (state) => state.pharmacy.inventory;
export const selectPharmacyMovements = (state) => state.pharmacy.movements;

export default pharmacySlice.reducer;
