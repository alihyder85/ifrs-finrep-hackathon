# FinRep Review

Internal finance reporting review and commentary system.

## What It Does

- Import structured Excel-based financial statements
- Preserve source system row codes throughout (non-negotiable)
- Display statement values with period-over-period variance
- Attach reference labels (A1, C1.1, M1.8…) to rows
- Add and edit analyst commentary anchored to stable row identity
- Export reviewed commentary with full source lineage

---

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)
- npm / pnpm / yarn

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` with your database connection:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/finrep_dev"
```

### 3. Database

```bash
# Run migrations and generate Prisma client
npm run db:migrate
npm run db:generate
```

Quick push without migration history (dev only):

```bash
npm run db:push
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
frontend/
├── prisma/
│   └── schema.prisma         # Domain schema: Report, ReportRow, Commentary
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (AppShell wrapper)
│   │   ├── page.tsx           # Landing page
│   │   └── reports/
│   │       └── page.tsx       # Reports dashboard placeholder
│   ├── components/
│   │   ├── layout/            # AppShell, Sidebar, Header
│   │   └── ui/                # shadcn/ui base components
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── utils.ts           # cn() Tailwind utility
│   └── types/
│       └── index.ts           # Shared domain types
└── .env.example
```

## Adding shadcn/ui Components

Base components (button, card, badge, separator) are pre-seeded. To add more:

```bash
cd frontend
npx shadcn@latest add <component>
```

---

## Build Slices

| Slice | Status | Description |
|-------|--------|-------------|
| 01 — Foundation | ✅ Done | Project setup, schema, app shell, landing page |
| 02 — Upload & Parse | Pending | Excel upload, parser, row import |
| 03 — Review Grid | Pending | TanStack Table grid with row selection |
| 04 — Commentary | Pending | Commentary editor anchored to rows |
| 05 — Export | Pending | CSV/Excel export of reviewed data |
