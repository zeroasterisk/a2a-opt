# Tech Debt Backlog - a2a-opt

Generated: 2026-02-16

## High Priority

(None identified - codebase is clean and well-structured)

## Medium Priority

### Type Completeness
- [ ] **types.ts** - Consider making `tasks?` required on Plan when `includeTasks: true`
  - Currently returns `Plan` with optional tasks even when explicitly requested
- [ ] **handler.ts** - Return type for `handle()` uses generic `<T>` which loses type safety
  - Consider overloading for each method with specific return types

### Error Messages
- [ ] **handler.ts** - JSON-RPC error messages could include more context
  - e.g., "Missing required parameter: name" could say "in objectives/create"

### Validation
- [ ] Add validation for:
  - Objective/Plan name length limits
  - Metadata key/value constraints
  - Task count per plan (respect `maxTasksPerPlan` param)

## Low Priority

### Code Quality
- [ ] **store.ts:generateId** - Consider using crypto.randomUUID() instead of Math.random()
  - Current implementation is fine for non-security contexts but UUID is more standard
- [ ] **extension.ts** - Headers type handling could be simplified with a utility function
- [ ] Add JSDoc @example tags to exported functions

### Testing
- [ ] Add property-based tests for state transitions
- [ ] Add concurrent access tests for InMemoryOPTStore
- [ ] Add performance benchmarks for store operations

### Documentation
- [ ] Add CONTRIBUTING.md with development setup
- [ ] Add architecture diagram showing OPT ↔ A2A relationship
- [ ] Document extension negotiation flow

## Notes
- Excellent test coverage (store, handler, extension all tested) ✅
- No hardcoded values found ✅
- Clean separation of concerns (types, store, handler, extension) ✅
- State machine transitions properly validated ✅
- Well-documented with TypeScript interfaces ✅

## Strengths to Maintain
- Comprehensive type exports
- Clear state transition rules
- Good use of constants for metadata keys
- Proper JSON-RPC error codes
