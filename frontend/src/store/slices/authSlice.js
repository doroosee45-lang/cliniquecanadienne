import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Non authentifié');
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.token) sessionStorage.setItem('ms_token', data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Identifiants invalides');
  }
});

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch {
    // ignore network errors on logout
  } finally {
    sessionStorage.removeItem('ms_token');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;

export default authSlice.reducer;
