# Seiri

A quiet, local-first todo list built with React and Bun.

## Development

```sh
bun install
bun run dev
```

The development server opens at `http://localhost:3000`.

## Validation

```sh
bun run typecheck
bun test
bun run e2e
bun run build
```

Tasks are stored in the browser under the versioned `seiri.tasks.v1`
localStorage key. There is no account or server-side data store.
