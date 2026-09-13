import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api';

// FICHE-UNIQUE-001 (13 sept. 2026) — limit par défaut relevé de 25 à 200 :
// la liste principale regroupe désormais les résultats par patient (une
// seule ligne par patient, voir DossiersMedicaux.jsx), ce qui exige d'avoir
// assez d'événements bruts déjà chargés pour que ce regroupement — et le
// nombre total d'événements affiché par patient — reflète une réalité
// complète, pas seulement les 25 événements les plus récents tous patients
// confondus. La pagination visible à l'utilisateur passe côté client, sur
// la liste de patients regroupés, pas sur les événements bruts.
export const searchMedicalRecords = createAsyncThunk(
  'dossiersMedicaux/search',
  async ({ q = '', types = [], dateFrom = '', dateTo = '', praticien = '', statut = 'tous', page = 1, limit = 200 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit, statut });
      if (q)         params.set('q', q);
      if (dateFrom)  params.set('dateFrom', dateFrom);
      if (dateTo)    params.set('dateTo', dateTo);
      if (praticien) params.set('praticien', praticien);
      types.forEach((t) => params.append('types', t));
      const { data } = await api.get(`/medical-records/search?${params}`);
      return { results: data.results, total: data.total, page: data.page, limit: data.limit, sourcesTruncated: data.sourcesTruncated || [] };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur lors de la recherche de dossiers médicaux');
    }
  }
);

// FICHE-UNIQUE-001 — fiche unique d'un patient déjà identifié : requête
// dédiée, ciblée par patientId (jamais une correspondance texte), pour
// garantir un historique complet même si PER_SOURCE_CAP a tronqué la
// recherche large affichée dans la liste principale (voir sourcesTruncated).
// N'écrit jamais dans `list`/`total` — état séparé, ne perturbe jamais la
// liste principale déjà affichée.
export const fetchPatientRecordSheet = createAsyncThunk(
  'dossiersMedicaux/fetchPatientSheet',
  async ({ patientId, limit = 500 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ patientId, limit, statut: 'tous' });
      const { data } = await api.get(`/medical-records/search?${params}`);
      return { patientId, results: data.results, sourcesTruncated: data.sourcesTruncated || [] };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Erreur lors du chargement de la fiche patient');
    }
  }
);

const dossiersMedicauxSlice = createSlice({
  name: 'dossiersMedicaux',
  initialState: {
    list: [],
    total: 0,
    page: 1,
    limit: 200,
    loading: false,
    error: null,
    sourcesTruncated: [],
    filters: { q: '', types: [], dateFrom: '', dateTo: '', praticien: '', statut: 'tous' },
    // FICHE-UNIQUE-001 — fiche patient ouverte (targeted fetch, jamais mêlée
    // à `list` ci-dessus).
    sheet: { patientId: null, loading: false, error: null, results: [], sourcesTruncated: [] },
  },
  reducers: {
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.page = 1; },
    setPage(state, action) { state.page = action.payload; },
    clearError(state) { state.error = null; },
    closePatientSheet(state) { state.sheet = { patientId: null, loading: false, error: null, results: [], sourcesTruncated: [] }; },
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
        state.sourcesTruncated = action.payload.sourcesTruncated;
      })
      .addCase(searchMedicalRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPatientRecordSheet.pending, (state, action) => {
        state.sheet.patientId = action.meta.arg.patientId;
        state.sheet.loading = true;
        state.sheet.error = null;
      })
      .addCase(fetchPatientRecordSheet.fulfilled, (state, action) => {
        // Ignore une réponse tardive si la fiche a déjà été fermée/changée
        // entre-temps (clic rapide sur un autre patient).
        if (state.sheet.patientId !== action.payload.patientId) return;
        state.sheet.loading = false;
        state.sheet.results = action.payload.results;
        state.sheet.sourcesTruncated = action.payload.sourcesTruncated;
      })
      .addCase(fetchPatientRecordSheet.rejected, (state, action) => {
        state.sheet.loading = false;
        state.sheet.error = action.payload;
      });
  },
});

export const { setFilters, setPage, clearError, closePatientSheet } = dossiersMedicauxSlice.actions;

export const selectMedicalRecords          = (state) => state.dossiersMedicaux.list;
export const selectMedicalRecordsSourcesTruncated = (state) => state.dossiersMedicaux.sourcesTruncated;
export const selectPatientSheet            = (state) => state.dossiersMedicaux.sheet;
export const selectMedicalRecordsTotal   = (state) => state.dossiersMedicaux.total;
export const selectMedicalRecordsPage    = (state) => state.dossiersMedicaux.page;
export const selectMedicalRecordsLimit   = (state) => state.dossiersMedicaux.limit;
export const selectMedicalRecordsLoading = (state) => state.dossiersMedicaux.loading;
export const selectMedicalRecordsError   = (state) => state.dossiersMedicaux.error;
export const selectMedicalRecordsFilters = (state) => state.dossiersMedicaux.filters;

export default dossiersMedicauxSlice.reducer;
