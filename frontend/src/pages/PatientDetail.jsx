import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Spinner from '../components/UI/Spinner';
import { StatusBadge } from '../components/UI/Badge';

const TABS = [
  { id:'info',     label:'Informations',  icon:'👤' },
  { id:'rdv',      label:'Rendez-vous',   icon:'📅' },
  { id:'consult',  label:'Consultations', icon:'🩺' },
  { id:'hospi',    label:'Hospitalisations', icon:'🛏️' },
  { id:'labo',     label:'Laboratoire',   icon:'🔬' },
  { id:'imagerie', label:'Imagerie',      icon:'🩻' },
  { id:'factures', label:'Factures',      icon:'💰' },
];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState('info');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const { data: res } = await api.get(`/patients/${id}`);
        setPatient(res.patient);
      } catch { navigate('/patients'); }
      finally { setLoading(false); }
    };
    fetchPatient();
  }, [id, navigate]);

  useEffect(() => {
    if (!patient) return;
    setTabLoading(true);
    const calls = {
      rdv:      () => api.get(`/appointments?patient=${id}&limit=10`),
      consult:  () => api.get(`/consultations?patient=${id}&limit=10`),
      hospi:    () => api.get(`/hospitalization?patient=${id}&limit=10`),
      labo:     () => api.get(`/laboratory?patient=${id}&limit=10`),
      imagerie: () => api.get(`/radiology?patient=${id}&limit=10`),
      factures: () => api.get(`/finance?patient=${id}&limit=10`),
    };
    if (calls[tab]) {
      calls[tab]().then(r => setData(d => ({ ...d, [tab]: r.data }))).finally(() => setTabLoading(false));
    } else {
      setTabLoading(false);
    }
  }, [tab, patient, id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!patient) return null;

  const age = patient.date_naissance
    ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 86400000))
    : null;

  const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/patients')} className="hover:text-blue-600">👥 Patients</button>
        <span>›</span>
        <span className="text-gray-900 font-semibold">{patient.nom} {patient.prenom}</span>
      </div>

      {/* Patient card header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start gap-6">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl flex-shrink-0">
            {patient.sexe === 'F' ? '👩' : '👨'}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{patient.nom} {patient.prenom}</h1>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{patient.numero_dossier}</span>
              <StatusBadge statut={patient.statut} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {age && <span>🎂 {age} ans ({fmt(patient.date_naissance)})</span>}
              <span>{patient.sexe === 'M' ? '♂️ Masculin' : '♀️ Féminin'}</span>
              {patient.telephone && <span>📞 {patient.telephone}</span>}
              {patient.email && <span>✉️ {patient.email}</span>}
            </div>
          </div>

          {/* Vital badges */}
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
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex overflow-x-auto gap-0 border-b border-gray-100 px-2 pt-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-xl transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tabLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <>
              {/* Info tab */}
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section>
                    <h4 className="font-bold text-sm text-gray-700 mb-3">📋 Informations personnelles</h4>
                    <dl className="space-y-2 text-sm">
                      {[
                        ['Adresse', [patient.adresse?.rue, patient.adresse?.ville, patient.adresse?.pays].filter(Boolean).join(', ')],
                        ['Groupe sanguin', patient.groupe_sanguin],
                        ['Médecin référent', patient.medecin_referent ? `${patient.medecin_referent.prenom} ${patient.medecin_referent.nom}` : null],
                      ].map(([label, value]) => value ? (
                        <div key={label} className="flex gap-2">
                          <dt className="text-gray-400 w-32 flex-shrink-0">{label}</dt>
                          <dd className="font-medium text-gray-800">{value}</dd>
                        </div>
                      ) : null)}
                    </dl>
                  </section>

                  {patient.contact_urgence?.nom && (
                    <section>
                      <h4 className="font-bold text-sm text-gray-700 mb-3">🆘 Contact d'urgence</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex gap-2"><dt className="text-gray-400 w-24">Nom</dt><dd className="font-medium">{patient.contact_urgence.nom}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-24">Relation</dt><dd className="font-medium">{patient.contact_urgence.relation}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-24">Téléphone</dt><dd className="font-medium">{patient.contact_urgence.telephone}</dd></div>
                      </dl>
                    </section>
                  )}

                  {patient.assurance?.compagnie && (
                    <section>
                      <h4 className="font-bold text-sm text-gray-700 mb-3">🏥 Assurance</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex gap-2"><dt className="text-gray-400 w-32">Compagnie</dt><dd className="font-medium">{patient.assurance.compagnie}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-32">N° Police</dt><dd className="font-medium">{patient.assurance.numero_police}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-400 w-32">Taux couverture</dt><dd className="font-medium">{patient.assurance.taux}%</dd></div>
                      </dl>
                    </section>
                  )}
                </div>
              )}

              {/* RDV tab */}
              {tab === 'rdv' && (
                <div className="space-y-3">
                  {!data.rdv?.appointments?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucun rendez-vous.</p>
                    : data.rdv.appointments.map(a => (
                        <div key={a._id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-base">📅</div>
                            <div>
                              <div className="font-semibold text-sm">{a.motif}</div>
                              <div className="text-xs text-gray-400">{new Date(a.date_heure).toLocaleString('fr-FR')} • {a.type}</div>
                            </div>
                          </div>
                          <StatusBadge statut={a.statut} />
                        </div>
                      ))}
                </div>
              )}

              {/* Consultations tab */}
              {tab === 'consult' && (
                <div className="space-y-3">
                  {!data.consult?.consultations?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucune consultation.</p>
                    : data.consult.consultations.map(c => (
                        <div key={c._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">🩺 {fmt(c.date_consultation)}</span>
                            <div className="flex items-center gap-2">
                              {c.ia_suggestions?.length > 0 && <span className="ai-badge">🤖 IA</span>}
                              <StatusBadge statut={c.statut} />
                            </div>
                          </div>
                          {c.diagnostic && <p className="text-sm text-gray-700"><strong>Diagnostic :</strong> {c.diagnostic}</p>}
                          {c.signes_vitaux && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {c.signes_vitaux.tension_systolique && <span className="badge badge-blue">TA {c.signes_vitaux.tension_systolique}/{c.signes_vitaux.tension_diastolique}</span>}
                              {c.signes_vitaux.pouls && <span className="badge badge-gray">♥ {c.signes_vitaux.pouls} bpm</span>}
                              {c.signes_vitaux.temperature && <span className="badge badge-orange">🌡️ {c.signes_vitaux.temperature}°C</span>}
                              {c.signes_vitaux.spo2 && <span className="badge badge-cyan">SpO2 {c.signes_vitaux.spo2}%</span>}
                            </div>
                          )}
                        </div>
                      ))}
                </div>
              )}

              {/* Hospitalisations tab */}
              {tab === 'hospi' && (
                <div className="space-y-3">
                  {!data.hospi?.hospitalizations?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucune hospitalisation.</p>
                    : data.hospi.hospitalizations.map(h => (
                        <div key={h._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">🛏️ {h.chambre?.numero} — Lit {h.lit_numero}</span>
                            <StatusBadge statut={h.statut} />
                          </div>
                          <p className="text-sm text-gray-600">{h.motif_entree}</p>
                          <div className="text-xs text-gray-400 mt-1">
                            Entrée : {fmt(h.date_entree)} {h.date_sortie && `• Sortie : ${fmt(h.date_sortie)}`}
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {/* Labo tab */}
              {tab === 'labo' && (
                <div className="space-y-3">
                  {!data.labo?.results?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucun résultat de laboratoire.</p>
                    : data.labo.results.map(r => (
                        <div key={r._id} className={`p-4 rounded-xl border ${r.est_critique ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm">{r.examen?.nom}</span>
                              {r.est_critique && <span className="badge badge-red ml-2">🚨 Critique</span>}
                            </div>
                            <StatusBadge statut={r.statut} />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{fmt(r.date_prescription)}</div>
                        </div>
                      ))}
                </div>
              )}

              {/* Imagerie tab */}
              {tab === 'imagerie' && (
                <div className="space-y-3">
                  {!data.imagerie?.results?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucun examen d'imagerie.</p>
                    : data.imagerie.results.map(r => (
                        <div key={r._id} className="p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm">{r.type_examen} — {r.region_anatomique || '—'}</span>
                              {r.anomalie_detectee && <span className="badge badge-red ml-2">⚠️ Anomalie</span>}
                            </div>
                            <StatusBadge statut={r.statut} />
                          </div>
                          {r.conclusion && <p className="text-sm text-gray-600 mt-1">{r.conclusion}</p>}
                          <div className="text-xs text-gray-400 mt-1">{fmt(r.date_prescription)}</div>
                        </div>
                      ))}
                </div>
              )}

              {/* Factures tab */}
              {tab === 'factures' && (
                <div className="space-y-3">
                  {!data.factures?.invoices?.length
                    ? <p className="text-gray-400 text-sm text-center py-8">Aucune facture.</p>
                    : data.factures.invoices.map(f => (
                        <div key={f._id} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-700">{f.numero_facture}</span>
                            <div className="text-sm mt-0.5">{fmt(f.date_facture)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{f.montant_ttc?.toLocaleString('fr-FR')} FCFA</div>
                            {f.montant_restant > 0 && <div className="text-xs text-red-500">Reste: {f.montant_restant?.toLocaleString('fr-FR')}</div>}
                          </div>
                          <StatusBadge statut={f.statut} />
                        </div>
                      ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
