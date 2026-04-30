import { NextResponse } from "next/server";
import { createTodo, listTodos, type Todo } from "@/lib/todos/d1";

export const runtime = "edge";

const TODOS_CACHE_KEY = "todos:list:v1";

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

  const result = await listTodos();
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Failed to query todos",
      },
      { status: 500 }
    );
  }

  await writeTodosCache(result.data ?? []);

  return NextResponse.json({
    ok: true,
    todos: result.data ?? [],
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

  const result = await createTodo(content, imageUrl);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Failed to insert todo",
      },
      { status: 500 }
    );
  }

  await invalidateTodosCache();

  return NextResponse.json({
    ok: true,
    id: result.data?.id ?? null,
  });
}
