# Contributing to SRE-FE

Thank you for your interest in contributing. This document covers everything you need to know before opening a pull request — project conventions, folder structure rules, code style, and the review process.

Please read this fully before writing any code.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Branching and Commits](#branching-and-commits)
- [Pull Request Process](#pull-request-process)
- [Project Structure Rules](#project-structure-rules)
- [Code Rules](#code-rules)
- [Component Rules](#component-rules)
- [API and Data Fetching Rules](#api-and-data-fetching-rules)
- [Styling Rules](#styling-rules)
- [Reusability Rules](#reusability-rules)
- [Efficiency Rules](#efficiency-rules)
- [TypeScript Rules](#typescript-rules)
- [UX Rules](#ux-rules)
- [What Not to Do](#what-not-to-do)

---

## Getting Started

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/your-username/sre-fe.git
cd sre-fe
npm install
```

2. Set up your environment:

```bash
cp .env.example .env
# Edit .env with your local backend URL
```

3. Start the dev server:

```bash
npm run dev
```

4. Before opening a PR, make sure these pass:

```bash
npm run lint
npm run build
```

---

## Branching and Commits

- Branch off `master` for all changes
- Branch naming:
  - `feat/short-description` — new feature
  - `fix/short-description` — bug fix
  - `refactor/short-description` — refactor with no behavior change
  - `chore/short-description` — tooling, config, deps
- Keep commits focused — one logical change per commit
- Write commit messages in the imperative: `add member role dropdown`, not `added` or `adding`
- Do not squash unrelated changes into a single commit

---

## Pull Request Process

1. Open a PR against `master`
2. Fill in the PR description — what changed and why
3. Keep PRs small and focused. One feature or fix per PR
4. Link any related issues in the description
5. Ensure `npm run lint` and `npm run build` pass before requesting review
6. Do not merge your own PR without a review

---

## Project Structure Rules

Follow this folder structure strictly. Do not create folders or files outside of it without discussion.

```
src/
├── api/          # Axios client, endpoint functions, React Query hooks
├── components/   # Shared components (NOT page-specific)
│   └── ui/       # Shadcn UI primitives — never modify directly
├── contexts/     # React context providers
├── layouts/      # Layout wrappers (App, Auth, Root)
├── pages/        # Page components, grouped by domain
├── types/        # Shared TypeScript interfaces and types
└── utils/        # Shared utility functions and hooks
```

**File naming:**
- React components: `PascalCase.tsx` (e.g., `PageHeader.tsx`)
- Hooks and utilities: `camelCase.ts` (e.g., `useDebounce.ts`)
- No special characters in filenames
- Do not create a file unless it is strictly necessary

**Placement rules:**
- Shared UI components → `src/components/`
- Shared utility functions → `src/utils/`
- Shared types and interfaces → `src/types/`
- API endpoint functions and React Query hooks → `src/api/`
- Page-specific components that are not reused → keep them inline in the page file

---

## Code Rules

1. **Do only what is asked.** Do not add features, refactor adjacent code, or make "improvements" beyond the scope of the task.
2. **Make minimal changes.** Touch only what the task requires.
3. **Reuse before creating.** Always check if an existing component, hook, or utility already covers the need before writing new code.
4. **No ambiguous logic.** If the requirement is unclear, ask before writing code. Do not guess.
5. **No TODO stubs.** Do not commit placeholder logic, unused imports, or stub functions.
6. **Try-catch on all async functions.** Every `async` function must have a `try-catch` block.
7. **No console.log in committed code.** Remove all debug logging before opening a PR.
8. **Consistency matters.** Follow the naming conventions, code style, and patterns already in the codebase. When in doubt, match what exists.

---

## Component Rules

1. **No logic inside JSX.** All conditionals, transforms, and derived values must be computed above the `return` statement and stored in named variables.

```tsx
// Bad
return <div>{items.filter(i => i.active).map(i => <Item key={i.id} {...i} />)}</div>

// Good
const activeItems = items.filter(i => i.active)
return <div>{activeItems.map(i => <Item key={i.id} {...i} />)}</div>
```

2. **Comments are one line max.** Only write a comment when the intent is not obvious from the code itself.
3. **Keep components focused.** If a component is doing too much, split the logic out — not the JSX.
4. **Do not repeat logic.** If the same logic appears in more than one place, extract it into a shared utility or hook.
5. **Do not create a component speculatively.** A component is created only when it is used in more than one place or when it meaningfully simplifies a page's JSX.

---

## API and Data Fetching Rules

1. **All HTTP calls go through `src/api/client.ts`.** Never import `axios` directly in a component or page.
2. **Every page with data fetching gets a dedicated hook file** in `src/api/` (e.g., `src/api/useOrgMembers.ts`). Do not inline `useQuery` or `useMutation` inside a component.
3. **Hook files export named hooks only.** No raw Axios calls outside `src/api/`.

```ts
// src/api/useOrgMembers.ts
export function useOrgMembers(orgId: string) { ... }   // useQuery
export function useRemoveMember() { ... }               // useMutation
```

4. **If an endpoint is shared across pages**, define it once in the relevant domain file (`auth.ts`, `orgs.ts`, `users.ts`, etc.) and import it into the hook.
5. **Mutations must invalidate only the specific query keys they affect.** Do not broad-invalidate with `queryClient.invalidateQueries()` without a key.
6. **TanStack Query config:** `staleTime` is 2 minutes. Do not configure automatic retry on 401, 403, or 404.

---

## Styling Rules

1. **Tailwind CSS v4 is the only styling mechanism.** Do not write raw CSS unless adding a global CSS variable or base reset.
2. **No inline `style={{}}`** unless the value is truly dynamic and cannot be expressed with a Tailwind class.
3. **Colors, spacing, and typography** must use Tailwind tokens or CSS variables defined in `index.css`. Do not hardcode hex values or pixel values.
4. **Do not modify files inside `src/components/ui/`.** These are Shadcn UI primitives. To customise a Shadcn component, wrap it in a new file under `src/components/`.
5. **Consistency across the UI.** Use the same spacing, padding, and gap values as the rest of the application. Do not invent a new visual style per component.
6. **Dark/light mode** must use the Shadcn + Tailwind theming system. No manual class toggling.
7. **Add micro-animations** where they improve perceived smoothness — hover transitions, fade-ins on mount, loading skeletons. Use Tailwind's `transition` and `animate` utilities.
8. **Do not overuse the primary blue accent.** Keep it minimal — use it for primary actions and focus states only.

---

## Reusability Rules

- Before creating a new component, check `src/components/` for one that already covers the need
- A component belongs in `src/components/` if it is used in more than one place OR if extracting it meaningfully simplifies a page
- Existing shared components: `PageHeader`, `ConfirmDialog`, `EmptyState`, `LoadingSpinner`, `ErrorBoundary`, `ProviderIcon`
- Utility hooks in `src/utils/`: `useDebounce`, `useCurrentOrgId`
- Shared types in `src/types/index.ts` — add new interfaces here instead of defining them locally

---

## Efficiency Rules

1. **No redundant renders.** Do not define objects, arrays, or functions inside JSX or the render body if they can be defined outside the component or memoized.
2. **All derived state above the return.** Compute it once, store it in a variable, pass it into JSX.
3. **Focused invalidation.** After a mutation, invalidate only the query keys directly affected — not everything.
4. **Debounce search inputs.** Use `useDebounce` from `src/utils/useDebounce.ts` for any text input that triggers a query.

---

## TypeScript Rules

- TypeScript strict mode is enabled — all code must type-check cleanly
- No `any`. Use `unknown` with a type guard, or define the correct interface in `src/types/`
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why it is unavoidable
- All shared interfaces and types go in `src/types/index.ts`
- API response shapes must be typed — do not leave response data as `any`

---

## UX Rules

1. **Every async action needs a loading state.** Disable the triggering button and show a spinner while waiting for a response.
2. **Show toasts for all user-initiated actions** — both on success and on failure. Use Sonner (`src` import from `sonner`).
3. **Show errors inline on forms.** Field validation errors belong under the field, not in a toast.
4. **Every list or table needs an empty state.** Use `<EmptyState />` from `src/components/EmptyState.tsx`.
5. **Every page-level data fetch needs a loading state.** Use `<LoadingSpinner />` while `isLoading` is true.

---

## What Not to Do

- Do not modify `src/components/ui/` — wrap Shadcn primitives instead
- Do not inline `useQuery` or `useMutation` in a page or component
- Do not add `style={{}}` inline styles
- Do not hardcode colors, spacing, or font sizes
- Do not create speculative components or utilities that are not immediately used
- Do not leave unused imports, variables, or commented-out code
- Do not add `console.log` in committed code
- Do not use `any` in TypeScript
- Do not broad-invalidate React Query caches
- Do not push directly to `master`

---

## Questions

Open a GitHub Discussion or file an issue before starting work on a large or uncertain change. It is better to align on approach first than to submit a PR that needs to be redone.
