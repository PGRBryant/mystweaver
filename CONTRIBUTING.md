# Contributing to Labrats

Thank you for your interest in contributing to Labrats! We welcome contributions from the community, whether it's bug reports, feature requests, documentation, or code.

## Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive community for everyone.

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0 and **npm** ≥ 9.0.0
- **Git**
- **Docker** and **Docker Compose** (for local development)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/labrats.git
   cd labrats
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Local Development Environment**
   ```bash
   docker-compose up -d
   ```

4. **Verify Setup**
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```

## Development Workflow

### Creating a Branch

Use a descriptive branch name:

```bash
git checkout -b feature/add-flag-targeting
git checkout -b fix/redis-connection-timeout
git checkout -b docs/api-reference
```

### Making Changes

1. **Write Code** – Ensure it follows the project's style (ESLint/Prettier)
2. **Test** – Run tests locally: `npm run test`
3. **Type Check** – Verify TypeScript: `npm run typecheck`
4. **Lint** – Check formatting: `npm run lint`
5. **Format** – Auto-fix style issues: `npm run format`

### Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
**Scope:** The package or feature area (e.g., `api`, `web`, `sdk-js`)

**Examples:**
```
feat(api): add flag targeting by user segments
fix(sdk-js): handle missing api key gracefully
docs(contributing): add development setup instructions
chore(deps): upgrade typescript to 5.3.3
```

## Submitting Changes

### Pull Requests

1. **Open a PR** against the `main` branch
2. **Describe the change** – Use the PR template
3. **Reference issues** – Link related issues: `Closes #123`
4. **Request review** – Ask team members for feedback
5. **Respond to feedback** – Address review comments

### PR Checklist

- [ ] Code follows project style (ESLint + Prettier)
- [ ] All tests pass locally (`npm run test`)
- [ ] Types are correct (`npm run typecheck`)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Documentation is updated (if applicable)
- [ ] No unrelated changes are included

### CI/CD Pipeline

Every PR runs automated checks:
- **Linting** – Code style enforcement
- **Type Checking** – TypeScript validation
- **Tests** – Unit and integration tests
- **Build** – Ensures the project builds successfully

All checks must pass before merging.

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in a specific workspace
npm run test --workspace=@labrats/api

# Watch mode (re-run on file change)
npm run test -- --watch

# With coverage
npm run test -- --coverage
```

### Writing Tests

- Use **Vitest** for unit tests
- Test file naming: `*.test.ts` or `*.test.tsx`
- Keep tests focused and isolated
- Mock external dependencies (API calls, database)

### Test Coverage

We aim for >80% coverage on critical paths. Check coverage:

```bash
npm run test -- --coverage
```

## Documentation

### Updating Documentation

- **README**: High-level project overview
- **CONTRIBUTING.md**: Development guidelines (this file)
- **Code Comments**: Explain "why", not "what" (code shows what)
- **Inline JSDoc**: Document public APIs

### Documentation Standards

```typescript
/**
 * Check if a feature flag is enabled for a user
 *
 * @param flagKey - The unique identifier for the flag
 * @param context - User context (userId, email, attributes)
 * @returns Promise resolving to true if flag is enabled
 *
 * @example
 * const isEnabled = await client.isEnabled('new-dashboard', {
 *   userId: 'user-123',
 * });
 */
export async function isEnabled(
  flagKey: string,
  context: EvaluationContext,
): Promise<boolean> {
  // ...
}
```

## Reporting Issues

### Bug Reports

Include:
- **Title**: Clear, concise description
- **Version**: Which version you're using
- **Environment**: OS, Node.js version, etc.
- **Steps to Reproduce**: Exact steps to trigger the bug
- **Expected vs Actual**: What should happen vs what happened
- **Logs/Details**: Error messages, stack traces, etc.

### Feature Requests

Include:
- **Title**: What you want to build
- **Use Case**: Why this feature is needed
- **Proposed Solution**: How you'd like it to work
- **Alternatives**: Other approaches considered

## Project Structure Quick Reference

| Directory | Purpose |
|-----------|---------|
| `apps/api` | Express backend server |
| `apps/web` | React admin UI |
| `packages/sdk-js` | JavaScript/TypeScript SDK |
| `packages/sdk-python` | Python SDK |
| `infra/terraform` | GCP infrastructure |
| `config/` | Shared TypeScript configuration |
| `.github/workflows` | CI/CD pipelines |

## Code Standards

### Code Style

- **Language**: TypeScript (strict mode)
- **Formatter**: Prettier (auto-formatted on commit)
- **Linter**: ESLint (runs on PR)
- **Naming**: camelCase for variables/functions, PascalCase for types/classes

### Imports

```typescript
// One default export per file
export default MyClass;

// Multiple named exports allowed
export { helper1, helper2 };

// Order: node stdlib, external packages, local imports
import { readFile } from 'fs';
import express from 'express';
import { UserService } from '@/services/UserService';
```

### Error Handling

```typescript
// Use specific error types
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Avoid bare catch
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle specific error
  } else if (error instanceof Error) {
    logger.error('Unknown error:', error.message);
  }
}
```

## Resources

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Vitest**: https://vitest.dev/
- **Prettier**: https://prettier.io/
- **ESLint**: https://eslint.org/

## Getting Help

- **GitHub Issues**: Ask a question as an issue discussion
- **Slack/Discord** *(coming soon)*: Real-time community chat
- **Documentation**: Check the [docs](https://labrats.dev) *(coming soon)*

## Maintainers

- Core Team: Reviews PRs and guides directions

---

Thank you for contributing to Labrats! 🎉
