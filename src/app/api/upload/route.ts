import { NextResponse } from "next/server";
import { buildObjectKey, uploadR2Object } from "@/lib/storage/r2";

export const runtime = "edge";

export async function POST(request: Request) {
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
  const uploadResult = await uploadR2Object(
    key,
    await file.arrayBuffer(),
    file.type || "application/octet-stream"
  );
  if (!uploadResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: uploadResult.error ?? "R2 upload failed",
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
