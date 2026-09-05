

## Complete Technical Export — Hotogram Project

I'll generate a single, comprehensive Markdown handoff document at `/mnt/documents/HOTOGRAM_TECHNICAL_EXPORT.md` for migration to Antigravity.

### Document Structure

The export will be a developer-grade handoff (not a summary), organized into these sections:

**1. Project Overview**
- Product purpose: multi-tenant restaurant ordering SaaS (QR menus, kitchen ops, billing)
- Three portals: Customer (no-auth QR), Restaurant (owner/staff), Platform Admin
- Live URLs (preview + published), Lovable + Supabase project IDs

**2. Technology Stack & Dependencies**
- Full `package.json` (deps + devDeps + scripts)
- Vite, React 18, TypeScript, Tailwind v3, shadcn/ui, Supabase JS, TanStack Query, React Router v6, Zod, react-hook-form, recharts, qrcode.react, html2canvas, sonner
- Build/dev/lint commands

**3. Project Structure**
- Full directory tree of `src/`, `supabase/`, `public/`
- Purpose of each folder

**4. Configuration Files** (full contents)
- `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `postcss.config.js`, `eslint.config.js`, `components.json`, `index.html`, `supabase/config.toml`, `.env` variable names (no values)

**5. Architecture**
- Multi-tenant data isolation model
- Table session lifecycle (QR scan → session → orders → payment → close)
- Real-time sync model (Supabase channels)
- Auth model (3 portals, role-based via `user_roles` + `has_role` SECURITY DEFINER)

**6. Database Schema (Complete)**
- Every table: columns, types, defaults, nullability
- All enums (`app_role`, `restaurant_status`, `order_status`, `table_status`, `payment_status`, `payment_method`, `subscription_plan`, `request_type`, `request_status`, `session_status`)
- Every RLS policy verbatim (SELECT/INSERT/UPDATE/DELETE) per table
- Every database function (full SQL): `has_role`, `has_restaurant_access`, `is_restaurant_active`, `validate_qr_token`, `get_public_restaurant_info`, `upsert_customer_contact`, `update_updated_at_column`
- Storage buckets: `voice-notes` (private), `menu-images` (public), `restaurant-logos` (public)
- Migration file list (chronological)

**7. Edge Functions** (full source code)
- `cancel-order/index.ts` — service-role cancellation w/ partial item support, recalc totals, audit log
- `verify-payment/index.ts` — UPI verification flow

**8. Frontend Application Map**
- Full route table from `App.tsx` (path → component → guard)
- Page-by-page summary for every file in `pages/{admin,auth,customer,restaurant}/` with purpose, key state, data fetched, real-time subscriptions
- Component inventory (`components/`, `components/ui/`, `components/auth/`, `components/billing/`, `components/layout/`)
- Hooks: `useAuth`, `useNotifications`, `useSidebarBadges`, `use-mobile`, `use-toast`
- Libs: `utils`, `validation`, `errorUtils`
- Type definitions from `src/types/database.ts`

**9. Feature Workflows** (end-to-end)
- Customer ordering (QR scan → menu → cart → place order → track → pay)
- Order cancellation (full + item-level, customer + kitchen, persistent `cancelled_items` JSONB history)
- UPI payment verification (transaction → QR → "I Paid" → staff confirmation)
- Kitchen workflow (3 tabs: Active / Served / Cancelled, status transitions)
- Customer requests (call waiter / water / bill) with real-time alerts
- Voice notes (recording → upload to private bucket → kitchen playback)
- Customer contacts upsert + export
- Invoice generation
- Real-time notifications (sound + visual on status change)

**10. Security Model**
- RLS philosophy (SECURITY DEFINER functions, no recursive checks)
- Role separation (`user_roles` table, never on `profiles`)
- Customer access via active `table_sessions` (no auth)
- Platform admin guard component
- Storage bucket policies

**11. Integrations**
- Lovable Cloud (Supabase) — project ref, URL, anon key location
- Lovable AI Gateway (LOVABLE_API_KEY secret available, currently unused in code)
- All secrets list (names only)

**12. Known Architectural Decisions & Memories**
- Why orders are never deleted (status-only transitions)
- Why `cancelled_items` is a JSONB column on `orders` (not a separate table)
- Why session totals decrement on partial cancellation
- Why digital bill UI is hidden but logic preserved

**13. Migration Notes for Antigravity**
- Required env vars to recreate
- Database export procedure (schema + data)
- Storage bucket migration
- Edge function porting considerations (Deno → target runtime)
- Real-time channel equivalents needed
- RLS policy translation checklist

### Method

Read every source file, every migration, both edge functions, all configs, and the full RLS/function definitions already provided in context. Inline file contents in fenced code blocks with language tags and file path headers. Output to `/mnt/documents/HOTOGRAM_TECHNICAL_EXPORT.md` and emit a `<lov-artifact>` tag for download.

Expected size: ~150–250 KB single Markdown file, fully self-contained — a new developer should be able to rebuild the project from this document alone.

