import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchStaff = createAsyncThunk(
  'hr/fetchStaff',
  async ({ page = 1, limit = 20, role = '', statut = '', departement = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (role) params.set('role', role);
      if (statut) params.set('statut', statut);
      if (departement) params.set('departement', departement);
      const { data } = await api.get(`/hr/staff?${params}`);
      return { staff: data.staff || data.users || [], total: data.total || 0, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement personnel');
    }
  }
);

export const fetchSchedules = createAsyncThunk(
  'hr/fetchSchedules',
  async ({ date = '' } = {}, { rejectWithValue }) => {
    try {
      const params = date ? `?date=${date}` : '';
      const { data } = await api.get(`/hr/schedules${params}`);
      return data.schedules || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement plannings');
    }
  }
);

export const fetchLeaves = createAsyncThunk(
  'hr/fetchLeaves',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/hr/leaves');
      return data.leaves || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement congés');
    }
  }
);

export const createStaffMember = createAsyncThunk(
  'hr/createStaff',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/hr/staff', body);
      return data.staff || data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création employé');
    }
  }
);

export const updateStaffMember = createAsyncThunk(
  'hr/updateStaff',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/hr/staff/${id}`, body);
      return data.staff || data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour employé');
    }
  }
);

const hrSlice = createSlice({
  name: 'hr',
  initialState: {
    staff: [],
    schedules: [],
    leaves: [],
    attendance: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    staffPresence: { present: 0, absent: 0, conges: 0 },
    filters: { role: '', statut: '', departement: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    setStaffPresence(state, action) { state.staffPresence = { ...state.staffPresence, ...action.payload }; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStaff.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.staff = action.payload.staff;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.schedules = action.payload;
      })
      .addCase(fetchLeaves.fulfilled, (state, action) => {
        state.leaves = action.payload;
        state.staffPresence.conges = action.payload.filter(l => l.statut === 'approuve').length;
      })
      .addCase(createStaffMember.pending, (state) => { state.saving = true; })
      .addCase(createStaffMember.fulfilled, (state, action) => {
        state.saving = false;
        state.staff.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createStaffMember.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateStaffMember.pending, (state) => { state.saving = true; })
      .addCase(updateStaffMember.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.staff.findIndex(s => s._id === action.payload._id);
        if (idx !== -1) state.staff[idx] = action.payload;
      })
      .addCase(updateStaffMember.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { setPage, setFilters, setCurrent, setStaffPresence, clearError } = hrSlice.actions;

export const selectStaff = (state) => state.hr.staff;
export const selectSchedules = (state) => state.hr.schedules;
export const selectLeaves = (state) => state.hr.leaves;
export const selectCurrentStaff = (state) => state.hr.current;
export const selectHRTotal = (state) => state.hr.total;
export const selectHRLoading = (state) => state.hr.loading;
export const selectHRSaving = (state) => state.hr.saving;
export const selectHRStaffPresence = (state) => state.hr.staffPresence;
export const selectHRFilters = (state) => state.hr.filters;

export default hrSlice.reducer;
