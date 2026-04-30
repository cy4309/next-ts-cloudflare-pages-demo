import { getCloudflareEnv } from "@/lib/cf/env";

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

export type Todo = {
  id: number;
  content: string;
  created_at: string;
  image_url: string | null;
};

type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function queryD1Rest<T>(
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
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, error: `D1 API HTTP ${res.status}` };
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
    return { ok: false, error: row?.error ?? "D1 query failed" };
  }

  return {
    ok: true,
    results: row.results ?? [],
    lastRowId: row.meta?.last_row_id,
  };
}

export async function listTodos(): Promise<ServiceResult<Todo[]>> {
  const env = await getCloudflareEnv();
  if (env?.DB) {
    const result = await env.DB.prepare<Todo>(
      "SELECT id, content, created_at, image_url FROM todos ORDER BY id DESC"
    ).all();
    return { ok: true, data: result.results ?? [] };
  }

  const fallback = await queryD1Rest<Todo>(
    "SELECT id, content, created_at, image_url FROM todos ORDER BY id DESC"
  );
  if (!fallback.ok) return { ok: false, error: fallback.error };
  return { ok: true, data: fallback.results ?? [] };
}

export async function createTodo(
  content: string,
  imageUrl: string | null
): Promise<ServiceResult<{ id: number | null }>> {
  const env = await getCloudflareEnv();
  if (env?.DB) {
    const runResult = await env.DB.prepare(
      "INSERT INTO todos (content, created_at, image_url) VALUES (?, datetime('now'), ?)"
    )
      .bind(content, imageUrl)
      .run();

    return {
      ok: true,
      data: { id: runResult.meta?.last_row_id ?? null },
    };
  }

  const fallback = await queryD1Rest(
    "INSERT INTO todos (content, created_at, image_url) VALUES (?, datetime('now'), ?)",
    [content, imageUrl]
  );
  if (!fallback.ok) return { ok: false, error: fallback.error };
  return { ok: true, data: { id: fallback.lastRowId ?? null } };
}

export async function updateTodo(
  id: number,
  content: string
): Promise<ServiceResult<null>> {
  const env = await getCloudflareEnv();
  if (env?.DB) {
    await env.DB.prepare("UPDATE todos SET content = ? WHERE id = ?")
      .bind(content, id)
      .run();
    return { ok: true, data: null };
  }

  const fallback = await queryD1Rest("UPDATE todos SET content = ? WHERE id = ?", [
    content,
    id,
  ]);
  if (!fallback.ok) return { ok: false, error: fallback.error };
  return { ok: true, data: null };
}

export async function deleteTodo(id: number): Promise<ServiceResult<null>> {
  const env = await getCloudflareEnv();
  if (env?.DB) {
    await env.DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
    return { ok: true, data: null };
  }

  const fallback = await queryD1Rest("DELETE FROM todos WHERE id = ?", [id]);
  if (!fallback.ok) return { ok: false, error: fallback.error };
  return { ok: true, data: null };
}

export async function getTodoImageUrl(
  id: number
): Promise<ServiceResult<string | null>> {
  const env = await getCloudflareEnv();
  if (env?.DB) {
    const row = await env.DB.prepare<{ image_url: string | null }>(
      "SELECT image_url FROM todos WHERE id = ? LIMIT 1"
    )
      .bind(id)
      .first<{ image_url: string | null }>();
    return { ok: true, data: row?.image_url ?? null };
  }

  const fallback = await queryD1Rest<{ image_url: string | null }>(
    "SELECT image_url FROM todos WHERE id = ? LIMIT 1",
    [id]
  );
  if (!fallback.ok) return { ok: false, error: fallback.error };
  return { ok: true, data: fallback.results?.[0]?.image_url ?? null };
}
