import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchUsers = createAsyncThunk(
  'administration/fetchUsers',
  async ({ page = 1, limit = 20, role = '', statut = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (role) params.set('role', role);
      if (statut) params.set('statut', statut);
      const { data } = await api.get(`/admin/users?${params}`);
      return { users: data.users, total: data.total, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement utilisateurs');
    }
  }
);

export const createUser = createAsyncThunk(
  'administration/createUser',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/admin/users', body);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur création utilisateur');
    }
  }
);

export const updateUser = createAsyncThunk(
  'administration/updateUser',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/admin/users/${id}`, body);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour utilisateur');
    }
  }
);

export const toggleUserStatus = createAsyncThunk(
  'administration/toggleStatus',
  async ({ id, statut }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/admin/users/${id}`, { statut });
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur changement statut');
    }
  }
);

export const fetchServices = createAsyncThunk(
  'administration/fetchServices',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/admin/services');
      return data.services || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement services');
    }
  }
);

export const fetchSystemSettings = createAsyncThunk(
  'administration/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/admin/settings');
      return data.settings || {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement paramètres');
    }
  }
);

export const updateSystemSettings = createAsyncThunk(
  'administration/updateSettings',
  async (settings, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/admin/settings', settings);
      return data.settings;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour paramètres');
    }
  }
);

const administrationSlice = createSlice({
  name: 'administration',
  initialState: {
    users: [],
    services: [],
    settings: {},
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    error: null,
    filters: { role: '', statut: '' },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setCurrent(state, action) { state.current = action.payload; },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = Array.isArray(action.payload.users) ? action.payload.users : [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createUser.pending, (state) => { state.saving = true; })
      .addCase(createUser.fulfilled, (state, action) => {
        state.saving = false;
        state.users.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateUser.pending, (state) => { state.saving = true; })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.users.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) state.users[idx] = action.payload;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(toggleUserStatus.fulfilled, (state, action) => {
        const idx = state.users.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) state.users[idx] = action.payload;
      })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.services = action.payload;
      })
      .addCase(fetchSystemSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
      })
      .addCase(updateSystemSettings.fulfilled, (state, action) => {
        state.settings = { ...state.settings, ...action.payload };
      });
  },
});

export const { setPage, setFilters, setCurrent, clearError } = administrationSlice.actions;

export const selectUsers = (state) => state.administration.users;
export const selectServices = (state) => state.administration.services;
export const selectSystemSettings = (state) => state.administration.settings;
export const selectCurrentUser = (state) => state.administration.current;
export const selectAdminTotal = (state) => state.administration.total;
export const selectAdminLoading = (state) => state.administration.loading;
export const selectAdminSaving = (state) => state.administration.saving;
export const selectAdminFilters = (state) => state.administration.filters;

export default administrationSlice.reducer;
