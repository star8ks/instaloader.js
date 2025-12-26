# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Principle

### File Size
- **Maximum file size: 300 lines** - Files exceeding this limit must be split into smaller modules
- Each file should have a single, clear responsibility
- If a file grows beyond 300 lines, extract related functionality into separate modules

### Function Size
- **Maximum function length: 50 lines** - Functions exceeding this must be refactored
- **Ideal function length: 10-20 lines** - Aim for small, focused functions
- Functions should do one thing and do it well (Single Responsibility Principle)
- Extract complex logic into helper functions with descriptive names

### Function Complexity
- **Maximum cyclomatic complexity: 10** - Functions with higher complexity must be simplified
- Reduce nesting levels - prefer early returns and guard clauses
- Maximum nesting depth: 3 levels - deeper nesting requires refactoring
- Use extraction to reduce complexity: extract conditions, loops, and nested logic into separate functions

### Function Parameters
- **Maximum parameters: 3** - Functions with more parameters should use parameter objects
- Prefer options objects for functions with multiple optional parameters
- Use destructuring for cleaner parameter handling

### Code Organization
- **DRY (Don't Repeat Yourself)**: Extract duplicated code into reusable functions/utilities
- **Single Responsibility**: Each function, class, and module should have one clear purpose
- **Separation of Concerns**: Separate business logic from I/O, validation, and formatting
- Group related functions together - organize by feature or responsibility

### Naming
- Use descriptive, intention-revealing names
- Functions should be verbs (e.g., `calculateTotal`, `validateInput`)
- Classes and modules should be nouns (e.g., `RateController`, `InstaloaderContext`)
- Avoid abbreviations unless they're widely understood
- Boolean variables/functions should be questions (e.g., `isValid`, `hasPermission`)

### Comments
- Code should be self-documenting - prefer clear code over comments
- Only add comments when code cannot express intent clearly
- Explain "why" not "what" - the code already shows what it does
- Keep comments up-to-date - outdated comments are worse than no comments 

## Project Overview

This is a TypeScript port of [instaloader](https://github.com/instaloader/instaloader), a Python library for downloading Instagram content (profiles, posts, stories, highlights, etc.). The original Python project is included as a git submodule in `/instaloader/` for reference during porting.

## Commands

```bash
# Build (CJS + ESM + type declarations)
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture

The TypeScript implementation follows the Python instaloader structure:

### Python Source Reference (`/instaloader/instaloader/`)
- `instaloadercontext.py` - HTTP client, session management, rate limiting, GraphQL queries
- `structures.py` - Data models (Post, Profile, Story, Highlight, etc.)
- `nodeiterator.py` - Paginated GraphQL result iterator with resume support
- `instaloader.py` - Main downloader class coordinating all operations
- `exceptions.py` - Exception hierarchy

### TypeScript Implementation (`/src/`)
- `exceptions.ts` - Full exception hierarchy (InstaloaderException base, LoginException, ConnectionException, etc.)
- `types.ts` - TypeScript interfaces for API responses (PostNode, ProfileNode, StoryItemNode, GraphQL types)

## Key Technical Details

- Uses native `fetch` API (requires Node.js 18+)
- Uses `tough-cookie` for cookie/session management
- Strict TypeScript configuration with all strict checks enabled
- Dual-format output (CJS/ESM) via tsup
- Tests use Vitest with 30-second timeout for API-dependent tests

## Porting Notes

When porting from Python, reference the submodule at `/instaloader/instaloader/`. Key patterns:
- Python `requests.Session` → native `fetch` with cookie jar
- Python generators → TypeScript async iterators
- Python dataclasses → TypeScript interfaces/classes with getters
- GraphQL queries use Instagram's internal API endpoints

## Guidelines

### Test-Driven Development
- **Critical**: Follow strict Test-Driven Development (TDD) - always write tests first, then implement
- Write failing tests that define the expected behavior before writing any implementation code
- Only write enough implementation code to make the tests pass
- Refactor after tests pass while keeping tests green
- Every new feature or bug fix should start with a test

### 测试质量规则（严禁违反）

- **测试必须导入并测试实际代码**：测试文件必须 `import` 要测试的函数/模块/组件，并对其进行真实调用和断言。
- **禁止 mock-only 测试**：不允许只创建 mock 数据然后断言 mock 数据本身的测试，这种测试毫无意义。
- **禁止重复实现被测代码**：不允许在测试文件中重新实现要测试的函数逻辑，必须导入原始实现。
- **如果函数是私有的**：要么将其导出以便测试，要么通过公共 API 间接测试其行为。
- **测试不可测代码时必须先重构**：如果逻辑内联在不可测的位置（如回调函数、路由处理器内部），必须**先提取为独立函数/类**，然后再为提取后的代码编写测试。
- **不可依赖 UI 文字**：不要使用 `page.getByPlaceholder('给 Vibe Writer 一条指令')` 这种依赖 UI 文字的方式来测试，因为 placeholder 文字可能会变更，导致测试不稳定。应该给对应的元素加上 `data-testid` 并使用对应的选择器。

#### 错误示例（绝对禁止）

```typescript
// ❌ 只测试 mock 数据
it("should return cached: true", () => {
  const mockResult = { cached: true };
  expect(mockResult.cached).toBe(true);
});

// ❌ 重新实现被测函数
function getSavedMode() {
  return localStorage.getItem("key");
}
it("returns saved mode", () => {
  localStorage.setItem("key", "value");
  expect(getSavedMode()).toBe("value");
});

// ❌ 创建模拟类来测试"逻辑"（最恶劣的反模式）
class UsageAccumulator {
  // ... 重新实现逻辑
}
it("should accumulate usage", () => {
  const acc = new UsageAccumulator();
  acc.add(100);
  expect(acc.total).toBe(100);
});
```

#### 正确做法

```typescript
// ✅ 导入并测试实际代码
import { getSavedMode } from "../myModule";
it("returns saved mode", () => {
  localStorage.setItem("key", "value");
  expect(getSavedMode()).toBe("value");
});

// ✅ 先重构提取可测试单元，再测试
// 1. 在原文件中提取：
// src/utils/usage-accumulator.ts
export class UsageAccumulator {
  // 实际使用的实现
}

// 2. 在测试文件中导入：
// src/utils/__tests__/usage-accumulator.test.ts
import { UsageAccumulator } from "../usage-accumulator";
it("should accumulate usage", () => {
  const acc = new UsageAccumulator();
  // 测试真实实现
});
```

### Task Context

- **Always read `docs/progress.md` at the start of each new conversation** to understand the overall plan and current progress
- Continuously update `docs/progress.md` as work progresses to track what has been completed and what remains
- If `docs/progress.md` doesn't exist, create it with:
  - Overall project plan and goals
  - Current progress status
  - Next steps and priorities
- This document helps maintain focus on the overall objectives during long-running tasks
- Update progress after completing significant milestones or when starting new work sessions

### Commit Strategy
- Always review changes before commits, and write detail change log and review/fix history at docs/change-log.md
- Make frequent, small commits rather than large monolithic commits
- Each commit should represent a single logical change
- Keep commits focused and atomic to maintain a clean git history
- Avoid accumulating many changes into one heavy commit

### Dependency Management
- **Critical**: Do not include heavy dependencies that bundle browsers (e.g., Playwright, Puppeteer)
- Prefer lightweight, focused dependencies that align with the library's core purpose
- Use native Node.js APIs when possible (e.g., `fetch` API instead of external HTTP libraries)
- Evaluate the size and impact of any new dependency before adding it
- Keep the library lightweight and fast to install

### Types
- **Critical**: Never use `any` type - it defeats the purpose of TypeScript's type safety
- Avoid using `unknown` unless absolutely necessary (e.g., when dealing with truly dynamic data from external APIs)
- Always prefer explicit types over `unknown` - use type guards, type assertions, or type narrowing when needed
- Define proper interfaces/types for all data structures, especially API responses
- Use type inference where it improves readability, but be explicit when it adds clarity
- Leverage TypeScript's utility types (`Partial`, `Pick`, `Omit`, `Record`, etc.) when appropriate
- Use discriminated unions for representing different states or variants
- Ensure all function parameters and return types are explicitly typed
- Prefer `interface` for object shapes that might be extended, use `type` for unions, intersections, and computed types 