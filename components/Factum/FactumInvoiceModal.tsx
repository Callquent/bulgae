"use client";
import { useEffect, useMemo, useState } from "react";

interface Invoice { id: string; company: string; amount: string; date: string; reference: string; added: boolean }
interface Data {
  invoices: Invoice[];
  accounts: { id: number; name: string }[];
  categories: { id: number; name: string }[];
}

const fmt = (n: string | number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function FactumInvoiceModal({
  year, month, monthLabel, onClose, onAdded,
}: {
  year: number; month: number; monthLabel: string; onClose: () => void; onAdded: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notLinked, setNotLinked] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/factum/invoices?year=${year}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotLinked(res.status === 409);
          throw new Error(json.error ?? `Erreur ${res.status}`);
        }
        setData(json);
        if (json.accounts.length === 1) setAccountId(String(json.accounts[0].id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    })();
  }, [year]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.invoices ?? []).filter((i) => !q || `${i.company} ${i.reference} ${i.date} ${i.amount}`.toLowerCase().includes(q));
  }, [data, search]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const total = (data?.invoices ?? []).filter((i) => selected.includes(i.id)).reduce((n, i) => n + Number(i.amount), 0);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/factum/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: selected, accountId, categoryId, year, month }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-receipt me-2"></i>Ajouter des factures de Factum — {monthLabel} {year}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {!data && !error && (
                <div className="text-center text-muted py-4">
                  <span className="spinner-border spinner-border-sm me-2"></span>Chargement…
                </div>
              )}
              {error && (
                <p className="text-danger">
                  {error}{" "}
                  {notLinked && <>Ouvrez Triviae &gt; Liens pour lier le budget à Factum.</>}
                </p>
              )}
              {data && (
                <>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small text-muted">Compte</label>
                      <select className="form-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        <option value="" disabled>Choisir…</option>
                        {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small text-muted">Catégorie</label>
                      <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="" disabled>Choisir…</option>
                        {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <input
                    className="form-control mb-2"
                    placeholder="Rechercher (entreprise, référence, montant, date)…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {data.invoices.length === 0 ? (
                    <p className="text-muted">Aucune facture dans Factum pour cette période.</p>
                  ) : (
                    <div className="list-group">
                      {shown.map((i) => (
                        <label key={i.id} className={`list-group-item d-flex align-items-center gap-2 ${i.added ? "text-muted" : ""}`}>
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            disabled={i.added}
                            checked={selected.includes(i.id)}
                            onChange={() => toggle(i.id)}
                          />
                          <span className="flex-grow-1">
                            {i.company}
                            {i.reference && <span className="text-muted"> — {i.reference}</span>}
                            <br />
                            <small className="text-muted">{new Date(i.date).toLocaleDateString("fr-FR")}</small>
                          </span>
                          {i.added && <span className="badge text-bg-light">déjà ajoutée</span>}
                          <strong>{fmt(i.amount)} €</strong>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <span className="me-auto text-muted small">
                {selected.length > 0 && `${selected.length} facture${selected.length > 1 ? "s" : ""} · ${fmt(total)} €`}
              </span>
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || selected.length === 0 || !accountId || !categoryId}
                onClick={save}
              >
                {saving ? "Ajout…" : `Ajouter (${selected.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
