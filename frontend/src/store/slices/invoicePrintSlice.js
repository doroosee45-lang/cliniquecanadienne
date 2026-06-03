import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchInvoiceForPrint = createAsyncThunk(
  'invoicePrint/fetch',
  async (id, { rejectWithValue }) => {
    try {
      const [invRes, setRes] = await Promise.all([
        api.get(`/finance/${id}`),
        api.get('/settings'),
      ]);

      const settings = {};
      setRes.data.settings?.forEach(x => { settings[x.cle] = x.valeur; });

      return { invoice: invRes.data.invoice, settings };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Facture introuvable');
    }
  }
);

const invoicePrintSlice = createSlice({
  name: 'invoicePrint',
  initialState: {
    invoice: null,
    settings: {},
    loading: false,
    error: null,
  },
  reducers: {
    clearInvoicePrint(state) {
      state.invoice = null;
      state.settings = {};
      state.error = null;
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoiceForPrint.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.invoice = null;
      })
      .addCase(fetchInvoiceForPrint.fulfilled, (state, action) => {
        state.loading = false;
        state.invoice = action.payload.invoice;
        state.settings = action.payload.settings;
      })
      .addCase(fetchInvoiceForPrint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearInvoicePrint, clearError } = invoicePrintSlice.actions;

export const selectPrintInvoice   = (state) => state.invoicePrint.invoice;
export const selectPrintSettings  = (state) => state.invoicePrint.settings;
export const selectPrintLoading   = (state) => state.invoicePrint.loading;
export const selectPrintError     = (state) => state.invoicePrint.error;

export default invoicePrintSlice.reducer;
