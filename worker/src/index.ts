interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

interface ChampionRow {
  family: string;
  generation: number;
  fitness: number;
  payload: string;
  updated_at: number;
}

function isFiniteDeep(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFiniteDeep);
  if (value !== null && typeof value === "object") {
    return Object.values(value).every(isFiniteDeep);
  }
  return true;
}

async function handleGet(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT family, generation, fitness, payload, updated_at FROM champions"
  ).all<ChampionRow>();
  return Response.json(results);
}

async function handlePost(request: Request, env: Env, family: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== env.API_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json<{ generation: number; fitness: number; payload: unknown }>();

  if (!Number.isFinite(body.generation) || !Number.isFinite(body.fitness) || !isFiniteDeep(body.payload)) {
    return new Response("Rejected: non-finite numeric field in payload", { status: 400 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO champions (family, generation, fitness, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(family) DO UPDATE SET
       generation = excluded.generation,
       fitness = excluded.fitness,
       payload = excluded.payload,
       updated_at = excluded.updated_at
     WHERE excluded.generation > champions.generation`
  )
    .bind(family, body.generation, body.fitness, JSON.stringify(body.payload), Date.now())
    .run();

  if (result.meta.changes === 0) {
    return new Response("Rejected: incoming generation is not newer than stored generation", { status: 409 });
  }

  return Response.json({ family, generation: body.generation });
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

    if (request.method === "GET" && url.pathname === "/champions") {
      return withCors(await handleGet(env));
    }

    const postMatch = url.pathname.match(/^\/champions\/([^/]+)$/);
    if (request.method === "POST" && postMatch) {
      return withCors(await handlePost(request, env, postMatch[1]));
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
};
