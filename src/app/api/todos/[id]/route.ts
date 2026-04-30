import { NextResponse } from "next/server";
import { deleteTodo, getTodoImageUrl, updateTodo } from "@/lib/todos/d1";
import { invalidateTodosCache } from "@/lib/todos/cache";
import { deleteR2ObjectByImageUrl } from "@/lib/storage/r2";

export const runtime = "edge";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const todoId = Number(id);

  if (!Number.isInteger(todoId) || todoId <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid todo id",
      },
      { status: 400 }
    );
  }

  const imageResult = await getTodoImageUrl(todoId);
  if (!imageResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: imageResult.error ?? "Failed to read todo before deletion",
      },
      { status: 500 }
    );
  }

  const imageUrl = imageResult.data ?? null;

  if (imageUrl) {
    const r2DeleteResult = await deleteR2ObjectByImageUrl(imageUrl);
    if (!r2DeleteResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: r2DeleteResult.error ?? "Failed to delete image from R2",
        },
        { status: 500 }
      );
    }
  }

  const result = await deleteTodo(todoId);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Failed to delete todo",
      },
      { status: 500 }
    );
  }

  await invalidateTodosCache();

  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const todoId = Number(id);

  if (!Number.isInteger(todoId) || todoId <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid todo id",
      },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json(
      {
        ok: false,
        error: "content is required",
      },
      { status: 400 }
    );
  }

  const result = await updateTodo(todoId, content);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Failed to update todo",
      },
      { status: 500 }
    );
  }

  await invalidateTodosCache();

  return NextResponse.json({ ok: true });
}
