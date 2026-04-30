## Next + Cloudflare 練習專案

目前包含：
- `/api/ping`：基本 API 測試
- `/api/todos`：D1 Todo 練習（GET/POST）
- `/api/todos/:id`：Todo 更新與刪除（PUT/DELETE）
- KV 快取：Todo 列表讀取快取
- `/api/upload`：R2 圖片上傳
- `db/0001_create_todos.sql`：建立 `todos` 資料表
- `db/0002_add_todo_image_url.sql`：為 `todos` 新增 `image_url`

## 本機啟動

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)。

## Cloudflare Pages Bindings 設定

1) 建立 D1 資料庫（Cloudflare Dashboard）
- Storage & Databases -> D1 -> Create database
- 建立完成後在 Pages 專案 Settings -> Functions -> Bindings 綁定為 `DB`

2) 建立資料表
- 到 D1 Console 執行 `db/0001_create_todos.sql`
- 再執行 `db/0002_add_todo_image_url.sql`

3) 建立 KV 與 R2
- KV -> Create namespace，綁定為 `TODOS_CACHE`
- R2 -> Create bucket，綁定為 `BUCKET`
- 若要在頁面直接顯示圖片，請為 bucket 綁定 public 網域並記下 base URL

4) 設定環境變數（僅保留一般設定）

```bash
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
```

5) 本機開發注意
- 若使用 `next dev`，通常沒有 Cloudflare bindings；部署到 Pages 才會有 `DB` / `TODOS_CACHE` / `BUCKET`
- 若要本機模擬 bindings，請使用 Cloudflare Pages/Workers 本機執行流程

## 驗收

- 首頁 `Step 2` 可新增 Todo
- 可按重新讀取看到最新列表（第一次可能來自 D1，之後命中 KV）
- 可上傳圖片並在列表看到縮圖
- 直接打 `/api/todos` 可看到 JSON

## 目前狀態

- Todos 已改為 D1 binding (`DB`)
- Todo list 快取已改為 KV binding (`TODOS_CACHE`)
- 上傳與刪圖已改為 R2 binding (`BUCKET`)
