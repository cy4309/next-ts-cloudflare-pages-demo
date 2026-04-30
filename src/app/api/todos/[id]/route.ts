import { NextResponse } from "next/server";
import { deleteTodo, getTodoImageUrl, updateTodo } from "@/lib/todos/d1";
import { invalidateTodosCache } from "../route";

export const runtime = "edge";

function toR2ObjectKey(imageUrl: string, publicBaseUrl?: string): string | null {
  const normalizedBase = publicBaseUrl?.replace(/\/$/, "");

  if (normalizedBase && imageUrl.startsWith(`${normalizedBase}/`)) {
    return imageUrl.slice(normalizedBase.length + 1);
  }

  if (!/^https?:\/\//.test(imageUrl)) {
    return imageUrl.trim() || null;
  }

  try {
    const parsed = new URL(imageUrl);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    return pathname || null;
  } catch {
    return null;
  }
}

async function deleteR2ObjectByImageUrl(imageUrl: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

  if (!accountId || !bucketName || !token) {
    return {
      ok: false,
      error:
        "Missing R2 env vars. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_API_TOKEN",
    };
  }

  const objectKey = toR2ObjectKey(imageUrl, publicBaseUrl);
  if (!objectKey) {
    return {
      ok: false,
      error: "Failed to parse R2 object key from image_url",
    };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(
    objectKey
  )}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      ok: false,
      error: `R2 delete failed: HTTP ${res.status}`,
    };
  }

  return { ok: true };
}

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
