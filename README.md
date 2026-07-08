# vimgram

[日本語版](./README.ja.md)

**Play now: `<deploy URL — TODO: fill in after the Cloudflare Pages deploy>`**

vimgram is a browser game for learning Vim's `operator + motion` editing
grammar — not memorizing individual commands, but training the instinct to
look at a piece of text and see it as a motion.

The core loop:

1. See a prompt describing an edit.
2. Picture the buffer after that edit.
3. Pick the shortest `operator + motion` that gets you there.
4. Do it.
5. See the result.
6. Learn a better way, if there was one.

## Features

- **Judged by final state, not by exact command.** If `df,` and `xxxxxx`
  produce the same text, both count as a clear — there's no single "correct"
  keystroke sequence to memorize.
- **Three-tier evaluation**: clear / **Great** (matched or beat the ideal key
  count) / clear (verbose, with the shorter reference command shown).
- **Command breakdown**: every clear shows your input decomposed into its
  operator, motion, and (for `c` commands) inserted text and `<Esc>`, each
  with a short explanation — in English or Japanese.
- **Comparison-learning challenge pairs**: the same buffer solved with `f`
  vs `t`, `diw` vs `daw`, `ci"` vs `ca"`, and more, so the difference is felt,
  not just read.

## What you can practice

- Operators: `d` (delete), `y` (yank), `c` (change, enters Insert mode),
  plus the single command `x`
- Motions: `h`, `l`, `w`, `e`, `b`, `0`, `$`, `f{char}`, `t{char}`
- Text objects: `iw`/`aw`, `i"`/`a"`, `i'`/`a'`, `i)`/`a)`
- Insert mode (entered only via `c`), exited with `<Esc>`

Everything operates on a single line of text — no multi-line buffers, Visual
mode, or `.` repeat yet (see `CLAUDE.md` for the full scope and roadmap).

## Local development

Requires Node 22 (see `.node-version`) and `pnpm`.

```bash
pnpm install
pnpm dev          # starts the local dev server
pnpm vitest run   # unit tests + challenge data validation
pnpm tsc --noEmit # typecheck
pnpm biome check . # lint/format
```

`public/favicon.png` and `public/apple-touch-icon.png` are one-time renders of
`public/favicon.svg` (via `npx sharp-cli`, no permanent dependency) - if the
source SVG changes, regenerate both with:

```bash
npx sharp-cli -i public/favicon.svg -o public/favicon.png resize 32 32
# apple-touch-icon.png uses the same shapes but with rx="0" (no rounded
# corners) on the background rect, since iOS already rounds the icon itself.
```

## Contributing

Adding a challenge takes one JSON file and no TypeScript — see
[CONTRIBUTING.md](./CONTRIBUTING.md) ([日本語](./CONTRIBUTING.ja.md)) for the
full walkthrough. Challenge contributions, especially comparison-learning
pairs, are very welcome.

## License

[MIT](./LICENSE)
