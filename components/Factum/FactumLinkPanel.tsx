"use client";
import { useCallback, useEffect, useState } from "react";

interface State {
  link: { appId: string } | null;
  hubFound: boolean;
  hubIds: string[];
  defaultAppId: string;
}

async function call<T = unknown>(url: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json as T;
}

export default function FactumLinkPanel() {
  const [state, setState] = useState<State | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setState(await call<State>("/api/factum"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (!state) return error ? <p className="text-danger">{error}</p> : <p className="text-muted">Chargement…</p>;

  const { link } = state;

  if (link && !editing) {
    return (
      <div className="card border-0 shadow-sm rounded-3 p-3">
        <h2 className="h5">Factum lié</h2>
        <p className="text-muted mb-2">
          Application « {link.appId} » dans Triviae. Dans la vue d'un mois du budget, le bouton « Ajouter facture de Factum »
          permet de choisir les factures à ajouter.
        </p>
        {error && <p className="text-danger mb-2">{error}</p>}
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setEditing(true)}>
            Modifier
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            disabled={busy}
            onClick={() => {
              if (confirm("Délier Factum ? Les lignes déjà ajoutées au budget restent (Factum, lui, n'est pas touché).")) {
                run(() => call("/api/factum", "DELETE"));
              }
            }}
          >
            Délier
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="card border-0 shadow-sm rounded-3 p-3 d-flex flex-column gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const appId = new FormData(e.currentTarget).get("appId");
        run(() => call("/api/factum", "POST", { appId }));
      }}
    >
      <h2 className="h5 mb-0">{link ? "Modifier le lien" : "Lier Factum"}</h2>
      <div>
        <label className="form-label">Identifiant dans Triviae</label>
        <input
          name="appId"
          className="form-control"
          list="hub-ids"
          required
          defaultValue={link ? link.appId : (state.hubIds.find((id) => id.includes("factum")) ?? state.defaultAppId)}
          placeholder="ex. factum"
          autoCapitalize="none"
        />
        <datalist id="hub-ids">{state.hubIds.map((id) => <option key={id} value={id} />)}</datalist>
      </div>
      <p className="text-muted mb-0">
        {state.hubFound
          ? state.hubIds.length
            ? `Applications trouvées dans Triviae : ${state.hubIds.join(", ")}.`
            : "Aucune application installée dans Triviae."
          : "Triviae n'a pas été trouvé depuis le budget (variable HUB_URL si le port est inhabituel)."}
      </p>
      {error && <p className="text-danger mb-0">{error}</p>}
      <div className="d-flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Vérification…" : "Lier"}</button>
        {link && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(false)}>Annuler</button>}
      </div>
    </form>
  );
}
