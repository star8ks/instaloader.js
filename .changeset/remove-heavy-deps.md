---
"@vicociv/instaloader": minor
---

### Breaking Changes
None

### Features
- Replace `uuid` dependency with lightweight native `crypto.randomUUID()` implementation
- Replace `tough-cookie` dependency (~132KB) with simple custom `SimpleCookieStore` class
- Use GET method for anonymous GraphQL requests (works without retry)
- Use POST method only for authenticated requests

### Improvements
- Significantly reduced package size by removing external dependencies
- Added code quality tools: Prettier, Husky, lint-staged, commitlint
- Added GitHub Actions CI/CD workflows
- Added changesets for automated versioning and changelog generation

### Developer Experience
- Pre-commit hooks for linting and formatting
- Conventional commit message validation
- Automated release workflow with changesets
