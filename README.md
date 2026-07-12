# ReportBTMH — Dashboard số liệu đơn giản

Web app cá nhân: upload **CSV/XLSX** hoặc dán link **Google Sheets public**, chọn cột nhóm và cột tổng — app tự tạo tab + card sum cho từng nhóm.

## Tính năng

- Upload CSV/XLSX (drag & drop) hoặc import Google Sheets qua CSV export
- Auto-detect kiểu cột (ngày / số / text) + preview 20 dòng
- Chọn **nhóm chính** (tạo tab) và **nhóm phụ** (lọc dữ liệu), tick **giá trị từng cột**
- Chọn cột số cần **sum** → mỗi cột = 1 card tổng trong tab (cộng gộp nhóm phụ)
- Tab tự sinh theo giá trị nhóm, đổi tên tab, search/filter tab
- Click card để xem chi tiết dòng dữ liệu
- Lưu cấu hình + tên tab vào localStorage (gợi ý áp lại khi upload file cùng cấu trúc cột)
- Backend DuckDB + Parquet cache — đổi cấu hình không cần parse lại file
- **UI full màn hình** — filter/cấu hình nhóm trong **popup**, dashboard luôn chiếm tối đa không gian

## Luồng sử dụng

1. Upload file tại `/`
2. Dashboard full màn hình — popup **Cấu hình** tự mở
3. **Nhóm chính** (vd. Ngày) → chọn giá trị → mỗi giá trị = 1 tab
4. **Nhóm phụ** (vd. Dòng sản phẩm) → chọn a, b, c → lọc và **cộng tổng** trong mỗi tab
5. Chọn cột sum → **Xong**
6. Xem tab + card; bấm **Cấu hình** để chỉnh lại bất cứ lúc nào
7. **Upload mới** để đổi file (`/dashboard` redirect về `/`)

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15+, TypeScript, Tailwind, shadcn/ui, TanStack Table, Zustand |
| Backend | FastAPI, pandas, DuckDB, openpyxl, pyarrow |

## Chạy nhanh với Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health: http://localhost:8000/health

## Chạy local (dev)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Mở http://localhost:3000

## Google Sheets (public)

1. Mở Google Sheet → **Share** → **Anyone with the link** → **Viewer**
2. Copy URL dạng: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit?gid=0`
3. Dán vào ô import trên app

App sẽ tự chuyển sang URL export CSV:

`https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=...`

> Sheet private (cần login) chưa hỗ trợ OAuth — hãy export CSV/XLSX hoặc đặt public.

## File mẫu

`sample-data/sales_sample_10k.csv` — ~10.000 dòng, cột:

- `date`, `region`, `category`, `product`, ...
- Số: `quantity`, `unit_price`, `revenue`

**Gợi ý test nhanh:**

1. Upload file mẫu
2. **Nhóm chính:** `date` → chọn `2024-01-15`, `2024-01-16` (2 tab)
3. **Nhóm phụ:** `category` → chọn `Electronics`, `Clothing` (lọc + cộng tổng trong mỗi tab)
4. Sum: `revenue`, `quantity`
5. Tab hiển thị theo ngày; mỗi tab = tổng các giá trị nhóm phụ đã chọn

## API chính

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/upload` | Upload CSV/XLSX → parquet cache |
| POST | `/api/gsheet` | Import Google Sheets public |
| POST | `/api/values` | Liệt kê giá trị distinct của 1 cột (filter) |
| POST | `/api/summary` | Tổng hợp theo giá trị đã chọn |
| POST | `/api/detail` | Chi tiết dòng theo nhóm |

## Cấu trúc thư mục

```
frontend/src/
  app/page.tsx              # Upload + cấu hình
  app/dashboard/page.tsx    # Tab + card
  components/upload/
  components/column-selector/
  components/tab-view/
  components/summary-card/
  lib/api-client.ts
  lib/store.ts

backend/
  main.py
  routers/upload.py, gsheet.py, summary.py
  services/file_parser.py, duckdb_engine.py
  cache/                    # parquet tạm
```

## Lưu ý hiệu năng

- File upload được convert sang **Parquet** — đổi group-by / sum columns chỉ gọi lại API summary
- Frontend **debounce 450ms** khi tick/untick cột
- Tab paginate 40/tab khi có quá nhiều nhóm; dùng search để lọc nhanh
