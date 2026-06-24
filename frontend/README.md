# docus frontend

Nx workspace for the docus frontend: the standalone `docus-app` and the
publishable `@sneat/extension-docus-{contract,shared}` libraries
(extension library-architecture convention — see the
[root README](../README.md#library-structure-extension-library-architecture-convention)).

- **Nx** 22 · **Angular** 21 · **Ionic** 8 · **pnpm**

## Setup

```bash
pnpm install
```

## Common tasks

```bash
pnpm exec nx serve docus-app          # run the app locally
pnpm exec nx build ext-docus-shared   # build a publishable tier library
pnpm exec nx run-many -t lint test build
pnpm exec nx e2e docus-app-e2e        # end-to-end tests
```

## Layout

```
frontend/
├── apps/
│   └── docus-app/                  # standalone docus.app (Ionic shell)
└── libs/
    └── extensions/docus/
        ├── contract/                # @sneat/extension-docus-contract
        └── shared/                  # @sneat/extension-docus-shared
```

> Projects are generated incrementally during the extraction; see the repo
> root README for the overall plan.
