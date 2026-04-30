"use client";

import { useEffect, useRef, useState } from "react";

type Todo = {
  id: number;
  content: string;
  created_at: string;
  image_url: string | null;
};

function formatCreatedAt(value: string) {
  // D1 datetime('now') returns UTC-like string: "YYYY-MM-DD HH:mm:ss".
  // Treat it as UTC and convert to local timezone for display.
  const utcDate = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(utcDate.getTime())) return value;
  return utcDate.toLocaleString("zh-TW", { hour12: false });
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState("");
  const [todosLoading, setTodosLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function testEdgeApi() {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ping", { cache: "no-store" });
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: res.ok,
              data,
            },
            null,
            2,
          ),
        );
      } else {
        const text = await res.text();
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: res.ok,
              error: "Non-JSON response",
              raw: text.slice(0, 300),
            },
            null,
            2,
          ),
        );
      }
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown request error",
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadTodos() {
    setTodosLoading(true);
    try {
      const res = await fetch("/api/todos", { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        todos?: Todo[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: false,
              error: data.error ?? "Failed to load todos",
            },
            null,
            2,
          ),
        );
        return;
      }

      setTodos(data.todos ?? []);
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown request error",
          },
          null,
          2,
        ),
      );
    } finally {
      setTodosLoading(false);
    }
  }

  async function addTodo() {
    const content = todoInput.trim();
    if (!content) return;

    setTodosLoading(true);
    try {
      let imageUrl: string | null = null;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = (await uploadRes.json()) as {
          ok: boolean;
          url?: string | null;
          error?: string;
        };
        if (!uploadRes.ok || !uploadData.ok) {
          setResult(
            JSON.stringify(
              {
                httpStatus: uploadRes.status,
                ok: false,
                error: uploadData.error ?? "Failed to upload file",
              },
              null,
              2,
            ),
          );
          return;
        }
        imageUrl = uploadData.url ?? null;
      }

      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, imageUrl }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: false,
              error: data.error ?? "Failed to add todo",
            },
            null,
            2,
          ),
        );
        return;
      }

      setTodoInput("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadTodos();
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown request error",
          },
          null,
          2,
        ),
      );
    } finally {
      setTodosLoading(false);
    }
  }

  async function deleteTodo(id: number) {
    setTodosLoading(true);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: false,
              error: data.error ?? "Failed to delete todo",
            },
            null,
            2,
          ),
        );
        return;
      }

      await loadTodos();
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown request error",
          },
          null,
          2,
        ),
      );
    } finally {
      setTodosLoading(false);
    }
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditingContent(todo.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingContent("");
  }

  async function saveEdit(id: number) {
    const content = editingContent.trim();
    if (!content) return;

    setTodosLoading(true);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResult(
          JSON.stringify(
            {
              httpStatus: res.status,
              ok: false,
              error: data.error ?? "Failed to update todo",
            },
            null,
            2,
          ),
        );
        return;
      }

      cancelEdit();
      await loadTodos();
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown request error",
          },
          null,
          2,
        ),
      );
    } finally {
      setTodosLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-12 bg-background text-foreground">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Cloudflare 練習場</h1>

        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-xl font-semibold">Step 1: 測試 Edge API</h2>
          <p className="text-sm opacity-80">
            這個按鈕會打到 <code>/api/ping</code>，你可以確認 API 是否正常運作。
          </p>
          <button
            type="button"
            onClick={testEdgeApi}
            disabled={loading}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "測試中..." : "呼叫 /api/ping"}
          </button>
          <pre className="text-xs rounded bg-black/90 text-green-300 p-3 overflow-auto min-h-24">
            {result || "尚未測試 API"}
          </pre>
        </section>

        <section className="rounded-lg border p-4 space-y-2 text-sm">
          <h2 className="text-xl font-semibold">
            Step 2: D1 + KV + R2 Todo 練習
          </h2>
          <div className="flex gap-2">
            <input
              value={todoInput}
              onChange={(event) => setTodoInput(event.target.value)}
              placeholder="輸入待辦事項"
              className="border rounded px-3 py-2 flex-1 bg-transparent"
            />
            <button
              type="button"
              onClick={addTodo}
              disabled={todosLoading}
              className="rounded-md border px-4 py-2"
            >
              新增
            </button>
          </div>
          <div className="rounded-md border px-3 py-2 flex items-center gap-3">
            <label
              htmlFor="todo-image-upload"
              className="rounded-md border px-3 py-1.5 text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            >
              選擇圖片
            </label>
            <input
              id="todo-image-upload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="hidden"
            />
            <span className="text-xs opacity-80 truncate">
              {selectedFile ? selectedFile.name : "尚未選擇檔案"}
            </span>
          </div>
          <button
            type="button"
            onClick={loadTodos}
            disabled={todosLoading}
            className="rounded-md border px-3 py-2"
          >
            {todosLoading ? "讀取中..." : "重新讀取"}
          </button>
          <ul className="space-y-1 !mt-12">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="rounded border px-3 py-2 flex flex-col items-start justify-between gap-3"
              >
                <div className="w-full flex items-center justify-between">
                  <div>
                    {editingId === todo.id ? (
                      <input
                        value={editingContent}
                        onChange={(event) =>
                          setEditingContent(event.target.value)
                        }
                        className="border rounded px-2 py-1 bg-transparent"
                      />
                    ) : (
                      <div>{todo.content}</div>
                    )}
                    <div className="opacity-70 text-xs">
                      {formatCreatedAt(todo.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingId === todo.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(todo.id)}
                          disabled={todosLoading}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          儲存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={todosLoading}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(todo)}
                        disabled={todosLoading}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        編輯
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      disabled={todosLoading}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      刪除
                    </button>
                  </div>
                </div>
                {todo.image_url ? (
                  <img
                    src={todo.image_url}
                    alt="todo attachment"
                    className="mt-2 max-w-52 rounded border"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
