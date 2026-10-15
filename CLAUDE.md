# Belot

Web app for playing Bulgarian belot with friends. Plan in `docs/PLAN.md`, rules in `docs/RULES.md`.

## Git
- No AI trail anywhere: no `Co-Authored-By: Claude` line, no "Generated with Claude Code" footer, no AI mention in commit messages, PR descriptions or docs.
- Commit small logical steps as you go, never a whole feature at once.

## Conventions
- Code, docs and commit messages in English; the app UI is in Bulgarian.
- `packages/engine` is pure and deterministic (no I/O, no randomness); everything in it is unit-tested.
- Run `pnpm test` and `pnpm typecheck` before committing.
