import { getCloudflareEnv } from "@/lib/cf/env";
import type { Todo } from "@/lib/todos/d1";

const TODOS_CACHE_KEY = "todos:list:v1";

export async function readTodosCache(): Promise<Todo[] | null> {
  const env = await getCloudflareEnv();
  if (!env?.TODOS_CACHE) return null;

  const value = await env.TODOS_CACHE.get(TODOS_CACHE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as Todo[];
  } catch {
    return null;
  }
}

export async function writeTodosCache(todos: Todo[]) {
  const env = await getCloudflareEnv();
  if (!env?.TODOS_CACHE) return;
  await env.TODOS_CACHE.put(TODOS_CACHE_KEY, JSON.stringify(todos));
}

export async function invalidateTodosCache() {
  const env = await getCloudflareEnv();
  if (!env?.TODOS_CACHE) return;
  await env.TODOS_CACHE.delete(TODOS_CACHE_KEY);
}
