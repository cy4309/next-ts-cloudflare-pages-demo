import { getCloudflareEnv } from "@/lib/cf/env";

type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export function buildObjectKey(filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const random = Math.random().toString(36).slice(2, 8);
  return `todo-${Date.now()}-${random}-${safeName}`;
}

export function toR2ObjectKey(
  imageUrl: string,
  publicBaseUrl?: string
): string | null {
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

export async function uploadR2Object(
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<ServiceResult<null>> {
  void contentType;
  const env = await getCloudflareEnv();
  if (!env?.BUCKET) {
    return { ok: false, error: "Missing Cloudflare R2 binding: BUCKET" };
  }

  await env.BUCKET.put(key, data);
  return { ok: true, data: null };
}

export async function deleteR2ObjectByImageUrl(
  imageUrl: string
): Promise<ServiceResult<null>> {
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  const objectKey = toR2ObjectKey(imageUrl, publicBaseUrl);
  if (!objectKey) {
    return {
      ok: false,
      error: "Failed to parse R2 object key from image_url",
    };
  }

  const env = await getCloudflareEnv();
  if (!env?.BUCKET) {
    return { ok: false, error: "Missing Cloudflare R2 binding: BUCKET" };
  }

  await env.BUCKET.delete(objectKey);
  return { ok: true, data: null };
}
