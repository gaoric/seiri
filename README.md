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

Blocks is a daily timeblocking tool: set waking hours, keep recurring routines,
and drag shared todos and habits onto a day's timeline. The month/year picker
jumps to a specific day. Drag across free time to create a routine, todo, habit,
or zero-duration marker, or use **New block** and enter times.
Routine adjustments can apply to one day or to the default daily structure.
Todos default to 30 minutes and can be sorted by priority, title, status,
estimate, or due date. Habits default to 15 minutes with editable estimates.
Complete or kill todos and log habit checks, levels, or numbers on the timeline;
these changes are shared with Todo and Habits.
Blocks data is stored locally under `seiri.blocks.v1`; habits use `seiri.habits.v1`.
