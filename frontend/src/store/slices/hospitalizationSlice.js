import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchHospitalizations = createAsyncThunk(
  'hospitalization/fetchAll',
  async ({ page = 1, limit = 20, statut = '', patient = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (statut) params.set('statut', statut);
      if (patient) params.set('patient', patient);
      const { data } = await api.get(`/hospitalization?${params}`);
      return { hospitalizations: data.hospitalizations, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement hospitalisations');
    }
  }
);

export const fetchRooms = createAsyncThunk(
  'hospitalization/fetchRooms',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/hospitalization/rooms');
      return data.rooms || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement chambres');
    }
  }
);

export const createHospitalization = createAsyncThunk(
  'hospitalization/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/hospitalization', body);
      return data.hospitalization;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur admission patient');
    }
  }
);

export const updateHospitalization = createAsyncThunk(
  'hospitalization/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/hospitalization/${id}`, body);
      return data.hospitalization;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour hospitalisation');
    }
  }
);

export const addNote = createAsyncThunk(
  'hospitalization/addNote',
  async ({ id, note }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/hospitalization/${id}/notes`, { contenu: note });
      return { id, note: data.note };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur ajout note');
    }
  }
);

const hospitalizationSlice = createSlice({
  name: 'hospitalization',
  initialState: {
    list: [],
    rooms: [],
    current: null,
    notes: [],
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    occupationPercentage: 0,
    filters: { statut: '', patient: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setOccupation(state, action) { state.occupationPercentage = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHospitalizations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchHospitalizations.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.hospitalizations;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchHospitalizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.rooms = action.payload;
        const total = action.payload.length;
        const occupied = action.payload.filter(r => r.statut === 'occupee').length;
        state.occupationPercentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
      })
      .addCase(createHospitalization.pending, (state) => { state.saving = true; })
      .addCase(createHospitalization.fulfilled, (state, action) => {
        state.saving = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createHospitalization.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateHospitalization.pending, (state) => { state.saving = true; })
      .addCase(updateHospitalization.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(h => h._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.current?._id === action.payload._id) state.current = action.payload;
      })
      .addCase(updateHospitalization.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(addNote.fulfilled, (state, action) => {
        state.notes.push(action.payload.note);
      });
  },
});

export const { setPage, setFilters, setCurrent, setOccupation, clearError } = hospitalizationSlice.actions;

export const selectHospitalizations = (state) => state.hospitalization.list;
export const selectRooms = (state) => state.hospitalization.rooms;
export const selectCurrentHospitalization = (state) => state.hospitalization.current;
export const selectHospitalizationNotes = (state) => state.hospitalization.notes;
export const selectHospitalizationTotal = (state) => state.hospitalization.total;
export const selectHospitalizationLoading = (state) => state.hospitalization.loading;
export const selectHospitalizationSaving = (state) => state.hospitalization.saving;
export const selectOccupationPercentage = (state) => state.hospitalization.occupationPercentage;

export default hospitalizationSlice.reducer;
