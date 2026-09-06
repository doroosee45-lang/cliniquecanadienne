import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import api from '../api';
import Spinner from '../components/UI/Spinner';
import { StatusBadge } from '../components/UI/Badge';
import { RECORD_TYPES, RECORD_TYPE_MAP } from '../utils/recordTypes';
import {
  searchMedicalRecords, setFilters, setPage,
  selectMedicalRecords, selectMedicalRecordsTotal, selectMedicalRecordsPage,
  selectMedicalRecordsLimit, selectMedicalRecordsLoading, selectMedicalRecordsFilters,
} from '../store/slices/dossiersMedicauxSlice';

const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ── Ouvre le dossier trouvé : vers l'onglet PatientDetail.jsx correspondant
// quand il existe et que le patient est identifié, sinon vers le module
// dédié (jamais un lien fictif — voir recordTypes.js pour la pédiatrie).
function openRecord(navigate, record) {
  if (record.patientId && record.tabTarget) {
    navigate(`/patients/${record.patientId}?tab=${record.tabTarget}`);
  } else if (record.patientId) {
    navigate(`/patients/${record.patientId}`);
  } else {
    navigate(record.moduleRoute);
  }
}

// ── Barre de recherche principale (debounce 300ms, même pattern que
// Appointments.jsx — aucun hook de debounce partagé n'existe encore dans le
// codebase) ──────────────────────────────────────────────────────────────
function RecordSearchBar({ value, onChange }) {
  const [text, setText] = useState(value);
  const timer = useRef(null);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Rechercher un patient, un motif, un diagnostic..."
      aria-label="Rechercher un dossier médical"
      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2EAF4', borderRadius: 10, fontSize: 14, outline: 'none' }}
    />
  );
}

// ── Filtres avancés (repliable, replié par défaut) ───────────────────────
function RecordFilters({ open, onToggle, filters, onChange, medecins }) {
  const toggleType = (id) => {
    const types = filters.types.includes(id) ? filters.types.filter((t) => t !== id) : [...filters.types, id];
    onChange({ types });
  };
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: '#F8FAFD', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1B4F9E' }}>
        {open ? '▾' : '▸'} Filtres avancés
      </button>
      {open && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', marginBottom: 8 }}>Type de dossier</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {RECORD_TYPES.map((t) => {
                const active = filters.types.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: active ? '1.5px solid #1B4F9E' : '1.5px solid #E2EAF4', background: active ? '#EFF6FF' : '#fff', color: active ? '#1B4F9E' : '#6B7A99' }}>
                    {t.icon} {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Du</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })}
                style={{ padding: '7px 10px', border: '1.5px solid #E2EAF4', borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Au</label>
              <input type="date" value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })}
                style={{ padding: '7px 10px', border: '1.5px solid #E2EAF4', borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Praticien</label>
              <select value={filters.praticien} onChange={(e) => onChange({ praticien: e.target.value })}
                style={{ padding: '7px 10px', border: '1.5px solid #E2EAF4', borderRadius: 8, fontSize: 13, minWidth: 180, background: '#fff' }}>
                <option value="">Tous</option>
                {medecins.map((m) => <option key={m._id} value={m._id}>Dr. {m.prenom} {m.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Statut</label>
              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                {[['tous', 'Tous'], ['actif', 'Actif'], ['clos', 'Clos/Archivé']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" name="dm-statut" checked={filters.statut === v} onChange={() => onChange({ statut: v })} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vue « liste des dossiers » ────────────────────────────────────────────
function RecordResultsTable({ results, navigate }) {
  if (!results.length) return <p className="text-gray-400 text-sm text-center py-8">Aucun dossier ne correspond à cette recherche.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #EEF4FF', textAlign: 'left', color: '#6B7A99', fontSize: 11, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 10px' }}>Patient</th>
            <th style={{ padding: '8px 10px' }}>Type</th>
            <th style={{ padding: '8px 10px' }}>Date</th>
            <th style={{ padding: '8px 10px' }}>Résumé</th>
            <th style={{ padding: '8px 10px' }}>Praticien</th>
            <th style={{ padding: '8px 10px' }}></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const meta = RECORD_TYPE_MAP[r.type];
            return (
              <tr key={`${r.type}-${r.recordId}`} style={{ borderBottom: '1px solid #F3F6FB' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.patientNom || '—'}</td>
                <td style={{ padding: '8px 10px' }}>{meta?.icon} {meta?.label}</td>
                <td style={{ padding: '8px 10px', color: '#6B7A99' }}>{fmt(r.date)}</td>
                <td style={{ padding: '8px 10px' }}>{r.resume || '—'}</td>
                <td style={{ padding: '8px 10px', color: '#6B7A99' }}>{r.praticien || '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {r.statut && <span style={{ marginRight: 8 }}><StatusBadge statut={r.statut} /></span>}
                  <button onClick={() => openRecord(navigate, r)}
                    style={{ fontSize: 11, padding: '4px 12px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
                    Ouvrir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Vue « par patient » — regroupe les résultats déjà chargés, aucun appel
// réseau supplémentaire ──────────────────────────────────────────────────
function PatientRecordSummaryCard({ results, navigate }) {
  const groups = {};
  for (const r of results) {
    const key = r.patientId || `_sans_patient_${r.type}_${r.recordId}`;
    if (!groups[key]) groups[key] = { patientId: r.patientId, patientNom: r.patientNom, records: [] };
    groups[key].records.push(r);
  }
  const list = Object.values(groups).sort((a, b) => new Date(b.records[0].date || 0) - new Date(a.records[0].date || 0));

  if (!list.length) return <p className="text-gray-400 text-sm text-center py-8">Aucun dossier ne correspond à cette recherche.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((g) => {
        const counts = {};
        for (const r of g.records) counts[r.type] = (counts[r.type] || 0) + 1;
        const dernier = g.records[0];
        return (
          <div key={g.patientId || g.patientNom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: '1px solid #EEF4FF', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>{g.patientNom || '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7A99' }}>Dernier dossier : {RECORD_TYPE_MAP[dernier.type]?.label}, {fmt(dernier.date)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {Object.entries(counts).map(([type, n]) => (
                <span key={type} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: '#F8FAFD', border: '1px solid #EEF4FF' }}>
                  {RECORD_TYPE_MAP[type]?.icon}{n}
                </span>
              ))}
            </div>
            <button
              onClick={() => g.patientId ? navigate(`/patients/${g.patientId}`) : toast.error('Aucun dossier patient identifié pour ce regroupement.')}
              style={{ fontSize: 12, padding: '6px 14px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              Ouvrir dossier
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function DossiersMedicaux() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const results  = useSelector(selectMedicalRecords);
  const total    = useSelector(selectMedicalRecordsTotal);
  const page     = useSelector(selectMedicalRecordsPage);
  const limit    = useSelector(selectMedicalRecordsLimit);
  const loading  = useSelector(selectMedicalRecordsLoading);
  const filters  = useSelector(selectMedicalRecordsFilters);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('liste'); // 'liste' | 'patient'
  const [medecins, setMedecins] = useState([]);

  useEffect(() => {
    api.get('/admin/users?role=medecin&limit=100')
      .then(({ data }) => setMedecins(data.users || data.staff || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    dispatch(searchMedicalRecords({ ...filters, page }));
  }, [dispatch, filters, page]);

  const changeFilters = (patch) => dispatch(setFilters(patch));
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">🔍 Dossiers Médicaux</h1>
      </div>

      <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RecordSearchBar value={filters.q} onChange={(q) => changeFilters({ q })} />
        <RecordFilters open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} filters={filters} onChange={changeFilters} medecins={medecins} />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ display: 'flex', gap: 4, background: '#F8FAFD', padding: 4, borderRadius: 10 }}>
            <button onClick={() => setView('liste')}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: view === 'liste' ? '#1B4F9E' : 'transparent', color: view === 'liste' ? '#fff' : '#6B7A99' }}>
              ▤ Liste des dossiers
            </button>
            <button onClick={() => setView('patient')}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: view === 'patient' ? '#1B4F9E' : 'transparent', color: view === 'patient' ? '#fff' : '#6B7A99' }}>
              👤 Vue par patient
            </button>
          </div>
          <span style={{ fontSize: 12, color: '#6B7A99' }}>{total} dossier{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : view === 'liste' ? (
          <RecordResultsTable results={results} navigate={navigate} />
        ) : (
          <PatientRecordSummaryCard results={results} navigate={navigate} />
        )}

        {!loading && total > limit && (
          <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: '1px solid #EEF4FF' }}>
            <span style={{ fontSize: 12, color: '#6B7A99' }}>Page {page} / {totalPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {page > 1 && <button onClick={() => dispatch(setPage(page - 1))} style={{ fontSize: 12, padding: '5px 12px', background: '#F8FAFD', border: '1px solid #E2EAF4', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>← Précédent</button>}
              {page < totalPages && <button onClick={() => dispatch(setPage(page + 1))} style={{ fontSize: 12, padding: '5px 12px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Suivant →</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
