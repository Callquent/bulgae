// Dialogue avec Triviae (le hub) : les applications y vivent sous /apps/<identifiant>.
// Depuis le serveur du budget, le hub est joignable sur 127.0.0.1 ; son port est 8080 (ou le suivant si occupé).

const g = globalThis as typeof globalThis & { __budgetHub?: { url: string | null; at: number } };

async function ping(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/hub/ping`, { signal: AbortSignal.timeout(700), cache: "no-store" });
    return res.ok && (await res.text()).trim() === "mes-applications";
  } catch {
    return false;
  }
}

/** Adresse du hub (variable HUB_URL, sinon recherche sur les ports 8080 à 8089), ou null s'il est introuvable. */
export async function hubUrl(): Promise<string | null> {
  const cached = g.__budgetHub;
  if (cached && Date.now() - cached.at < 60_000) return cached.url;
  const fixed = process.env.HUB_URL?.replace(/\/+$/, "");
  const candidates = fixed ? [fixed] : Array.from({ length: 10 }, (_, i) => `http://127.0.0.1:${8080 + i}`);
  let found: string | null = null;
  for (const url of candidates) {
    if (await ping(url)) {
      found = url;
      break;
    }
  }
  g.__budgetHub = { url: found, at: Date.now() };
  return found;
}

export type HubApp = { id: string; status: string };

/** Applications installées dans le hub (identifiant + état), ou liste vide si le hub est introuvable. */
export async function hubApps(): Promise<HubApp[]> {
  const url = await hubUrl();
  if (!url) return [];
  try {
    const res = await fetch(`${url}/hub/status`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!res.ok) return [];
    const list = (await res.json()) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((a): a is HubApp => !!a && typeof a.id === "string")
      .map((a) => ({ id: a.id, status: String(a.status ?? "") }));
  } catch {
    return [];
  }
}
