# Contributing to vimgram

[日本語版](./CONTRIBUTING.ja.md)

The easiest and most welcome way to contribute is **adding a challenge**. You
don't need to write any TypeScript for this — just a JSON file that Vitest
validates automatically. If `pnpm vitest run` passes, your challenge works.

## Adding a challenge

1. Pick an id, e.g. `level2-my-challenge`, and create
   `challenges/level2-my-challenge.json`. Easiest: copy an existing file in
   `challenges/` with a similar shape and edit it.
2. Keep `"$schema": "./schema.json"` at the top — most editors (VS Code
   included) will give you autocomplete and inline validation for every field
   from there on.
3. Fill in `examples[0]` with a key sequence that actually solves your
   challenge from `initial` to `expected`. This is not just documentation —
   it's your challenge's own reference solution, and CI runs it through the
   real engine.
4. Run the checks locally (see below). If they pass, open a PR.

That's the whole process. Nobody manually re-solves your challenge to review
it — the automated checks are the review for correctness. Human review is
just for whether the prompt reads naturally.

## Challenge fields

```ts
type Challenge = {
  id: string; // unique, kebab-case, e.g. "level2-df-comma"
  title: LocalizedText; // short name shown in the challenge list
  prompt: LocalizedText; // the instruction shown to the player
  initial: { text: string; cursor: number; mode: "normal" };
  expected: {
    text: string; // always compared
    cursor?: number; // compared only if present
    mode?: "normal" | "insert"; // compared only if present
    yankRegister?: string; // compared only if present
  };
  constraints?: { timeLimitSec: number };
  hints?: LocalizedText[];
  examples: string[]; // examples[0] is required: the reference solution
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
};

type LocalizedText = { en: string; ja?: string }; // en required, ja optional
```

- `initial.cursor` / motions like `f`/`t` are cursor-position-dependent —
  always state where the cursor starts.
- `expected` only needs the fields that actually matter for your challenge.
  Most challenges only need `text`. Add `yankRegister` for `y`-based
  challenges, `mode: "normal"` for `c`-based challenges that end with `<Esc>`,
  and `cursor` only when the exact landing position is part of the lesson.
- `examples[0]` also determines `idealKeyCount` (used for the Great/verbose
  distinction) — it's derived from this field's key count, not stored
  separately. See "Key notation" below for how to write `<Esc>` etc.
- Buffer text (`initial.text` / `expected.text`) is **always plain ASCII**,
  regardless of language — see "Buffer text isn't translated" below.

### Key notation in `examples`

Printable characters are written as themselves (`d`, `f`, `,`, `"`, ...).
Special keys use Vim-style angle brackets: `<Esc>` for Escape, `<BS>` for
Backspace. For example, `ci"jiro<Esc>` is 8 keys: `c`, `i`, `"`, `j`, `i`,
`r`, `o`, `<Esc>`.

### Buffer text isn't translated

`initial.text` and `expected.text` are always ASCII, code-like text,
regardless of which language(s) the challenge is written in. This keeps word
boundaries, cursor math, and rendering simple, and matches what Vim is
actually used to edit in practice. Only `title` / `prompt` / `hints` are
translated.

## What makes a good challenge

- **Comparison pairs are especially welcome.** The whole point of this game
  is training operator+motion intuition, and nothing teaches `f` vs `t`, or
  `iw` vs `aw`, faster than solving the *same* buffer both ways and seeing
  the difference. If you're adding a challenge for one side of a pair (e.g.
  `df,`), consider adding the `dt,` one too, using the exact same `initial`.
- Keep the buffer short and the lesson focused on one motion/operator
  concept.
- Pick a `difficulty` consistent with the existing curve (see CLAUDE.md's
  "難易度カーブ" if you can read Japanese, or just look at challenges tagged
  similarly to yours for a reference point):
  - 1: basic single delete (`dw`, `d$`, `df,`, `x`, ...)
  - 2: `f` vs `t` discrimination
  - 3-4: text objects (`iw`/`aw`, `i"`/`a"`, `i)`/`a)`), `c` + Insert mode
- `tags` are free-form strings; reuse existing ones (`delete`, `yank`,
  `change`, `find`, `till`, `word`, `quote`, `paren`, `textObject`,
  `comparison`, `count`, ...) where they fit instead of inventing new ones for
  the same concept.

## Translation policy

`en` is required on every `LocalizedText` field; `ja` is optional. You can
submit a challenge with only `en` (or, if you prefer writing in Japanese
first, only `ja` — though `en` is still required per the type, so at minimum
provide a rough `en` version). A missing `ja` is not a CI error; the game
falls back to `en` at runtime, and maintainers fill in missing translations
over time. Don't let translation be a barrier to contributing a challenge.

## Development setup

- Node 22 (see `.node-version` — if you use a version manager like `mise` or
  `nvm`, it should pick this up automatically)
- Package manager: `pnpm`

```bash
pnpm install
pnpm dev          # local dev server
pnpm vitest run   # unit tests + challenge validation
pnpm tsc --noEmit # typecheck
pnpm biome check . # lint/format
```

CI runs all three of `vitest run`, `tsc --noEmit`, and `biome check .` on
every PR — the same three commands above. If they pass locally, they'll pass
in CI.

## Regenerating the JSON Schema

If you change `src/core/challenges.ts`'s Zod schema, regenerate
`challenges/schema.json`:

```bash
pnpm run schema
```

That's the whole step - the script formats its own output. CI checks that
`challenges/schema.json` still matches what this command would generate, so a
forgotten regeneration fails `pnpm vitest run`, not just `biome check`.

## Code contributions

For anything beyond adding a challenge (engine changes, UI changes, etc.),
please open an issue first to discuss the approach — `CLAUDE.md` documents
the project's design principles and current scope in detail.
