import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import Spinner from '../components/UI/Spinner';
import Badge, { StatusBadge } from '../components/UI/Badge';

// ── Onglets du dossier patient ────────────────────────────────────────────────
const TABS = [
  { id:'info',     label:'Informations',    icon:'👤' },
  { id:'rdv',      label:'Rendez-vous',     icon:'📅' },
  { id:'consult',  label:'Consultations',   icon:'🩺' },
  { id:'hospi',    label:'Hospitalisations',icon:'🛏️' },
  { id:'ordos',    label:'Ordonnances',     icon:'📋' },
  { id:'labo',     label:'Laboratoire',     icon:'🔬' },
  { id:'imagerie', label:'Imagerie',        icon:'🩻' },
  { id:'urgences', label:'Urgences',        icon:'🚨' },
  { id:'chirurgie',label:'Chirurgie',       icon:'🔪' },
  { id:'factures', label:'Factures',        icon:'💰' },
];

// ── Formatage de date ─────────────────────────────────────────────────────────
const fmt  = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtT = (d) => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

// ── Carte générique vide ──────────────────────────────────────────────────────
const Empty = ({ msg }) => (
  <p className="text-gray-400 text-sm text-center py-8">{msg}</p>
);

// ── Bouton "Ouvrir dans le module" ────────────────────────────────────────────
const OpenBtn = ({ to, label }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      style={{ fontSize:11, padding:'3px 10px', background:'#EFF6FF', color:'#1B4F9E', border:'1px solid #BFDBFE', borderRadius:6, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}
    >
      ↗ {label}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Module « Dossiers Médicaux » (recherche transversale) — un résultat de
  // recherche ouvre directement l'onglet concerné via ?tab=, au lieu de
  // toujours retomber sur 'info' puis obliger l'utilisateur à re-cliquer.
  // Valeur ignorée si elle ne correspond à aucun onglet réel (ex. lien
  // obsolète, saisie manuelle) — jamais un onglet vide/blanc affiché.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [patient,    setPatient]    = useState(null);
  const [tab,        setTab]        = useState(TABS.some(t => t.id === requestedTab) ? requestedTab : 'info');
  const [data,       setData]       = useState({});
  const [loading,    setLoading]    = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [imgError,   setImgError]   = useState(false);
  const [modal,      setModal]      = useState(null); // null | 'edit' | 'delete'
  const [saving,     setSaving]     = useState(false);
  const [editForm,   setEditForm]   = useState({});

  // ── Chargement du patient ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await api.get(`/patients/${id}`);
        setPatient(res.patient);
      } catch { navigate('/patients'); }
      finally  { setLoading(false); }
    })();
  }, [id, navigate]);

  // ── Chargement des données par onglet ─────────────────────────────────────
  useEffect(() => {
    if (!patient) return;
    if (tab === 'info') return;
    setTabLoading(true);
    const calls = {
      rdv:      () => api.get(`/appointments?patient=${id}&limit=15`),
      consult:  () => api.get(`/consultations?patient=${id}&limit=15`),
      hospi:    () => api.get(`/hospitalization?patient=${id}&limit=15`),
      ordos:    () => api.get(`/prescriptions?patient=${id}&limit=15`),
      labo:     () => api.get(`/laboratory?patient=${id}&limit=15`),
      // Module « Dossiers Médicaux » — cet onglet ne récupérait jusqu'ici que
      // la radiologie (ImagingResult) ; le filtre de recherche "Imagerie/Écho"
      // couvre aussi les échographies (Echographie), qui n'apparaissaient
      // donc jamais ici malgré l'icône/le libellé "Imagerie". Les deux
      // sources sont fusionnées ci-dessous, chacune taguée par son origine
      // réelle pour un affichage honnête (elles n'ont pas les mêmes champs).
      imagerie: () => Promise.all([
        api.get(`/radiology?patient=${id}&limit=15`),
        api.get(`/echographie?patient=${id}&limit=15`),
      ]).then(([radio, echo]) => ({
        data: {
          results: [
            ...(radio.data.examens || []).map(r => ({ ...r, _source: 'radiology' })),
            ...(echo.data.demandes || []).map(r => ({ ...r, _source: 'echographie' })),
          ],
        },
      })),
      urgences: () => api.get(`/urgences?patient=${id}&limit=15`),
      chirurgie:() => api.get(`/chirurgie?patient=${id}&limit=15`),
      factures: () => api.get(`/finance?patient=${id}&limit=15`),
    };
    if (calls[tab]) {
      calls[tab]()
        .then(r => setData(d => ({ ...d, [tab]: r.data })))
        .catch(() => setData(d => ({ ...d, [tab]: null })))
        .finally(() => setTabLoading(false));
    } else {
      setTabLoading(false);
    }
  }, [tab, patient, id]);

  // ── Actions patient ───────────────────────────────────────────────────────
  const openEdit = () => {
    setEditForm({
      prenom:           patient.prenom || '',
      nom:              patient.nom || '',
      date_naissance:   patient.date_naissance ? patient.date_naissance.substring(0, 10) : '',
      sexe:             patient.sexe || '',
      telephone:        patient.telephone || '',
      email:            patient.email || '',
      groupe_sanguin:   patient.groupe_sanguin || '',
      adresse_rue:      patient.adresse?.rue || '',
      adresse_ville:    patient.adresse?.ville || '',
      adresse_pays:     patient.adresse?.pays || 'Congo',
      contact_nom:      patient.contact_urgence?.nom || '',
      contact_relation: patient.contact_urgence?.relation || '',
      contact_tel:      patient.contact_urgence?.telephone || '',
    });
    setModal('edit');
  };

  const handleUpdate = async () => {
    if (!editForm.prenom?.trim() || !editForm.nom?.trim()) {
      toast.error('Prénom et nom sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      const body = {
        prenom:         editForm.prenom.trim(),
        nom:            editForm.nom.trim(),
        sexe:           editForm.sexe,
        telephone:      editForm.telephone,
        email:          editForm.email,
        groupe_sanguin: editForm.groupe_sanguin,
        adresse:        { rue: editForm.adresse_rue, ville: editForm.adresse_ville, pays: editForm.adresse_pays },
        contact_urgence:{ nom: editForm.contact_nom, relation: editForm.contact_relation, telephone: editForm.contact_tel },
      };
      if (editForm.date_naissance) body.date_naissance = editForm.date_naissance;
      const { data: res } = await api.put(`/patients/${id}`, body);
      setPatient(res.patient);
      setModal(null);
      toast.success('✅ Patient mis à jour avec succès');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = async () => {
    // PAT-TOGGLE-001 — PUT /:id générique bloque volontairement actif/statut
    // (AUDIT-P2-1) : ce toggle passe désormais par la route dédiée, seule
    // à réellement persister le changement (et bloquer/débloquer le
    // compte portail lié en cohérence).
    const newActif = !patient.actif;
    setSaving(true);
    try {
      const { data: res } = await api.put(`/patients/${id}/toggle-actif`);
      setPatient(res.patient);
      toast.success(newActif ? '✅ Patient activé' : '🔒 Patient désactivé');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/patients/${id}`);
      toast.success('Patient supprimé');
      navigate('/patients');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur lors de la suppression');
      setSaving(false);
      setModal(null);
    }
  };

  if (loading)  return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!patient) return null;

  const age = patient.date_naissance
    ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 86400000))
    : null;

  const photoUrl = !imgError && patient.photo ? patient.photo : null;

  return (
    <div className="space-y-4">

      {/* ── Fil d'Ariane ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate('/patients')} className="hover:text-blue-600 font-medium">
            👥 Patients
          </button>
          <span>›</span>
          <span className="text-gray-900 font-semibold">{patient.prenom} {patient.nom}</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={() => navigate('/appointments')}
            style={{ fontSize:12, padding:'5px 12px', background:'#EFF6FF', color:'#1B4F9E', border:'1px solid #BFDBFE', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
            📅 Nouveau RDV
          </button>
          <button onClick={() => navigate('/consultations')}
            style={{ fontSize:12, padding:'5px 12px', background:'#F0FDF4', color:'#166534', border:'1px solid #BBF7D0', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
            🩺 Consultation
          </button>
        </div>
      </div>

      {/* ── En-tête Patient ───────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start gap-6">

          {/* Photo ou avatar */}
          <div style={{ width:80, height:80, borderRadius:20, overflow:'hidden', flexShrink:0, background:'#EEF4FF', border:'3px solid #E2EAF4', boxShadow:'0 4px 12px rgba(11,30,59,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${patient.prenom} ${patient.nom}`}
                style={{ width:'100%', height:'100%', objectFit:'cover' }}
                onError={() => setImgError(true)}
              />
            ) : (
              <span style={{ fontSize:36 }}>{patient.sexe === 'F' ? '👩' : '👨'}</span>
            )}
          </div>

          {/* Informations principales */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{patient.prenom} {patient.nom}</h1>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{patient.numero_dossier}</span>
              <StatusBadge statut={patient.statut} />
              {/* AUDIT-D2 (ticket 0002) — dossier créé via Google OAuth (T3.1), date de naissance/sexe manquants. */}
              {patient.profil_a_completer && <Badge variant="orange">Profil à compléter</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {age !== null && <span>🎂 {age} ans ({fmt(patient.date_naissance)})</span>}
              <span>{patient.sexe === 'M' ? '♂️ Masculin' : '♀️ Féminin'}</span>
              {patient.telephone && <span>📞 {patient.telephone}</span>}
              {patient.email    && <span>✉️ {patient.email}</span>}
            </div>
          </div>

          {/* Badges vitaux */}
          <div className="flex flex-wrap gap-2">
            {patient.groupe_sanguin && patient.groupe_sanguin !== '?' && (
              <div className="badge badge-red text-sm px-3 py-1">🩸 {patient.groupe_sanguin}</div>
            )}
            {patient.allergies?.length > 0 && (
              <div className="badge badge-orange">⚠️ {patient.allergies.length} allergie(s)</div>
            )}
            {patient.antecedents_medicaux?.length > 0 && (
              <div className="badge badge-purple">📋 {patient.antecedents_medicaux.length} antécédent(s)</div>
            )}
          </div>
        </div>

        {/* Allergies + antécédents */}
        {(patient.allergies?.length > 0 || patient.antecedents_medicaux?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
            {patient.allergies?.length > 0 && (
              <div className="critical-alert rounded-xl p-3">
                <h4 className="font-bold text-red-800 text-xs mb-1">⚠️ ALLERGIES</h4>
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map((a, i) => <span key={i} className="badge badge-red">{a}</span>)}
                </div>
              </div>
            )}
            {patient.antecedents_medicaux?.length > 0 && (
              <div className="warning-alert rounded-xl p-3">
                <h4 className="font-bold text-yellow-800 text-xs mb-1">📋 ANTÉCÉDENTS</h4>
                <div className="flex flex-wrap gap-1">
                  {patient.antecedents_medicaux.map((a, i) => <span key={i} className="badge badge-yellow">{a}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Barre d'actions patient ─────────────────────────────────────── */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10, marginTop:16, paddingTop:16, borderTop:'1.5px solid #EEF4FF' }}>
          <button onClick={openEdit}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', color:'#1B4F9E', border:'1.5px solid #BFDBFE', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>
            ✏️ Modifier
          </button>
          <button onClick={handleToggleActif} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background: patient.actif ? 'linear-gradient(135deg,#FFF7ED,#FEE2C8)' : 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: patient.actif ? '#9A3412' : '#166534', border:`1.5px solid ${patient.actif ? '#FED7AA' : '#BBF7D0'}`, borderRadius:10, cursor: saving ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:13, opacity: saving ? 0.5 : 1 }}>
            {patient.actif ? '🔒 Désactiver' : '✅ Activer'}
          </button>
          <button onClick={() => setModal('delete')}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:'linear-gradient(135deg,#FEF2F2,#FEE2E2)', color:'#991B1B', border:'1.5px solid #FECACA', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13, marginLeft:'auto' }}>
            🗑️ Supprimer
          </button>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex overflow-x-auto gap-0 border-b border-gray-100 px-2 pt-2" style={{ scrollbarWidth:'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-xl transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tabLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <>
              {/* ── Informations ────────────────────────────────────────── */}
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section>
                    <h4 className="font-bold text-sm text-gray-700 mb-3">📋 Informations personnelles</h4>
                    <dl className="space-y-2 text-sm">
                      {[
                        ['N° Dossier', patient.numero_dossier],
                        ['Adresse', [patient.adresse?.rue, patient.adresse?.ville, patient.adresse?.pays].filter(Boolean).join(', ')],
                        ['Groupe sanguin', patient.groupe_sanguin],
                        ['Médecin référent', patient.medecin_referent ? `Dr. ${patient.medecin_referent.prenom} ${patient.medecin_referent.nom}` : null],
                      ].map(([label, value]) => value ? (
                        <div key={label} className="flex gap-2">
                          <dt className="text-gray-400 w-36 flex-shrink-0">{label}</dt>
                          <dd className="font-medium text-gray-800">{value}</dd>
                        </div>
                      ) : null)}
                    </dl>
                  </section>

                  {patient.contact_urgence?.nom && (
                    <section>
                      <h4 className="font-bold text-sm text-gray-700 mb-3">🆘 Contact d'urgence</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex gap-2"><dt className="text-gray-400 w-28">Nom</dt><dd className="font-medium">{patient.contact_urgence.nom}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-28">Relation</dt><dd className="font-medium">{patient.contact_urgence.relation}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-28">Téléphone</dt><dd className="font-medium">{patient.contact_urgence.telephone}</dd></div>
                      </dl>
                    </section>
                  )}

                  {patient.assurance?.compagnie && (
                    <section>
                      <h4 className="font-bold text-sm text-gray-700 mb-3">🏥 Assurance</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex gap-2"><dt className="text-gray-400 w-36">Compagnie</dt><dd className="font-medium">{patient.assurance.compagnie}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-36">N° Police</dt><dd className="font-medium">{patient.assurance.numero_police}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-36">Taux couverture</dt><dd className="font-medium">{patient.assurance.taux}%</dd></div>
                      </dl>
                    </section>
                  )}
                </div>
              )}

              {/* ── Rendez-vous ─────────────────────────────────────────── */}
              {tab === 'rdv' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/appointments" label="Voir tous les RDV" />
                  </div>
                  {!data.rdv?.appointments?.length
                    ? <Empty msg="Aucun rendez-vous enregistré pour ce patient." />
                    : data.rdv.appointments.map(a => (
                        <div key={a._id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-base flex-shrink-0">📅</div>
                            <div>
                              <div className="font-semibold text-sm">{a.motif || 'Consultation'}</div>
                              <div className="text-xs text-gray-400">{fmtT(a.date_heure)} · {a.type}</div>
                              {a.medecin && <div className="text-xs text-gray-400">Dr. {a.medecin.prenom} {a.medecin.nom}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge statut={a.statut} />
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {/* ── Consultations ───────────────────────────────────────── */}
              {tab === 'consult' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/consultations" label="Module Consultations" />
                  </div>
                  {!data.consult?.consultations?.length
                    ? <Empty msg="Aucune consultation enregistrée pour ce patient." />
                    : data.consult.consultations.map(c => (
                        <div key={c._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">🩺 {fmtT(c.date_consultation)}</span>
                            <div className="flex items-center gap-2">
                              {c.ia_suggestions?.length > 0 && <span className="ai-badge">🤖 IA</span>}
                              <StatusBadge statut={c.statut} />
                            </div>
                          </div>
                          {c.diagnostic && <p className="text-sm text-gray-700"><strong>Diagnostic :</strong> {c.diagnostic}</p>}
                          {c.motif && !c.diagnostic && <p className="text-sm text-gray-600">Motif : {c.motif}</p>}
                          {c.signes_vitaux && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {c.signes_vitaux.tension_systolique && <span className="badge badge-blue">TA {c.signes_vitaux.tension_systolique}/{c.signes_vitaux.tension_diastolique}</span>}
                              {c.signes_vitaux.pouls            && <span className="badge badge-gray">♥ {c.signes_vitaux.pouls} bpm</span>}
                              {c.signes_vitaux.temperature      && <span className="badge badge-orange">🌡️ {c.signes_vitaux.temperature}°C</span>}
                              {c.signes_vitaux.spo2             && <span className="badge badge-cyan">SpO2 {c.signes_vitaux.spo2}%</span>}
                            </div>
                          )}
                          {c.medecin && <div className="text-xs text-gray-400 mt-1">Dr. {c.medecin.prenom} {c.medecin.nom}</div>}
                        </div>
                      ))}
                </div>
              )}

              {/* ── Hospitalisations ────────────────────────────────────── */}
              {tab === 'hospi' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/hospitalization" label="Module Hospitalisation" />
                  </div>
                  {!(data.hospi?.hospitalizations?.length || data.hospi?.hospitalisations?.length)
                    ? <Empty msg="Aucune hospitalisation enregistrée pour ce patient." />
                    : (data.hospi?.hospitalizations || data.hospi?.hospitalisations || []).map(h => (
                        <div key={h._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">🛏️ {h.chambre?.numero ? `Chambre ${h.chambre.numero}` : 'Chambre'}{h.lit_numero ? ` — Lit ${h.lit_numero}` : ''}</span>
                            <StatusBadge statut={h.statut} />
                          </div>
                          {h.motif_entree && <p className="text-sm text-gray-600">{h.motif_entree}</p>}
                          <div className="text-xs text-gray-400 mt-1">
                            Entrée : {fmt(h.date_entree)}{h.date_sortie && ` · Sortie : ${fmt(h.date_sortie)}`}
                          </div>
                          {h.medecin_responsable && <div className="text-xs text-gray-400">Dr. {h.medecin_responsable.prenom} {h.medecin_responsable.nom}</div>}
                        </div>
                      ))}
                </div>
              )}

              {/* ── Ordonnances ─────────────────────────────────────────── */}
              {tab === 'ordos' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/prescriptions" label="Module Ordonnances" />
                  </div>
                  {!data.ordos?.ordonnances?.length && !data.ordos?.prescriptions?.length
                    ? <Empty msg="Aucune ordonnance enregistrée pour ce patient." />
                    : (data.ordos?.ordonnances || data.ordos?.prescriptions || []).map(o => (
                        <div key={o._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-blue-700">{o.numero_rx || o.numero}</span>
                            <StatusBadge statut={o.statut} />
                          </div>
                          {o.diagnostic && <p className="text-sm text-gray-700"><strong>Diagnostic :</strong> {o.diagnostic}</p>}
                          <div className="text-xs text-gray-400 mt-1">
                            {(o.medicaments || o.lignes || []).length} médicament(s) · {fmt(o.date_prescription)}
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {/* ── Laboratoire ─────────────────────────────────────────── */}
              {tab === 'labo' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/laboratory" label="Module Laboratoire" />
                  </div>
                  {!data.labo?.results?.length
                    ? <Empty msg="Aucun résultat de laboratoire pour ce patient." />
                    : data.labo.results.map(r => (
                        <div key={r._id} className={`p-4 rounded-xl border ${r.est_critique ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm">{r.examen?.nom || r.type_examen || 'Analyse'}</span>
                              {r.est_critique && <span className="badge badge-red ml-2">🚨 Critique</span>}
                            </div>
                            <StatusBadge statut={r.statut} />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{fmt(r.date_prescription || r.date_demande)}</div>
                          {r.medecin_prescripteur && <div className="text-xs text-gray-400">Prescrit par Dr. {r.medecin_prescripteur.prenom} {r.medecin_prescripteur.nom}</div>}
                        </div>
                      ))}
                </div>
              )}

              {/* ── Imagerie ────────────────────────────────────────────── */}
              {tab === 'imagerie' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/radiology" label="Module Imagerie" />
                  </div>
                  {!data.imagerie?.results?.length
                    ? <Empty msg="Aucun examen d'imagerie pour ce patient." />
                    : data.imagerie.results.map(r => (
                        <div key={r._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm">
                                {r._source === 'echographie' ? '🩻 Échographie' : (r.type_examen || 'Imagerie')}
                                {r.region_anatomique ? ` — ${r.region_anatomique}` : (r.sous_type ? ` — ${r.sous_type}` : '')}
                              </span>
                              {r.anomalie_detectee && <span className="badge badge-red ml-2">⚠️ Anomalie</span>}
                            </div>
                            <StatusBadge statut={r.statut} />
                          </div>
                          {(r.motif || r.conclusion) && <p className="text-sm text-gray-600 mt-1">{r.conclusion || r.motif}</p>}
                          <div className="text-xs text-gray-400 mt-1">{fmt(r.date_prescription || r.date_rdv || r.createdAt)}</div>
                        </div>
                      ))}
                </div>
              )}

              {/* ── Urgences ────────────────────────────────────────────── */}
              {tab === 'urgences' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/urgences" label="Module Urgences" />
                  </div>
                  {!data.urgences?.urgences?.length
                    ? <Empty msg="Aucun passage aux urgences pour ce patient." />
                    : data.urgences.urgences.map(u => (
                        <div key={u._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-red-600">{u.numero}</span>
                            <StatusBadge statut={u.statut} />
                          </div>
                          {u.motif && <p className="text-sm text-gray-700">Motif : {u.motif}</p>}
                          <div className="text-xs text-gray-400 mt-1">
                            Arrivée : {fmtT(u.date_arrivee)}
                            {u.niveau_triage && <span className="ml-2 font-semibold" style={{ color: u.niveau_triage==='rouge'?'#DC2626':u.niveau_triage==='orange'?'#EA580C':u.niveau_triage==='jaune'?'#D97706':'#16A34A' }}>● Triage {u.niveau_triage.toUpperCase()}</span>}
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {/* ── Chirurgie ───────────────────────────────────────────── */}
              {tab === 'chirurgie' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/chirurgie" label="Module Chirurgie" />
                  </div>
                  {!data.chirurgie?.dossiers?.length && !data.chirurgie?.surgeries?.length
                    ? <Empty msg="Aucun dossier chirurgical pour ce patient." />
                    : (data.chirurgie?.dossiers || data.chirurgie?.surgeries || []).map(d => (
                        <div key={d._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-blue-700">{d.numero}</span>
                            <StatusBadge statut={d.statut} />
                          </div>
                          {d.diagnostic_chirurgical && <p className="text-sm text-gray-700"><strong>Diagnostic :</strong> {d.diagnostic_chirurgical}</p>}
                          {d.type_intervention && <p className="text-sm text-gray-600">Intervention : {d.type_intervention}</p>}
                          <div className="text-xs text-gray-400 mt-1">
                            {d.date_intervention_prev && `Prévu : ${fmt(d.date_intervention_prev)}`}
                            {d.chirurgien_nom && ` · Dr. ${d.chirurgien_nom}`}
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {/* ── Factures ────────────────────────────────────────────── */}
              {tab === 'factures' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <OpenBtn to="/finance" label="Module Finance" />
                  </div>
                  {!data.factures?.invoices?.length && !data.factures?.factures?.length
                    ? <Empty msg="Aucune facture pour ce patient." />
                    : (data.factures?.invoices || data.factures?.factures || []).map(f => (
                        <div key={f._id} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-700">{f.numero_facture}</span>
                            <div className="text-sm mt-0.5 text-gray-500">{fmt(f.date_facture)}</div>
                          </div>
                          <div className="text-right flex-1">
                            <div className="font-bold text-gray-900">{f.montant_ttc?.toLocaleString('fr-FR')} FCFA</div>
                            {f.montant_restant > 0 && (
                              <div className="text-xs text-red-500">Reste : {f.montant_restant?.toLocaleString('fr-FR')} FCFA</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge statut={f.statut} />
                            <button
                              onClick={() => navigate(`/finance/${f._id}/print`)}
                              style={{ fontSize:11, padding:'3px 8px', background:'#F0FDF4', color:'#166534', border:'1px solid #BBF7D0', borderRadius:6, cursor:'pointer', fontWeight:700 }}
                            >
                              🖨️
                            </button>
                          </div>
                        </div>
                      ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* ── Modal Modifier ──────────────────────────────────────────────────── */}
      {modal === 'edit' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(11,30,59,.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setModal(null)}>
          <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(11,30,59,.22)' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#0B1E3B,#1B4F9E)', padding:'18px 24px', borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:16 }}>✏️ Modifier le patient</div>
              <button onClick={() => setModal(null)} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:18 }}>

              {/* Identité */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B7A99', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Identité</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[['Prénom *','prenom','text'],['Nom *','nom','text'],['Date de naissance','date_naissance','date'],['Téléphone','telephone','tel'],['Email','email','email']].map(([lbl, key, type]) => (
                    <div key={key} style={{ gridColumn: key==='email' ? '1/-1' : undefined }}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{lbl}</label>
                      <input type={type} value={editForm[key]||''} onChange={e => setEditForm(f => ({...f,[key]:e.target.value}))}
                        style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E2EAF4', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor='#1B4F9E'} onBlur={e=>e.target.style.borderColor='#E2EAF4'}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Sexe</label>
                    <select value={editForm.sexe||''} onChange={e=>setEditForm(f=>({...f,sexe:e.target.value}))}
                      style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E2EAF4', borderRadius:8, fontSize:13, fontFamily:'inherit', background:'#fff' }}>
                      <option value="">— Sélectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Groupe sanguin</label>
                    <select value={editForm.groupe_sanguin||''} onChange={e=>setEditForm(f=>({...f,groupe_sanguin:e.target.value}))}
                      style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E2EAF4', borderRadius:8, fontSize:13, fontFamily:'inherit', background:'#fff' }}>
                      <option value="">—</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B7A99', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Adresse</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[['Rue','adresse_rue'],['Ville','adresse_ville'],['Pays','adresse_pays']].map(([lbl,key])=>(
                    <div key={key}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{lbl}</label>
                      <input value={editForm[key]||''} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}
                        style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E2EAF4', borderRadius:8, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor='#1B4F9E'} onBlur={e=>e.target.style.borderColor='#E2EAF4'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact urgence */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B7A99', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Contact d'urgence</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[['Nom','contact_nom'],['Relation','contact_relation'],['Téléphone','contact_tel']].map(([lbl,key])=>(
                    <div key={key}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{lbl}</label>
                      <input value={editForm[key]||''} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}
                        style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E2EAF4', borderRadius:8, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor='#1B4F9E'} onBlur={e=>e.target.style.borderColor='#E2EAF4'}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding:'14px 24px', borderTop:'1.5px solid #EEF4FF', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setModal(null)} style={{ padding:'8px 20px', border:'1.5px solid #E2EAF4', borderRadius:10, background:'#F8FAFD', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button onClick={handleUpdate} disabled={saving}
                style={{ padding:'8px 24px', background:'linear-gradient(135deg,#0B1E3B,#1B4F9E)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1 }}>
                {saving ? '⏳ Enregistrement...' : '✅ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Supprimer ─────────────────────────────────────────────────── */}
      {modal === 'delete' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(11,30,59,.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setModal(null)}>
          <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:420, boxShadow:'0 24px 64px rgba(11,30,59,.22)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,#7F1D1D,#DC2626)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:16 }}>🗑️ Supprimer le patient</div>
              <button onClick={() => setModal(null)} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:24 }}>
              <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:12, padding:16, marginBottom:20 }}>
                <p style={{ margin:0, fontSize:14, color:'#991B1B', fontWeight:600, lineHeight:1.5 }}>
                  ⚠️ Cette action est <strong>irréversible</strong>. Le dossier de <strong>{patient.prenom} {patient.nom}</strong> ({patient.numero_dossier}) sera définitivement supprimé.
                </p>
              </div>
              <p style={{ fontSize:13, color:'#6B7280', margin:'0 0 20px' }}>Toutes les données associées (consultations, ordonnances, résultats) resteront dans leurs modules respectifs mais ne seront plus liées à ce patient.</p>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setModal(null)} style={{ padding:'8px 20px', border:'1.5px solid #E2EAF4', borderRadius:10, background:'#F8FAFD', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>Annuler</button>
                <button onClick={handleDelete} disabled={saving}
                  style={{ padding:'8px 24px', background:'linear-gradient(135deg,#7F1D1D,#DC2626)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1 }}>
                  {saving ? '⏳ Suppression...' : '🗑️ Confirmer la suppression'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
