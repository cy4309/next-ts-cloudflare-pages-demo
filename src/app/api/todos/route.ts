import { NextResponse } from "next/server";

export const runtime = "edge";

type Todo = {
  id: number;
  content: string;
  created_at: string;
  image_url: string | null;
};

const TODOS_CACHE_KEY = "todos:list:v1";

type D1ApiSuccess<T> = {
  success: true;
  result: Array<{
    success: boolean;
    results?: T[];
    error?: string;
    meta?: {
      last_row_id?: number;
    };
  }>;
};

type D1ApiFailure = {
  success: false;
  errors: Array<{ message: string }>;
};

async function queryD1<T>(
  sql: string,
  params: unknown[] = []
): Promise<{ ok: boolean; results?: T[]; lastRowId?: number; error?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !token) {
    return {
      ok: false,
      error:
        "Missing D1 env vars. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN",
    };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      ok: false,
      error: `D1 API HTTP ${res.status}`,
    };
  }

  const payload = (await res.json()) as D1ApiSuccess<T> | D1ApiFailure;
  if (!payload.success) {
    return {
      ok: false,
      error: payload.errors[0]?.message ?? "Unknown D1 API error",
    };
  }

  const row = payload.result[0];
  if (!row?.success) {
    return {
      ok: false,
      error: row?.error ?? "D1 query failed",
    };
  }

  return {
    ok: true,
    results: row.results ?? [],
    lastRowId: row.meta?.last_row_id,
  };
}

async function readTodosCache(): Promise<Todo[] | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !token) {
    return null;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${TODOS_CACHE_KEY}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Todo[];
  } catch {
    return null;
  }
}

async function writeTodosCache(todos: Todo[]) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !token) {
    return;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${TODOS_CACHE_KEY}`;
  await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(todos),
    cache: "no-store",
  });
}

export async function invalidateTodosCache() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !token) {
    return;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${TODOS_CACHE_KEY}`;
  await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}

export async function GET() {
  const cachedTodos = await readTodosCache();
  if (cachedTodos) {
    return NextResponse.json({
      ok: true,
      todos: cachedTodos,
      source: "kv-cache",
    });
  }

  const query = await queryD1<Todo>(
    "SELECT id, content, created_at, image_url FROM todos ORDER BY id DESC"
  );
  if (!query.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: query.error ?? "Failed to query todos",
      },
      { status: 500 }
    );
  }

  await writeTodosCache(query.results ?? []);

  return NextResponse.json({
    ok: true,
    todos: query.results ?? [],
    source: "d1",
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { content?: string; imageUrl?: string };
  const content = body.content?.trim();
  const imageUrl = body.imageUrl?.trim() || null;

  if (!content) {
    return NextResponse.json(
      {
        ok: false,
        error: "content is required",
      },
      { status: 400 }
    );
  }

  const insertResult = await queryD1(
    "INSERT INTO todos (content, created_at, image_url) VALUES (?, datetime('now'), ?)",
    [content, imageUrl]
  );
  if (!insertResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: insertResult.error ?? "Failed to insert todo",
      },
      { status: 500 }
    );
  }

  await invalidateTodosCache();

  return NextResponse.json({
    ok: true,
    id: insertResult.lastRowId ?? null,
  });
}
