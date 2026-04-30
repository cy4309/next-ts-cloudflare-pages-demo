import { getCloudflareEnv } from "@/lib/cf/env";

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

export async function listTodos(): Promise<ServiceResult<Todo[]>> {
  const env = await getCloudflareEnv();
  if (!env?.DB) {
    return { ok: false, error: "Missing Cloudflare D1 binding: DB" };
  }

  const result = await env.DB.prepare<Todo>(
    "SELECT id, content, created_at, image_url FROM todos ORDER BY id DESC"
  ).all();
  return { ok: true, data: result.results ?? [] };
}

export async function createTodo(
  content: string,
  imageUrl: string | null
): Promise<ServiceResult<{ id: number | null }>> {
  const env = await getCloudflareEnv();
  if (!env?.DB) {
    return { ok: false, error: "Missing Cloudflare D1 binding: DB" };
  }

  const runResult = await env.DB.prepare(
    "INSERT INTO todos (content, created_at, image_url) VALUES (?, datetime('now'), ?)",
  )
    .bind(content, imageUrl)
    .run();

  return {
    ok: true,
    data: { id: runResult.meta?.last_row_id ?? null },
  };
}

export async function updateTodo(
  id: number,
  content: string
): Promise<ServiceResult<null>> {
  const env = await getCloudflareEnv();
  if (!env?.DB) {
    return { ok: false, error: "Missing Cloudflare D1 binding: DB" };
  }

  await env.DB.prepare("UPDATE todos SET content = ? WHERE id = ?")
    .bind(content, id)
    .run();
  return { ok: true, data: null };
}

export async function deleteTodo(id: number): Promise<ServiceResult<null>> {
  const env = await getCloudflareEnv();
  if (!env?.DB) {
    return { ok: false, error: "Missing Cloudflare D1 binding: DB" };
  }

  await env.DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
  return { ok: true, data: null };
}

export async function getTodoImageUrl(
  id: number
): Promise<ServiceResult<string | null>> {
  const env = await getCloudflareEnv();
  if (!env?.DB) {
    return { ok: false, error: "Missing Cloudflare D1 binding: DB" };
  }

  const row = await env.DB.prepare<{ image_url: string | null }>(
    "SELECT image_url FROM todos WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<{ image_url: string | null }>();
  return { ok: true, data: row?.image_url ?? null };
}
