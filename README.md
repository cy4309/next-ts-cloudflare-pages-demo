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

## D1 設定步驟

1) 建立 D1 資料庫（Cloudflare Dashboard）
- Storage & Databases -> D1 -> Create database
- 記下 `account id` 與 `database id`

2) 建立資料表
- 到 D1 Console 執行 `db/0001_create_todos.sql`
- 再執行 `db/0002_add_todo_image_url.sql`

3) 建立 KV 與 R2
- KV -> Create namespace，記下 `kv namespace id`
- R2 -> Create bucket，記下 `bucket name`
- 若要在頁面直接顯示圖片，請為 bucket 綁定 public 網域並記下 base URL

4) 設定環境變數（本機 `.env.local` 與 Cloudflare Pages 都要設）

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_database_id
CLOUDFLARE_KV_NAMESPACE_ID=your_kv_namespace_id
CLOUDFLARE_R2_BUCKET_NAME=your_r2_bucket_name
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
CLOUDFLARE_API_TOKEN=your_api_token
```

5) API Token 權限建議
- 需要 D1 的讀寫權限（至少可查詢與寫入指定 DB）
- 需要 KV 的讀寫權限（至少可讀取/寫入指定 namespace）
- 需要 R2 的讀寫權限（至少可上傳 object）

## 驗收

- 首頁 `Step 2` 可新增 Todo
- 可按重新讀取看到最新列表（第一次可能來自 D1，之後命中 KV）
- 可上傳圖片並在列表看到縮圖
- 直接打 `/api/todos` 可看到 JSON

## 下一步

- 加入 R2 刪檔（刪除 Todo 時同步刪圖）
