# Experimental static browser build

This branch adapts [DishwasherBench](https://github.com/composo-ai/DishwasherBench) so the web client calls a session worker in the visitor's browser. Jolt physics runs locally in WebAssembly. A second worker runs the wash using browser WebGPU where available and a CPU fallback otherwise. No game server is required.

**Experimental:** WebGPU compatibility, full-size loads, long-running CPU washes, and scoring parity across platforms require further testing. A game exists only in the current tab; reloading loses it. Browser runs are not verified benchmark records. WebGL is required for the original 3D interface. The CPU fallback can be very slow.

## Build

Use upstream's Node and pnpm requirements:

```sh
corepack enable
pnpm install --frozen-lockfile
node scripts/check-static-upstream.mjs
pnpm --filter @spotless/web typecheck
pnpm exec tsx apps/web/scripts/static-browser.e2e.ts
VITE_STATIC_MODE=true pnpm --filter @spotless/web build
```

The result is `apps/web/dist`. Serve it as static files over HTTPS. Relative asset paths support GitHub Pages project URLs; the same output can be uploaded to another static host. GitHub Pages must be configured to use GitHub Actions as the source. The browser smoke test checks local sessions, placing a plate and an empty wash without API requests; it does not validate WebGPU or a loaded-item wash. The workflow builds on updates to `static-browser`, publishes a downloadable `dishwasherbench-static` artifact for R2 or other hosts, and deploys to Pages once Pages is enabled. It can also be run manually.

## Updating upstream

Keep `main` tracking upstream. Fetch and merge the new upstream main into `static-browser` (or rebase the branch), resolve conflicts, then run the type check, build and browser gameplay tests. The adapter is under `apps/web/src/static/`; changes to upstream client files are limited to selecting the adapter, audio base URL and Vite base. The compatibility check stops the build if the copied wash conversion or its calibrated defaults change; update the adapter after reviewing upstream changes. The adapter uses upstream's internal drawing and reporting interfaces; they can change between releases.

Upstream's MIT licence and third-party notices apply; see `LICENSE` and `THIRD_PARTY_NOTICES.md`.
