import { getRequestContext } from "@cloudflare/next-on-pages";

export type D1PreparedStatementResult<T> = {
  results?: T[];
  success?: boolean;
  meta?: {
    last_row_id?: number;
  };
};

export type D1PreparedStatement<T = unknown> = {
  bind: (...values: unknown[]) => D1PreparedStatement<T>;
  all: () => Promise<D1PreparedStatementResult<T>>;
  first: <U = T>() => Promise<U | null>;
  run: () => Promise<D1PreparedStatementResult<T>>;
};

export type D1Database = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
};

export type CloudflareEnv = {
  DB?: D1Database;
};

export async function getCloudflareEnv(): Promise<CloudflareEnv | null> {
  try {
    const context = getRequestContext();
    return (context?.env ?? null) as CloudflareEnv | null;
  } catch {
    return null;
  }
}
