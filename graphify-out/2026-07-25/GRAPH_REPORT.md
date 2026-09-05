# Graph Report - .  (2026-07-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 737 nodes · 1213 edges · 260 communities (22 shown, 238 thin omitted)
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
- clsx
- cmdk
- framer-motion
- html2canvas
- lucide-react
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
- MultiDiGraph
- MutableList
- NamedTuple
- Namespace
- ndarray
- NSObject
- NSString
- ObservableObject
- OpenerDirector
- Override
- Processor
- Rectangle
- RelayCommand
- RoutedEventArgs
- SampleDelegate
- Path
- Path
- Path
- Counter
- Path
- Any
- Path
- Path
- Path
- Any
- Counter
- Path
- Path
- Any
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Any
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Any
- Path
- Path
- Path
- Path
- Path
- Path
- Any
- Path
- Any
- Path
- Path
- Path
- Any
- Path
- Any
- datetime
- Path
- Path
- Any
- Any
- Path
- Path
- Any
- Path
- Path
- Any
- Path
- Path
- Path
- Path
- DiGraph
- Any
- String
- string
- T
- HttpClient
- __device__
- HttpClient
- T
- device
- string
- String
- T
- Int
- Loggable
- String
- Int
- String
- string
- DiGraph
- Path
- Path
- Path
- Path
- CompletedProcess
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- CompletedProcess
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- datetime
- Path
- Path
- CompletedProcess
- Path
- Path
- Path
- Path
- DiGraph
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Path
- Exception
- Exception
- Self
- str
- Task
- TestClient
- uint
- Vec
- vector
- void
- Window

## God Nodes (most connected - your core abstractions)
1. `cn()` - 59 edges
2. `useToast()` - 41 edges
3. `useAuth()` - 35 edges
4. `supabase` - 25 edges
5. `Button` - 24 edges
6. `Restaurant` - 21 edges
7. `Card` - 20 edges
8. `CardContent` - 20 edges
9. `CardHeader` - 19 edges
10. `CardTitle` - 19 edges

## Surprising Connections (you probably didn't know these)
- `DialogFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dialog.tsx → src/lib/utils.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dropdown-menu.tsx → src/lib/utils.ts
- `RestaurantWithStats` --inherits--> `Restaurant`  [EXTRACTED]
  src/pages/admin/PlatformAdmin.tsx → src/types/database.ts
- `CustomerHelpButton()` --calls--> `useToast()`  [EXTRACTED]
  src/components/CustomerHelpButton.tsx → src/hooks/use-toast.ts
- `CustomerRequestButtons()` --calls--> `useToast()`  [EXTRACTED]
  src/components/CustomerRequestButtons.tsx → src/hooks/use-toast.ts

## Import Cycles
- None detected.

## Communities (260 total, 238 thin omitted)

### Community 0 - "MenuManagement.tsx"
Cohesion: 0.16
Nodes (31): Props, statusColors, DashboardLayout(), DashboardLayoutProps, Logo(), LogoProps, Button, ButtonProps (+23 more)

### Community 1 - "devDependencies"
Cohesion: 0.04
Nodes (45): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, lovable-tagger, devDependencies (+37 more)

### Community 2 - "cn"
Cohesion: 0.07
Nodes (31): OrderTrackerDrawer(), statusSteps, NavLink, NavLinkCompatProps, ChartConfig, ChartContainer, ChartContext, ChartContextProps (+23 more)

### Community 3 - "useToast"
Cohesion: 0.07
Nodes (39): RequirePlatformAdmin(), CustomerRequestButtons(), CustomerRequestButtonsProps, useToast(), useAuth(), createErrorToast(), ERROR_CODE_MAP, HTTP_STATUS_MAP (+31 more)

### Community 4 - "database.ts"
Cohesion: 0.09
Nodes (32): PaymentTransactionsPanel(), CustomerHelpButton(), CustomerIdentityDialog(), OrderTrackerDrawerProps, ScrollArea, ScrollBar, CustomerMenu(), getImageUrl() (+24 more)

### Community 5 - "PlatformAdmin.tsx"
Cohesion: 0.11
Nodes (22): CustomerHelpButtonProps, CustomerIdentityDialogProps, customerSchema, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay (+14 more)

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (15): queryClient, Toaster(), ToasterProps, AuthProvider(), OrderWithRestaurant, DailyRevenue, RevenueByRestaurant, planColors (+7 more)

### Community 7 - "hooks/use-toast.ts"
Cohesion: 0.11
Nodes (23): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+15 more)

### Community 8 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib (+15 more)

### Community 9 - "TableManagement.tsx"
Cohesion: 0.12
Nodes (20): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+12 more)

### Community 10 - "KitchenView.tsx"
Cohesion: 0.19
Nodes (13): Notification, NotificationBell(), NotificationBellProps, Badge(), BadgeProps, badgeVariants, TabsContent, TabsList (+5 more)

### Community 11 - "compilerOptions"
Cohesion: 0.11
Nodes (17): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection (+9 more)

### Community 12 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 13 - "dependencies"
Cohesion: 0.18
Nodes (12): dependencies, @radix-ui/react-checkbox, @radix-ui/react-menubar, @radix-ui/react-separator, @radix-ui/react-tabs, @radix-ui/react-toast, @radix-ui/react-toggle, @radix-ui/react-checkbox (+4 more)

### Community 14 - "types.ts"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 15 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, noImplicitAny, noUnusedLocals, noUnusedParameters, paths, skipLibCheck, strictNullChecks (+2 more)

## Knowledge Gaps
- **243 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+238 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **238 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `MenuManagement.tsx`, `useToast`, `database.ts`, `PlatformAdmin.tsx`, `hooks/use-toast.ts`, `TableManagement.tsx`, `KitchenView.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `class-variance-authority`, `clsx`, `cmdk`, `framer-motion`, `html2canvas`, `lucide-react`, `next-themes`, `qrcode.react`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `react`, `react-day-picker`, `react-dom`, `react-router-dom`, `recharts`, `sonner`, `@supabase/supabase-js`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `vaul`, `zod`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _243 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._
- **Should `useToast` be split into smaller, more focused modules?**
  _Cohesion score 0.06866002214839424 - nodes in this community are weakly interconnected._
- **Should `database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08558558558558559 - nodes in this community are weakly interconnected._