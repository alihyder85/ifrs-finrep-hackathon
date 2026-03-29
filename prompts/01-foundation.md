We are building an internal finance review web app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Create the project foundation for a production-quality MVP using:
- Next.js latest with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- TanStack Table
- React Hook Form
- Zod

Requirements:
1. Create a clean folder structure:
   - `src/app/` — pages and API routes
   - `src/components/layout/` — AppShell, Header, Sidebar
   - `src/components/ui/` — reusable UI primitives
   - `src/components/reports/` — feature components (empty for now)
   - `src/lib/` — utilities and shared logic
   - `src/types/` — TypeScript domain types
   - `prisma/` — schema and migrations

2. Add a README with local setup instructions including:
   - npm install
   - Prisma migration and seed commands
   - Environment variable setup
   - How to start the dev server

3. Add `.env.example` with:
   - DATABASE_URL
   - Any other variables the app will need

4. Add a minimal landing page at `/` that describes the app purpose

5. Add a placeholder Reports page at `/reports` (empty state for now)

6. Create an `AppShell` component at `src/components/layout/AppShell.tsx` that:
   - Wraps the full layout as a client component
   - Contains a fixed left `Sidebar` and a top `Header`
   - Renders `children` in the main scrollable area

7. Create a `Header` component at `src/components/layout/Header.tsx`:
   - Shows the app name and an "Internal Tool" label
   - Minimal, no navigation — just identity

8. Create a `Sidebar` component at `src/components/layout/Sidebar.tsx`:
   - Fixed 208px width
   - Shows 4 nav items in order: Home, Reports, Commentary, Export
   - Home and Reports are active (links work)
   - Commentary and Export are disabled stubs (greyed out, no href) — they will be enabled in future slices
   - Shows app branding at the top

9. Create a `src/lib/utils.ts` file with a `cn()` utility function combining `clsx` and `tailwind-merge`

10. Create a UI component library in `src/components/ui/`:
    - `button.tsx` — Button with variants: default (primary), outline, ghost, destructive; sizes: sm, md (default)
    - `card.tsx` — Card, CardHeader, CardTitle, CardContent sub-components
    - `badge.tsx` — Badge with colour variants
    - `separator.tsx` — Horizontal/vertical divider

11. Set up `globals.css` with:
    - CSS custom properties for theming on `:root`:
      `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`,
      `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`,
      `--border`, `--input`, `--ring`, `--card`, `--card-foreground`, `--radius`
    - Finance-specific utility classes:
      `.num` — monospace, right-aligned, tabular numbers
      `.num-negative` — red text for negative values
      `.num-positive` — green/emerald text for positive variance

12. Set up `tailwind.config.ts`:
    - `darkMode: ["class"]`
    - Extend colours using the CSS variables above (e.g. `primary: "hsl(var(--primary))"`)
    - Extend `borderRadius` using `--radius`
    - Extend `fontFamily.mono` using a custom monospace stack

13. Add a clean internal-tool style UI, not marketing style

Important:
- Do not build parsing or upload yet
- Do not build commentary yet
- Do not overengineer auth
- Keep it ready for the next slice

Before coding:
Explain what files you will create and why.
Then generate the code.