import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import api from '../api';
import Spinner from '../components/UI/Spinner';
import { StatusBadge } from '../components/UI/Badge';
import { RECORD_TYPES, RECORD_TYPE_MAP } from '../utils/recordTypes';
import {
  searchMedicalRecords, setFilters,
  fetchPatientRecordSheet, closePatientSheet,
  selectMedicalRecords, selectMedicalRecordsTotal, selectMedicalRecordsPage,
  selectMedicalRecordsLimit, selectMedicalRecordsLoading, selectMedicalRecordsFilters,
  selectMedicalRecordsSourcesTruncated, selectPatientSheet,
} from '../store/slices/dossiersMedicauxSlice';

const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const PATIENTS_PER_PAGE = 20;

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

// FICHE-UNIQUE-001 (13 sept. 2026) — regroupe les événements (déjà filtrés
// par permission côté backend, medicalRecordsController.js::allowedSources)
// par patient. Aucun événement d'un type non autorisé pour le rôle connecté
// ne peut jamais apparaître ici : le backend ne les a jamais interrogés ni
// renvoyés en premier lieu — ce regroupement ne fait qu'agréger ce qui a
// légitimement été reçu, jamais un filtrage/masquage client d'une donnée
// déjà présente en mémoire.
function groupByPatient(results) {
  const groups = new Map();
  for (const r of results) {
    const key = r.patientId ? String(r.patientId) : `_sans_patient_${r.type}_${r.recordId}`;
    if (!groups.has(key)) groups.set(key, { patientId: r.patientId, patientNom: r.patientNom, records: [] });
    groups.get(key).records.push(r);
  }
  const list = Array.from(groups.values());
  for (const g of list) g.records.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  list.sort((a, b) => new Date(b.records[0]?.date || 0) - new Date(a.records[0]?.date || 0));
  return list;
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

// ── Une entrée de la chronologie, à l'intérieur de la fiche unique — jamais
// une ligne du tableau principal (voir PatientSheetModal ci-dessous). ──────
function TimelineEntry({ record, navigate }) {
  const meta = RECORD_TYPE_MAP[record.type];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#F8FAFD' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{meta?.icon} {meta?.label}</span>
          <span style={{ fontSize: 12, color: '#6B7A99' }}>{fmt(record.date)}</span>
          {record.statut && <StatusBadge statut={record.statut} />}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{record.resume || '—'}</div>
        {record.praticien && <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>Praticien : {record.praticien}</div>}
      </div>
      <button onClick={() => openRecord(navigate, record)}
        style={{ fontSize: 11, padding: '4px 12px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 6, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
        Ouvrir
      </button>
    </div>
  );
}

// ── Fiche unique consolidée d'un patient — regroupe TOUS ses événements
// (laboratoire, imagerie, ordonnances, consultations, hospitalisations,
// chirurgie...) en sections par type, jamais des lignes indépendantes du
// tableau principal. Utilise d'abord les événements déjà chargés dans la
// liste (aucun appel réseau dans le cas courant) ; ne relance une requête
// ciblée (patientId) que si sourcesTruncated indique qu'un type présent
// pour CE patient a pu être tronqué par PER_SOURCE_CAP dans la recherche
// large — jamais une troncature silencieuse. ─────────────────────────────
function PatientSheetModal({ group, listSourcesTruncated, navigate, onClose }) {
  const dispatch = useDispatch();
  const sheet = useSelector(selectPatientSheet);

  const relevantTruncated = useMemo(() => {
    const typesPresent = new Set(group.records.map((r) => r.type));
    return listSourcesTruncated.filter((t) => typesPresent.has(t));
  }, [group.records, listSourcesTruncated]);

  useEffect(() => {
    if (group.patientId && relevantTruncated.length > 0) {
      dispatch(fetchPatientRecordSheet({ patientId: group.patientId }));
    }
    return () => { dispatch(closePatientSheet()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.patientId]);

  const usingRefreshed = sheet.patientId === group.patientId && sheet.results.length > 0;
  const records = usingRefreshed ? sheet.results : group.records;

  const sections = {};
  for (const r of records) (sections[r.type] ||= []).push(r);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Fiche médicale de ${group.patientNom || 'patient'}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,59,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(11,30,59,.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #E2EAF4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0B1E3B' }}>{group.patientNom || 'Patient'}</div>
            <div style={{ fontSize: 12, color: '#6B7A99' }}>{records.length} événement{records.length > 1 ? 's' : ''} au dossier</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {group.patientId && (
              <button onClick={() => navigate(`/patients/${group.patientId}`)}
                style={{ fontSize: 12, padding: '6px 14px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                Fiche patient complète
              </button>
            )}
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F7FF', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6B7A99' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sheet.loading && (
            <div style={{ fontSize: 12, color: '#6B7A99', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size="sm" /> Chargement de l'historique complet (certains résultats n'avaient peut-être pas tous été chargés)…
            </div>
          )}
          {!sheet.loading && relevantTruncated.length > 0 && usingRefreshed && (
            <div style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
              ℹ️ La recherche large avait atteint la limite de résultats pour {relevantTruncated.map((t) => RECORD_TYPE_MAP[t]?.label).join(', ')} — l'historique complet de ce patient a été rechargé spécifiquement pour garantir qu'aucun événement ne manque ici.
            </div>
          )}

          {Object.keys(sections).length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Aucun événement médical trouvé pour ce patient.</p>
          ) : (
            RECORD_TYPES.filter((t) => sections[t.id]?.length).map((t) => (
              <div key={t.id}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4F9E', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
                  {t.icon} {t.label} ({sections[t.id].length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sections[t.id].map((r) => <TimelineEntry key={`${r.type}-${r.recordId}`} record={r} navigate={navigate} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
// ── Liste principale — une seule ligne par patient (nom, dernière
// activité, nombre total d'événements) ; jamais une ligne par événement. ──
function PatientList({ groups, navigate, onOpen }) {
  if (!groups.length) return <p className="text-gray-400 text-sm text-center py-8">Aucun dossier ne correspond à cette recherche.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #EEF4FF', textAlign: 'left', color: '#6B7A99', fontSize: 11, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 10px' }}>Patient</th>
            <th style={{ padding: '8px 10px' }}>Dernière activité</th>
            <th style={{ padding: '8px 10px' }}>Événements</th>
            <th style={{ padding: '8px 10px' }}></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const dernier = g.records[0];
            const counts = {};
            for (const r of g.records) counts[r.type] = (counts[r.type] || 0) + 1;
            return (
              <tr key={g.patientId || g.patientNom} style={{ borderBottom: '1px solid #F3F6FB' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{g.patientNom || '—'}</td>
                <td style={{ padding: '8px 10px', color: '#6B7A99' }}>
                  {dernier ? <>{RECORD_TYPE_MAP[dernier.type]?.icon} {RECORD_TYPE_MAP[dernier.type]?.label} · {fmt(dernier.date)}</> : '—'}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(counts).map(([type, n]) => (
                      <span key={type} title={RECORD_TYPE_MAP[type]?.label} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#F8FAFD', border: '1px solid #EEF4FF' }}>
                        {RECORD_TYPE_MAP[type]?.icon}{n}
                      </span>
                    ))}
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4F9E' }}>{g.records.length} au total</span>
                  </div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <button
                    onClick={() => g.patientId ? onOpen(g) : toast.error('Aucun dossier patient identifié pour ce regroupement.')}
                    style={{ fontSize: 12, padding: '6px 14px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
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
  const sourcesTruncated = useSelector(selectMedicalRecordsSourcesTruncated);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [medecins, setMedecins] = useState([]);
  const [patientPage, setPatientPage] = useState(1);
  const [openGroup, setOpenGroup] = useState(null);

  useEffect(() => {
    api.get('/admin/users?role=medecin&limit=100')
      .then(({ data }) => setMedecins(data.users || data.staff || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    dispatch(searchMedicalRecords({ ...filters, page }));
  }, [dispatch, filters, page]);

  const changeFilters = (patch) => { setPatientPage(1); dispatch(setFilters(patch)); };

  // FICHE-UNIQUE-001 — regroupement client, sur le lot d'événements déjà
  // chargé (limit=200 par défaut, voir slice) ; la pagination visible à
  // l'utilisateur porte sur les PATIENTS regroupés, plus sur les événements
  // bruts (dont la pagination backend existe toujours mais n'est plus,
  // volontairement, pilotée par l'UI ici).
  const groups = useMemo(() => groupByPatient(results), [results]);
  const totalPatientPages = Math.max(1, Math.ceil(groups.length / PATIENTS_PER_PAGE));
  const pageGroups = groups.slice((patientPage - 1) * PATIENTS_PER_PAGE, patientPage * PATIENTS_PER_PAGE);

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
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0B1E3B' }}>
            {groups.length} patient{groups.length > 1 ? 's' : ''} trouvé{groups.length > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 12, color: '#6B7A99' }}>{total} événement{total > 1 ? 's' : ''} au total</span>
        </div>

        {!loading && sourcesTruncated.length > 0 && (
          <div style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            ℹ️ Recherche très large : le nombre d'événements {sourcesTruncated.map((t) => RECORD_TYPE_MAP[t]?.label).join(', ')} affiché ici peut être incomplet pour certains patients — affinez la recherche (nom du patient) pour un historique garanti complet par fiche.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <PatientList groups={pageGroups} navigate={navigate} onOpen={setOpenGroup} />
        )}

        {!loading && groups.length > PATIENTS_PER_PAGE && (
          <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: '1px solid #EEF4FF' }}>
            <span style={{ fontSize: 12, color: '#6B7A99' }}>Page {patientPage} / {totalPatientPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {patientPage > 1 && <button onClick={() => setPatientPage((p) => p - 1)} style={{ fontSize: 12, padding: '5px 12px', background: '#F8FAFD', border: '1px solid #E2EAF4', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>← Précédent</button>}
              {patientPage < totalPatientPages && <button onClick={() => setPatientPage((p) => p + 1)} style={{ fontSize: 12, padding: '5px 12px', background: '#EFF6FF', color: '#1B4F9E', border: '1px solid #BFDBFE', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Suivant →</button>}
            </div>
          </div>
        )}
        {!loading && total > limit && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            {total} événements correspondent au total à cette recherche ({limit} chargés pour ce regroupement) — affinez la recherche pour réduire ce volume si nécessaire.
          </div>
        )}
      </div>

      {openGroup && (
        <PatientSheetModal group={openGroup} listSourcesTruncated={sourcesTruncated} navigate={navigate} onClose={() => setOpenGroup(null)} />
      )}
    </div>
  );
}
