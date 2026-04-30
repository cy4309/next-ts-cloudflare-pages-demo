import { NextResponse } from "next/server";
import { invalidateTodosCache } from "../route";

export const runtime = "edge";

type D1ApiSuccess = {
  success: true;
  result: Array<{
    success: boolean;
    results?: unknown[];
    error?: string;
  }>;
};

type D1ApiFailure = {
  success: false;
  errors: Array<{ message: string }>;
};

async function queryD1(
  sql: string,
  params: unknown[] = []
): Promise<{ ok: boolean; results?: unknown[]; error?: string }> {
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

  const payload = (await res.json()) as D1ApiSuccess | D1ApiFailure;
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

  return { ok: true, results: row.results ?? [] };
}

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

  const selectResult = await queryD1(
    "SELECT image_url FROM todos WHERE id = ? LIMIT 1",
    [todoId]
  );
  if (!selectResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: selectResult.error ?? "Failed to read todo before deletion",
      },
      { status: 500 }
    );
  }

  const todoRow = (selectResult.results?.[0] ?? null) as
    | { image_url?: string | null }
    | null;
  const imageUrl = todoRow?.image_url ?? null;

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

  const result = await queryD1("DELETE FROM todos WHERE id = ?", [todoId]);
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

  const result = await queryD1("UPDATE todos SET content = ? WHERE id = ?", [
    content,
    todoId,
  ]);
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
