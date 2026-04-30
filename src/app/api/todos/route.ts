import { NextResponse } from "next/server";
import { createTodo, listTodos } from "@/lib/todos/d1";
import {
  invalidateTodosCache,
  readTodosCache,
  writeTodosCache,
} from "@/lib/todos/cache";

export const runtime = "edge";

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
