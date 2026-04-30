import { NextResponse } from "next/server";

export const runtime = "edge";

function getRequiredEnv() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !bucketName || !token) {
    return {
      ok: false as const,
      error:
        "Missing env vars. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_API_TOKEN",
    };
  }

  return { ok: true as const, accountId, bucketName, token };
}

function buildObjectKey(filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const random = Math.random().toString(36).slice(2, 8);
  return `todo-${Date.now()}-${random}-${safeName}`;
}

export async function POST(request: Request) {
  const env = getRequiredEnv();
  if (!env.ok) {
    return NextResponse.json({ ok: false, error: env.error }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file is required" },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "file is empty" },
      { status: 400 }
    );
  }

  const key = buildObjectKey(file.name || "upload.bin");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/r2/buckets/${env.bucketName}/objects/${encodeURIComponent(
    key
  )}`;
  const uploadRes = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "content-type": file.type || "application/octet-stream",
    },
    body: await file.arrayBuffer(),
    cache: "no-store",
  });

  if (!uploadRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `R2 upload failed: HTTP ${uploadRes.status}`,
      },
      { status: 500 }
    );
  }

  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(
    /\/$/,
    ""
  );

  return NextResponse.json({
    ok: true,
    key,
    url: publicBaseUrl ? `${publicBaseUrl}/${key}` : null,
  });
}
