# Panfactum CLI

A command-line interface for Panfactum.

## Prerequisites

This CLI requires the following dependencies to develop:

- [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- [jq](https://jqlang.github.io/jq/) - Lightweight and flexible command-line JSON processor

## Installation

```bash
bun install
```

## Development

```bash
bun run src/index.ts
```

## Build

```bash
bun build src/index.ts
```

This will create an executable at `./bin/pf`.

## Linting

```bash
bun run lint
```

## Fixing linting errors

```bash
bun run lint:fix
```
