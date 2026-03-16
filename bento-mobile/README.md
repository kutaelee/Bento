# Bento Mobile

`Bento Mobile` is a separate mobile-first app scaffold that does not modify the existing `Bento` web app or workspace packages.

## Product Target

- Target user: mobile users who need quick access to Bento files, recents, shares, and media from a phone
- Core problem: the existing Bento surface is web-oriented and does not yet provide a dedicated mobile-first shell
- Target journey: open app, review recents, browse files, inspect media, return to home without desktop navigation overhead
- Desired business outcome: validate a dedicated mobile experience without destabilizing the current Bento product
- Why separate: this slice isolates mobile UX experiments from the existing web product and reduces blast radius

## Eval Contract

- Success criteria:
  - app boots independently from `~/Bento/bento-mobile`
  - mobile shell includes clear home, recents, library, media, and profile entry points
  - layout is mobile-first and usable at narrow widths
- Non-goals:
  - production auth
  - backend integration
  - replacing the existing Bento web UI
- Acceptance criteria:
  - `pnpm dev` starts a dedicated mobile app
  - app renders a first usable mobile home screen
  - no existing `Bento` package files need modification
- Failure criteria:
  - root workspace files are changed
  - mobile shell depends on desktop layout assumptions
  - app cannot run independently

## Run

```bash
cd ~/Bento/bento-mobile
pnpm install
pnpm dev
```

## Scope

Current slice includes:

- standalone Vite + React mobile shell
- route map for Bento feature parity
- mobile IA for core, auth, shared, admin, and system surfaces
- parity manifest for later API wiring

## Functional Parity Target

The mobile app is expected to cover the same functional surface as Bento:

- Core: files, folder tree, recent, favorites, shared, media, trash, search
- Auth: login, setup, invite accept
- Admin: users, storage, migration, performance, jobs, audit, security, appearance
- System: health, capabilities, performance profile, read-only mode visibility

This directory is the isolated mobile delivery lane for that scope.
