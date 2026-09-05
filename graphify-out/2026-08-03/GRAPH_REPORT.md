# Graph Report - hotogram.app  (2026-08-03)

## Corpus Check
- 140 files · ~76,654 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 728 nodes · 1502 edges · 91 communities (42 shown, 49 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- MenuManagement.tsx
- devDependencies
- cn
- useToast
- database.ts
- PlatformAdmin.tsx
- App.tsx
- hooks/use-toast.ts
- compilerOptions
- TableManagement.tsx
- KitchenView.tsx
- compilerOptions
- components.json
- dependencies
- types.ts
- compilerOptions
- print_menu_item_type.js
- search_veg.js
- cancel-order/index.ts
- verify-payment/index.ts
- class-variance-authority
- class-variance-authority
- cmdk
- framer-motion
- html2canvas
- class-variance-authority
- next-themes
- qrcode.react
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react
- react-day-picker
- react-dom
- react-router-dom
- recharts
- sonner
- @supabase/supabase-js
- tailwind-merge
- tailwindcss-animate
- @tanstack/react-query
- vaul
- zod
- use-mobile.tsx
- App\Auth\Authenticator
- BaseException
- Bool
- constant
- double
- Enum
- Float64
- __global__
- HashMap
- HasName
- Injectable
- IPv4Address
- IPv6Address
- kernel
- List
- Loggable
- Module
- Menu.tsx
- cn
- OrderTrackerDrawer.tsx
- OrderTrackerDrawer.tsx
- badge.tsx
- framer-motion

## God Nodes (most connected - your core abstractions)
1. `cn()` - 64 edges
2. `useToast()` - 42 edges
3. `useAuth()` - 37 edges
4. `supabase` - 29 edges
5. `Button` - 27 edges
6. `Restaurant` - 25 edges
7. `Card` - 22 edges
8. `CardContent` - 22 edges
9. `CardHeader` - 21 edges
10. `CardTitle` - 21 edges

## Surprising Connections (you probably didn't know these)
- `useChart()` --references--> `react`  [EXTRACTED]
  src/components/ui/chart.tsx → package.json
- `useIsMobile()` --references--> `react`  [EXTRACTED]
  src/hooks/use-mobile.tsx → package.json
- `useToast()` --references--> `react`  [EXTRACTED]
  src/hooks/use-toast.ts → package.json
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dropdown-menu.tsx → src/lib/utils.ts
- `CustomerHelpButton()` --calls--> `useToast()`  [EXTRACTED]
  src/components/CustomerHelpButton.tsx → src/hooks/use-toast.ts

## Import Cycles
- None detected.

## Communities (91 total, 49 thin omitted)

### Community 0 - "MenuManagement.tsx"
Cohesion: 0.10
Nodes (47): Props, DashboardLayout(), DashboardLayoutProps, Logo(), LogoProps, Badge(), BadgeProps, badgeVariants (+39 more)

### Community 1 - "devDependencies"
Cohesion: 0.04
Nodes (45): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, lovable-tagger, devDependencies (+37 more)

### Community 2 - "cn"
Cohesion: 0.13
Nodes (11): react, react, ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent (+3 more)

### Community 3 - "useToast"
Cohesion: 0.10
Nodes (20): DishDetailDialog(), DishDetailDialogProps, getImageUrl(), AppRole, AuditLog, CustomerContact, CustomerRequest, CustomerTag (+12 more)

### Community 4 - "database.ts"
Cohesion: 0.16
Nodes (16): PaymentTransactionsPanel(), statusColors, CustomerHelpButton(), CustomerHelpButtonProps, CustomerIdentityDialog(), CustomerIdentityDialogProps, customerSchema, DialogContent (+8 more)

### Community 5 - "PlatformAdmin.tsx"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (23): AdminAuth, AdminOrders, AdminRevenue, AdminSettings, AdminSubscribers, Analytics, ContactExport, CustomerMenu (+15 more)

### Community 7 - "hooks/use-toast.ts"
Cohesion: 0.07
Nodes (41): RequirePlatformAdmin(), CustomerRequestButtons(), CustomerRequestButtonsProps, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription (+33 more)

### Community 8 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 9 - "TableManagement.tsx"
Cohesion: 0.08
Nodes (31): ExtractedCategory, ExtractedItem, extractMenuFromImage(), createErrorToast(), ERROR_CODE_MAP, HTTP_STATUS_MAP, PostgresError, sanitizeError() (+23 more)

### Community 10 - "KitchenView.tsx"
Cohesion: 0.11
Nodes (17): 🎨 1. Design & Aesthetic Tokens, 🧱 2. Core UI Layout Structure, ⚙️ 3. Client State Machine, 💬 4. Interactive Components & Popups, 🛠️ 5. Implementation Code Reference, A. Customer Menu Page Route (`/src/app/menu/[restaurantId]/[tableId]/page.tsx`), A. Header Navigation, A. Need Assistance Popup (Modal) (+9 more)

### Community 11 - "compilerOptions"
Cohesion: 0.11
Nodes (17): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection (+9 more)

### Community 12 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 13 - "dependencies"
Cohesion: 0.15
Nodes (13): lucide-react, dependencies, lucide-react, @radix-ui/react-aspect-ratio, @radix-ui/react-tabs, @radix-ui/react-toast, @radix-ui/react-tooltip, recharts (+5 more)

### Community 14 - "types.ts"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 15 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, noImplicitAny, noUnusedLocals, noUnusedParameters, paths, skipLibCheck, strictNullChecks (+2 more)

### Community 21 - "class-variance-authority"
Cohesion: 0.15
Nodes (20): Notification, NotificationBell(), NotificationBellProps, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem (+12 more)

### Community 25 - "class-variance-authority"
Cohesion: 0.18
Nodes (19): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+11 more)

### Community 30 - "@radix-ui/react-aspect-ratio"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 48 - "@radix-ui/react-tooltip"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 49 - "react"
Cohesion: 0.22
Nodes (8): 1. Typography, 2. Color Palette, 3. Visual Effects & Aesthetics, 4. Logo Design, Dark Mode, Hotogram Brand Guidelines, How to use this with Antigravity, Light Mode

### Community 53 - "recharts"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 61 - "use-mobile.tsx"
Cohesion: 0.29
Nodes (6): Can I connect a custom domain to my Lovable project?, How can I deploy this project?, How can I edit this code?, Project info, Welcome to your Lovable project, What technologies are used for this project?

### Community 62 - "App\Auth\Authenticator"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 63 - "BaseException"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 64 - "Bool"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 65 - "constant"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 66 - "double"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 67 - "Enum"
Cohesion: 0.50
Nodes (3): For git commit hook, For native AGENTS.md integration, graphify reference: commit hook and native AGENTS.md integration

### Community 69 - "Float64"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 70 - "__global__"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 71 - "HashMap"
Cohesion: 0.50
Nodes (3): Complete Technical Export — Hotogram Project, Document Structure, Method

### Community 81 - "Menu.tsx"
Cohesion: 0.27
Nodes (8): ScrollArea, ScrollBar, calculateItemPrepTime(), generateUUID(), CustomerMenu(), getImageUrl(), CartItem, MenuCategory

### Community 82 - "cn"
Cohesion: 0.18
Nodes (11): HotogramLoader(), HotogramLoaderProps, NavLink, NavLinkCompatProps, SheetFooter(), Skeleton(), TooltipContent, VoiceRecorder() (+3 more)

### Community 84 - "OrderTrackerDrawer.tsx"
Cohesion: 0.20
Nodes (13): getLogoUrl(), OrderTrackerDrawer(), OrderTrackerDrawerProps, statusSteps, SheetContent, SheetContentProps, SheetDescription, SheetHeader() (+5 more)

### Community 85 - "badge.tsx"
Cohesion: 0.18
Nodes (11): Checkbox, OrderStatusBadge(), OrderStatusBadgeProps, PaymentStatusIndicator(), PaymentStatusProps, statusConfig, Separator, getLogoUrl() (+3 more)

## Knowledge Gaps
- **363 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+358 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`, `cn`, `cmdk`, `framer-motion`, `html2canvas`, `next-themes`, `qrcode.react`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-toggle-group`, `react-day-picker`, `react-dom`, `react-router-dom`, `sonner`, `@supabase/supabase-js`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `vaul`, `zod`, `kernel`, `List`, `Loggable`, `Module`, `OrderTrackerDrawer.tsx`, `framer-motion`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Why does `useToast()` connect `hooks/use-toast.ts` to `MenuManagement.tsx`, `cn`, `database.ts`, `TableManagement.tsx`, `Menu.tsx`, `OrderTrackerDrawer.tsx`, `badge.tsx`, `class-variance-authority`, `class-variance-authority`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `react` connect `cn` to `dependencies`, `hooks/use-toast.ts`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MenuManagement.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10280701754385965 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._