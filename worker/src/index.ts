interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

interface LineageRow {
  lineage_id: string;
  project_name: string;
  generation: number;
  payload: string;
  updated_at: number;
}

interface ChampionRow {
  lineage_id: string;
  family: string;
  generation: number;
  fitness: number;
  payload: string;
  updated_at: number;
}

// Constant-time comparison: `!==` on strings short-circuits at the first
// mismatched character, letting response timing leak how many leading
// characters of a guessed token were correct. No nodejs_compat flag is set
// here, so Node's crypto.timingSafeEqual isn't available - this manually
// XORs every byte regardless of where a mismatch occurs.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function isFiniteDeep(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFiniteDeep);
  if (value !== null && typeof value === "object") {
    return Object.values(value).every(isFiniteDeep);
  }
  return true;
}

// A lineage row is the body-shell project shell; each of its champions is a
// separate row (owner request, 2026-07-16) referencing it by lineage_id.
// Reassembled here so the client's LineageRecord shape (shell + nested
// champions array) never has to change - only the storage is normalized.
async function handleGetLineages(env: Env): Promise<Response> {
  const [{ results: lineages }, { results: champions }] = await Promise.all([
    env.DB.prepare("SELECT lineage_id, project_name, generation, payload, updated_at FROM lineages").all<LineageRow>(),
    env.DB.prepare("SELECT lineage_id, family, generation, fitness, payload, updated_at FROM champions").all<ChampionRow>(),
  ]);

  const championsByLineage = new Map<string, unknown[]>();
  for (const row of champions) {
    const list = championsByLineage.get(row.lineage_id) ?? [];
    list.push(JSON.parse(row.payload));
    championsByLineage.set(row.lineage_id, list);
  }

  const merged = lineages.map(row => ({
    ...JSON.parse(row.payload) as Record<string, unknown>,
    champions: championsByLineage.get(row.lineage_id) ?? [],
  }));

  return Response.json(merged);
}

async function handlePostLineage(request: Request, env: Env, lineageId: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(token, env.API_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { projectName: string; generation: number; payload: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Rejected: malformed JSON body", { status: 400 });
  }

  if (!Number.isFinite(body.generation) || !isFiniteDeep(body.payload)) {
    return new Response("Rejected: non-finite numeric field in payload", { status: 400 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO lineages (lineage_id, project_name, generation, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(lineage_id) DO UPDATE SET
       project_name = excluded.project_name,
       generation = excluded.generation,
       payload = excluded.payload,
       updated_at = excluded.updated_at
     WHERE excluded.generation > lineages.generation`
  )
    .bind(lineageId, body.projectName ?? "Unnamed Project", body.generation, JSON.stringify(body.payload), Date.now())
    .run();

  if (result.meta.changes === 0) {
    return new Response("Rejected: incoming generation is not newer than stored generation", { status: 409 });
  }

  return Response.json({ lineageId, generation: body.generation });
}

async function handlePostChampion(request: Request, env: Env, lineageId: string, family: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(token, env.API_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { generation: number; fitness: number; payload: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Rejected: malformed JSON body", { status: 400 });
  }

  if (!Number.isFinite(body.generation) || !Number.isFinite(body.fitness) || !isFiniteDeep(body.payload)) {
    return new Response("Rejected: non-finite numeric field in payload", { status: 400 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO champions (lineage_id, family, generation, fitness, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(lineage_id, family) DO UPDATE SET
       generation = excluded.generation,
       fitness = excluded.fitness,
       payload = excluded.payload,
       updated_at = excluded.updated_at
     WHERE excluded.generation > champions.generation`
  )
    .bind(lineageId, family, body.generation, body.fitness, JSON.stringify(body.payload), Date.now())
    .run();

  if (result.meta.changes === 0) {
    return new Response("Rejected: incoming generation is not newer than stored generation", { status: 409 });
  }

  return Response.json({ lineageId, family, generation: body.generation });
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const key in CORS_HEADERS) headers.set(key, CORS_HEADERS[key]);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/lineages") {
      return withCors(await handleGetLineages(env));
    }

    const lineagePostMatch = url.pathname.match(/^\/lineages\/([^/]+)$/);
    if (request.method === "POST" && lineagePostMatch) {
      return withCors(await handlePostLineage(request, env, lineagePostMatch[1]));
    }

    const championPostMatch = url.pathname.match(/^\/lineages\/([^/]+)\/champions\/([^/]+)$/);
    if (request.method === "POST" && championPostMatch) {
      return withCors(await handlePostChampion(request, env, championPostMatch[1], championPostMatch[2]));
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
};
