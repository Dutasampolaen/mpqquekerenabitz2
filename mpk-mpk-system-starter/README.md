# MPK — Sistem Evaluasi & Distribusi Proker (Komisi A) — Starter Repo

Monorepo ini berisi:
- **backend/** — NestJS 11 + Prisma (PostgreSQL). Endpoint inti: bulk members, list members, set panitia proposal (min 3 anggota).
- **frontend/** — Next.js 16 (minimal) + halaman link ke prototipe UI.
- **db/** — SQL skema (DDL) + view statistik.
- **prototypes/** — HTML mandiri untuk demo UX.
- **docker-compose.yml** — Jalankan Postgres + Backend + Frontend.
- **.env.example** — Variabel lingkungan.

> Tujuan repo ini: **kickstart** implementasi. Tim dapat langsung ganti/stub endpoint,
> sambil menggunakan prototipe untuk merumuskan UI produksi (FullCalendar dsb).

## Quick Start

```bash
git clone <repo-url>
cd mpk-mpk-system-starter

# 1) Salin env
cp backend/.env.example backend/.env

# 2) Jalankan docker (Postgres + backend + frontend)
docker compose up -d --build

# 3) Setup database prisma
(inside backend container or local)
cd backend
npm install
npx prisma migrate dev --name init
npm run start:dev
```

- Frontend akan tersedia di: http://localhost:3000
- Backend API: http://localhost:8080/api
- Prototipe UI: buka file di folder **prototypes/** (atau akses via Frontend halaman Prototypes).

## Fitur Disertakan (MVP)
- **Master Anggota (bulk import)**: POST `/api/members/bulk` (Nama + Bidang bebas).
- **List & filter anggota**: GET `/api/members?name=&org_unit=`.
- **Seleksi panitia per proposal (dari DB)**: PUT `/api/proposals/:id/members`
  - Validasi server-side: **wajib ≥ 3 anggota MPK**, jika kurang → 400.
- **Schema inti**: proposals, members, proposal_members, evaluations, dll.
- **Statistik anggota** (view `member_stats`) untuk menghitung total proker, jeda waktu, dsb.
- **Telegram bot & notifikasi**: placeholder env + service stub, siap dihubungkan ke Telegraf/Telegram API.

## Struktur Repo
```
backend/
frontend/
db/
prototypes/
docker-compose.yml
```

## Catatan
- Ini starter yang **sengaja ringan**. Silakan sempurnakan validasi jadwal/bentrok/jeda dan integrasi notifikasi sesuai SPEC.
- Lihat **prototypes/** untuk inspirasi UI & alur.
