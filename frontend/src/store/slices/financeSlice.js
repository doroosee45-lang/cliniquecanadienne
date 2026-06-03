import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchInvoices = createAsyncThunk(
  'finance/fetchAll',
  async ({ page = 1, limit = 20, statut = '', patient = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (patient) params.set('patient', patient);
      const { data } = await api.get(`/finance?${params}`);
      return { invoices: data.invoices, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement factures');
    }
  }
);

export const fetchFinanceStats = createAsyncThunk(
  'finance/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/stats');
      return data.stats;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur statistiques finance');
    }
  }
);

export const createInvoice = createAsyncThunk(
  'finance/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/finance', body);
      return data.invoice;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création facture');
    }
  }
);

export const updateInvoice = createAsyncThunk(
  'finance/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/finance/${id}`, body);
      return data.invoice;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour facture');
    }
  }
);

export const recordPayment = createAsyncThunk(
  'finance/payment',
  async ({ id, payForm }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/finance/${id}/paiement`, payForm);
      return data.invoice;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur enregistrement paiement');
    }
  }
);

const financeSlice = createSlice({
  name: 'finance',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    stats: {
      ca_mois: 0,
      payees: 0,
      impayees: 0,
      taux_recouvrement: 0,
      revenus_auj: 0,
      depenses_auj: 0,
    },
    filters: { statut: '', patient: '' },
    payment: { mode: 'especes', reference: '', montant: 0 },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setPayment(state, action) { state.payment = { ...state.payment, ...action.payload }; },
    resetPayment(state) { state.payment = { mode: 'especes', reference: '', montant: 0 }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.invoices;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchFinanceStats.fulfilled, (state, action) => {
        state.stats = { ...state.stats, ...action.payload };
      })
      .addCase(createInvoice.pending, (state) => { state.saving = true; })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createInvoice.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateInvoice.pending, (state) => { state.saving = true; })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(i => i._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateInvoice.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(recordPayment.pending, (state) => { state.saving = true; })
      .addCase(recordPayment.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(i => i._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(recordPayment.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setPayment, resetPayment, clearError } = financeSlice.actions;

export const selectInvoices = (state) => state.finance.list;
export const selectCurrentInvoice = (state) => state.finance.current;
export const selectFinanceTotal = (state) => state.finance.total;
export const selectFinanceLoading = (state) => state.finance.loading;
export const selectFinanceSaving = (state) => state.finance.saving;
export const selectFinanceStats = (state) => state.finance.stats;
export const selectFinanceFilters = (state) => state.finance.filters;
export const selectPaymentForm = (state) => state.finance.payment;

export default financeSlice.reducer;
