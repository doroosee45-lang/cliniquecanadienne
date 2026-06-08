import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

export const fetchArchives = createAsyncThunk(
  'archive/fetchAll',
  async (
    { page = 1, limit = 15, search = '', categorie = '', service = '', date_debut = '', date_fin = '' } = {},
    { rejectWithValue }
  ) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (search)     params.set('q', search);
      if (categorie)  params.set('categorie', categorie);
      if (service)    params.set('service', service);
      if (date_debut) params.set('date_debut', date_debut);
      if (date_fin)   params.set('date_fin', date_fin);
      const { data } = await api.get(`/archives?${params}`);
      return { archives: data.archives || data.data || [], total: data.total || 0, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur chargement archives');
    }
  }
);

export const fetchArchiveStats = createAsyncThunk(
  'archive/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/archives/stats');
      return data.kpis || data.stats || {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur stats archives');
    }
  }
);

export const restoreArchive = createAsyncThunk(
  'archive/restore',
  async ({ id, motif }, { rejectWithValue }) => {
    try {
      await api.post(`/archives/${id}/restore`, { motif });
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur restauration archive');
    }
  }
);

export const deleteArchive = createAsyncThunk(
  'archive/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/archives/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur suppression archive');
    }
  }
);

export const createArchive = createAsyncThunk(
  'archive/create',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/archives', body);
      return data.archive;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur archivage');
    }
  }
);

export const bulkRestore = createAsyncThunk(
  'archive/bulkRestore',
  async (ids, { rejectWithValue }) => {
    try {
      await api.post('/archives/bulk-restore', { ids });
      return ids;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur restauration groupée');
    }
  }
);

export const bulkDelete = createAsyncThunk(
  'archive/bulkDelete',
  async (ids, { rejectWithValue }) => {
    try {
      await api.post('/archives/bulk-delete', { ids });
      return ids;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur suppression groupée');
    }
  }
);

export const exportArchives = createAsyncThunk(
  'archive/export',
  async (format, { rejectWithValue }) => {
    try {
      await api.get(`/archives/export?format=${format}`);
      return format;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur export');
    }
  }
);

export const updateAutoConfig = createAsyncThunk(
  'archive/updateAutoConfig',
  async (config, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/archives/config', config);
      return data.config || config;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur mise à jour config');
    }
  }
);

const archiveSlice = createSlice({
  name: 'archive',
  initialState: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    loading: false,
    saving: false,
    exporting: false,
    error: null,
    selectedIds: [],
    kpis: {
      total: 0,
      patients: 0,
      consultations: 0,
      hospitalisations: 0,
      labo: 0,
      imagerie: 0,
      examens: 0,
      chirurgies: 0,
      financier: 0,
      documents: 0,
      archives_mois: 0,
      restaurations: 0,
      taille_totale: '0 Mo',
      derniere_op: '—',
    },
    configAuto: {
      actif: true,
      duree: '1an',
      consultations: true,
      hospitalisations: true,
      factures: true,
      examens: true,
    },
    filters: {
      search: '',
      categorie: '',
      service: '',
      date_debut: '',
      date_fin: '',
    },
  },
  reducers: {
    setPage(state, action) { state.page = action.payload; },
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
    },
    setCurrent(state, action) { state.current = action.payload; },
    clearCurrent(state) { state.current = null; },
    selectId(state, action) {
      if (!state.selectedIds.includes(action.payload)) {
        state.selectedIds.push(action.payload);
      }
    },
    deselectId(state, action) {
      state.selectedIds = state.selectedIds.filter(id => id !== action.payload);
    },
    selectAll(state, action) { state.selectedIds = action.payload; },
    clearSelection(state) { state.selectedIds = []; },
    setConfigAuto(state, action) {
      state.configAuto = { ...state.configAuto, ...action.payload };
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchArchives
      .addCase(fetchArchives.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchArchives.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.archives;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchArchives.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchArchiveStats
      .addCase(fetchArchiveStats.fulfilled, (state, action) => {
        state.kpis = { ...state.kpis, ...action.payload };
      })

      // restoreArchive
      .addCase(restoreArchive.pending, (state) => { state.saving = true; })
      .addCase(restoreArchive.fulfilled, (state, action) => {
        state.saving = false;
        const idx = state.list.findIndex(a => a._id === action.payload);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], statut: 'restauré' };
      })
      .addCase(restoreArchive.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // deleteArchive
      .addCase(deleteArchive.pending, (state) => { state.saving = true; })
      .addCase(deleteArchive.fulfilled, (state, action) => {
        state.saving = false;
        state.list = state.list.filter(a => a._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.selectedIds = state.selectedIds.filter(id => id !== action.payload);
      })
      .addCase(deleteArchive.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // createArchive
      .addCase(createArchive.pending, (state) => { state.saving = true; })
      .addCase(createArchive.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          state.list.unshift(action.payload);
          state.total += 1;
        }
      })
      .addCase(createArchive.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // bulkRestore
      .addCase(bulkRestore.pending, (state) => { state.saving = true; })
      .addCase(bulkRestore.fulfilled, (state, action) => {
        state.saving = false;
        action.payload.forEach(id => {
          const idx = state.list.findIndex(a => a._id === id);
          if (idx !== -1) state.list[idx] = { ...state.list[idx], statut: 'restauré' };
        });
        state.selectedIds = [];
      })
      .addCase(bulkRestore.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // bulkDelete
      .addCase(bulkDelete.pending, (state) => { state.saving = true; })
      .addCase(bulkDelete.fulfilled, (state, action) => {
        state.saving = false;
        state.list = state.list.filter(a => !action.payload.includes(a._id));
        state.total = Math.max(0, state.total - action.payload.length);
        state.selectedIds = [];
      })
      .addCase(bulkDelete.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // exportArchives
      .addCase(exportArchives.pending, (state) => { state.exporting = true; })
      .addCase(exportArchives.fulfilled, (state) => { state.exporting = false; })
      .addCase(exportArchives.rejected, (state, action) => {
        state.exporting = false;
        state.error = action.payload;
      })

      // updateAutoConfig
      .addCase(updateAutoConfig.fulfilled, (state, action) => {
        state.configAuto = { ...state.configAuto, ...action.payload };
      });
  },
});

export const {
  setPage, setFilters, setCurrent, clearCurrent,
  selectId, deselectId, selectAll, clearSelection,
  setConfigAuto, clearError,
} = archiveSlice.actions;

// Selectors
export const selectArchives       = (state) => state.archive.list;
export const selectCurrentArchive = (state) => state.archive.current;
export const selectArchiveTotal   = (state) => state.archive.total;
export const selectArchivePage    = (state) => state.archive.page;
export const selectArchiveLoading = (state) => state.archive.loading;
export const selectArchiveSaving  = (state) => state.archive.saving;
export const selectArchiveExporting = (state) => state.archive.exporting;
export const selectArchiveError   = (state) => state.archive.error;
export const selectArchiveKPIs    = (state) => state.archive.kpis;
export const selectArchiveFilters = (state) => state.archive.filters;
export const selectSelectedIds    = (state) => state.archive.selectedIds;
export const selectConfigAuto     = (state) => state.archive.configAuto;

export default archiveSlice.reducer;
