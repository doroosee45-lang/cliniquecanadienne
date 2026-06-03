import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api';
import Spinner from '../components/UI/Spinner';
import {
  fetchInvoiceForPrint, clearInvoicePrint,
  selectPrintInvoice, selectPrintSettings, selectPrintLoading, selectPrintError,
} from '../store/slices/invoicePrintSlice';

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const printRef = useRef();

  const reduxInvoice   = useSelector(selectPrintInvoice);
  const reduxSettings  = useSelector(selectPrintSettings);
  const reduxLoading   = useSelector(selectPrintLoading);
  const reduxError     = useSelector(selectPrintError);

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dispatch(fetchInvoiceForPrint(id));
    return () => { dispatch(clearInvoicePrint()); };
  }, [dispatch, id]);

  useEffect(() => {
    if (reduxInvoice)  { setInvoice(reduxInvoice);   setLoading(false); }
    if (reduxSettings) { setSettings(reduxSettings); }
    if (reduxError)    { navigate('/finance'); }
    if (!reduxLoading && reduxInvoice !== undefined) setLoading(reduxLoading);
  }, [reduxInvoice, reduxSettings, reduxLoading, reduxError, navigate]);

  useEffect(() => {
    if (reduxInvoice !== null) return;
    const load = async () => {
      try {
        const [invRes, setRes] = await Promise.all([api.get(`/finance/${id}`), api.get('/settings')]);
        setInvoice(invRes.data.invoice);
        const s = {};
        setRes.data.settings?.forEach(x => { s[x.cle] = x.valeur; });
        setSettings(s);
      } catch { navigate('/finance'); }
      finally { setLoading(false); }
    };
    load();
  }, [id, navigate, reduxInvoice]);

  const handlePrint = () => window.print();

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!invoice) return null;

  const fmt = (n) => (n || 0).toLocaleString('fr-FR');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '—';

  return (
    <div className="space-y-4">
      {/* Actions bar — hidden on print */}
      <div className="card p-4 flex items-center justify-between no-print">
        <button onClick={() => navigate('/finance')} className="btn-secondary">← Retour</button>
        <button onClick={handlePrint} className="btn-primary">🖨️ Imprimer</button>
      </div>

      {/* Invoice document */}
      <div ref={printRef} className="card p-8 max-w-3xl mx-auto" id="invoice-print">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
            #invoice-print { box-shadow: none; border: none; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <span className="text-white text-lg">❤️</span>
              </div>
              <div>
                <div className="font-bold text-gray-900">{settings.nom_clinique || 'Clinique Canadienne de Souanké'}</div>
                <div className="text-xs text-gray-400">Soins de santé de qualité</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>📞 {settings.telephone_clinique || '+241 07 000 0000'}</div>
              <div>✉️ {settings.email_clinique || 'contact@clinique-souanke.cg'}</div>
              {settings.numero_agrement && <div>Agrément : {settings.numero_agrement}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-200 mb-1">FACTURE</div>
            <div className="font-mono text-sm font-bold text-blue-700">{invoice.numero_facture}</div>
            <div className="text-xs text-gray-400 mt-1">Émis le {fmtDate(invoice.date_facture)}</div>
            <div className="text-xs text-gray-400">Échéance : {fmtDate(invoice.date_echeance)}</div>
          </div>
        </div>

        {/* Patient info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Facturé à</h4>
            <div className="font-bold text-gray-900">{invoice.patient?.nom} {invoice.patient?.prenom}</div>
            <div className="text-sm text-gray-500">{invoice.patient?.numero_dossier}</div>
            {invoice.patient?.telephone && <div className="text-sm text-gray-500">📞 {invoice.patient.telephone}</div>}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Détails</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">N° Facture</span>
                <span className="font-semibold">{invoice.numero_facture}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold">{fmtDate(invoice.date_facture)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statut</span>
                <span className={`font-bold ${invoice.statut === 'payee' ? 'text-green-600' : invoice.montant_restant > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {invoice.statut?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold text-gray-700">Désignation</th>
              <th className="text-center py-2 font-bold text-gray-700 w-20">Qté</th>
              <th className="text-right py-2 font-bold text-gray-700 w-32">P.U.</th>
              <th className="text-right py-2 font-bold text-gray-700 w-32">Montant</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lignes?.map((l, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-2.5 px-1">
                  <div className="font-medium">{l.libelle}</div>
                  <div className="text-xs text-gray-400">{l.categorie}</div>
                </td>
                <td className="text-center py-2.5 text-gray-600">{l.quantite}</td>
                <td className="text-right py-2.5 text-gray-600">{fmt(l.prix_unitaire)} {settings.devise || 'FCFA'}</td>
                <td className="text-right py-2.5 font-semibold">{fmt(l.montant)} {settings.devise || 'FCFA'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Sous-total HT</span>
              <span className="font-medium">{fmt(invoice.montant_ht)} {settings.devise || 'FCFA'}</span>
            </div>
            {invoice.tva > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">TVA ({invoice.tva}%)</span>
                <span className="font-medium">{fmt(invoice.montant_ttc - invoice.montant_ht)} {settings.devise || 'FCFA'}</span>
              </div>
            )}
            {invoice.montant_assurance > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-100 text-green-600">
                <span>Part assurance</span>
                <span className="font-medium">-{fmt(invoice.montant_assurance)} {settings.devise || 'FCFA'}</span>
              </div>
            )}
            <div className="flex justify-between py-2 bg-gray-900 text-white rounded-xl px-3 mt-2">
              <span className="font-bold">TOTAL TTC</span>
              <span className="font-bold">{fmt(invoice.montant_ttc)} {settings.devise || 'FCFA'}</span>
            </div>
            {invoice.montant_paye > 0 && (
              <div className="flex justify-between py-1 text-green-600 mt-1">
                <span>Montant payé</span>
                <span className="font-bold">{fmt(invoice.montant_paye)} {settings.devise || 'FCFA'}</span>
              </div>
            )}
            {invoice.montant_restant > 0 && (
              <div className="flex justify-between py-1 text-red-600 font-bold">
                <span>Solde restant dû</span>
                <span>{fmt(invoice.montant_restant)} {settings.devise || 'FCFA'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments history */}
        {invoice.paiements?.length > 0 && (
          <div className="mb-6">
            <h4 className="font-bold text-sm text-gray-700 mb-2">Historique des paiements</h4>
            <div className="space-y-1">
              {invoice.paiements.map((p, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-600 py-1 border-b border-gray-50">
                  <span>{fmtDate(p.date)} — {p.mode}</span>
                  <span className="font-semibold text-green-600">+{fmt(p.montant)} {settings.devise || 'FCFA'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          <p>Merci pour votre confiance. Pour toute question, contactez-nous au {settings.telephone_clinique || '+241 07 000 0000'}.</p>
          <p className="mt-1">{settings.nom_clinique || 'Clinique Canadienne de Souanké'} — {settings.email_clinique || 'contact@clinique-souanke.cg'}</p>
        </div>
      </div>
    </div>
  );
}
