# Repository Guidelines

## Project Structure & Module Organization

Project Spark is a WeChat H5 marketing lottery system, currently documented but not implemented. All project content lives in `docs/`:

- `project-spark-mvp-requirements.md`: MVP scope, priorities, and simplified business rules.
- `project-spark-v1-business-requirements.md`: broader V1 business requirements and user journeys.
- `project-spark-wechat-auth-flow.md`: silent OAuth, session handling, activity state transitions, and illustrative API/code examples.

The design proposes `spark-h5`, `spark-api`, and `spark-admin`; these are planned module names, not existing directories. There are no source, test, or asset directories yet.

## Build, Test, and Development Commands

No package manifest, build system, local server, or automated test command is configured. Use these repository checks from the root:

- `rg --files docs`: list the specification files.
- `rg -n 'nextStep|openid|LOTTERY' docs`: locate related state and identity references before editing.
- `git diff --check`: detect whitespace errors in tracked changes.
- `git diff -- docs`: review specification changes before committing.

When adding executable modules, document their actual installation, development, build, and test commands alongside them.

## Documentation Style & Naming Conventions

Keep existing specifications in Chinese and preserve established business terminology. Name new documents using lowercase kebab-case, following `project-spark-<topic>.md`. Use descriptive Markdown headings, blank lines between blocks, and fenced examples with language labels such as `ts`, `sql`, or `text`.

Match surrounding list and code indentation; avoid unrelated reformatting. No formatter, linter, or repository-wide source-code style is configured. Treat embedded TypeScript and SQL as design examples, not a confirmed implementation stack.

## Testing & Review Guidelines

No test framework, test naming convention, or coverage threshold exists. Preview changed Markdown and check headings, links, tables, and code fences. Cross-check affected rules across all three documents, especially one draw per user/activity, stock handling, redemption, and session recovery. Flag conflicting requirements explicitly rather than silently choosing one interpretation.

## Commit & Pull Request Guidelines

History currently contains only `add doc`, so no formal commit convention is established. Use short, action-oriented subjects, for example `Clarify redemption expiry rules`.

Pull requests should describe the change, affected documents, business impact, and validation performed. Link relevant issues when available and identify unresolved decisions. Include screenshots only when they help explain rendered documentation or future UI changes.
