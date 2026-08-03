# Graph Report - .  (2026-07-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 155 nodes · 277 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api.ts
- package.json
- compilerOptions
- devDependencies
- LeaveAPI
- App.tsx
- LeaveDetailPage.tsx
- ToastProvider.tsx
- counter.ts

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 19 edges
2. `compilerOptions` - 16 edges
3. `useAuth()` - 12 edges
4. `LeaveAPI` - 11 edges
5. `HRAPI` - 11 edges
6. `useConfirm()` - 7 edges
7. `HRDashboard()` - 7 edges
8. `EmployeeApprovalRoutesPage()` - 6 edges
9. `LeaveDetailPage()` - 6 edges
10. `ApprovalAPI` - 5 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/contexts/AuthContext.tsx
- `AppRoutes()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/contexts/AuthContext.tsx
- `EmployeeApprovalRoutesPage()` --calls--> `useConfirm()`  [EXTRACTED]
  src/pages/EmployeeApprovalRoutesPage.tsx → src/components/ConfirmDialog.tsx
- `FileLeavePage()` --calls--> `useToast()`  [EXTRACTED]
  src/pages/FileLeavePage.tsx → src/components/ToastProvider.tsx
- `LeaveDetailPage()` --calls--> `useToast()`  [EXTRACTED]
  src/pages/LeaveDetailPage.tsx → src/components/ToastProvider.tsx

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.16
Nodes (21): EmployeeLeaveDetail(), EmployeeLeaveDetailProps, useToast(), api, ApprovalAPI, ApprovalRouteAPI, ApprovalStepInfo, DepartmentAPI (+13 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): axios, clsx, lucide-react, dependencies, axios, clsx, lucide-react, @radix-ui/react-checkbox (+13 more)

### Community 2 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, ES2023, src, vite/client, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx (+13 more)

### Community 3 - "devDependencies"
Cohesion: 0.10
Nodes (21): autoprefixer, devDependencies, autoprefixer, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite, @types/react (+13 more)

### Community 4 - "LeaveAPI"
Cohesion: 0.17
Nodes (14): ConfirmContext, ConfirmFn, ConfirmOptions, ConfirmProvider(), useConfirm(), DashboardStats, LeaveAPI, LeaveBalance (+6 more)

### Community 5 - "App.tsx"
Cohesion: 0.23
Nodes (10): AppRoutes(), ProtectedRoute(), AuthContext, AuthContextType, AuthProvider(), useAuth(), User, AuthAPI (+2 more)

### Community 6 - "LeaveDetailPage.tsx"
Cohesion: 0.22
Nodes (9): AttachmentPreviewModal(), AttachmentPreviewModalProps, Checkbox, Label, LeaveType, cn(), FileLeavePage(), FileQueueItem (+1 more)

### Community 7 - "ToastProvider.tsx"
Cohesion: 0.25
Nodes (6): icons, ToastContext, ToastContextType, ToastItem, ToastProvider(), ToastType

## Knowledge Gaps
- **62 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._