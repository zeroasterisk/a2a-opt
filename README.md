# A2A OPT Extension

> ⚠️ **Beta** — Tested and working, but spec may evolve. Feedback welcome!

**Objective-Plan-Task:** Hierarchical task management for [A2A Protocol](https://a2a-protocol.org).

🎯 **Extension URI:** `https://github.com/zeroasterisk/a2a-opt/v1`

## Why?

A2A's Task model handles single interactions. Complex work needs hierarchy:

```
Objective: "Write blog post about AI safety"
├── Plan: Research
│   ├── Task: Search papers
│   └── Task: Summarize findings
└── Plan: Writing
    ├── Task: Create outline
    └── Task: Write draft
```

OPT adds this to A2A. Any A2A-compatible agent can use it.

## Quick Start

```javascript
// 1. Create objective
{ "method": "objectives/create", "params": { "name": "Write blog post" } }

// 2. Add plan with tasks
{ "method": "plans/create", "params": { 
  "objectiveId": "obj-123",
  "name": "Research",
  "tasks": [
    { "name": "Search papers" },
    { "name": "Summarize findings" }
  ]
}}

// 3. Update status (cascades automatically!)
{ "method": "tasks/updateStatus", "params": { "id": "task-0", "status": "completed" } }
```

## Data Model

### Objective
Top-level goal.

```typescript
{
  id: "obj-123",
  name: "Write blog post",
  status: "working",  // submitted|planning|working|blocked|completed|failed|canceled
  plans: [...]
}
```

### Plan
Structured approach with ordered tasks.

```typescript
{
  id: "plan-456",
  objectiveId: "obj-123",
  name: "Research Phase",
  status: "working",  // pending|working|blocked|completed|failed|skipped
  tasks: [...]
}
```

### PlanTask
Individual work item, links to A2A Task.

```typescript
{
  id: "task-789",
  planId: "plan-456",
  name: "Search papers",
  taskIndex: 0,
  status: "completed",
  a2aTaskId: "a2a-task-abc"  // optional link
}
```

## Methods

| Method | Description |
|--------|-------------|
| `objectives/create` | Create objective |
| `objectives/get` | Get with plans/tasks |
| `objectives/list` | List (filter by status) |
| `objectives/update` | Update status |
| `plans/create` | Create plan with tasks |
| `plans/get` | Get plan |
| `plans/update` | Update status |
| `tasks/link` | Link to A2A task |
| `tasks/updateStatus` | Update (cascades up!) |

## Metadata Keys

Link A2A Tasks to OPT hierarchy:

| Key | Type | Description |
|-----|------|-------------|
| `opt/v1/objectiveId` | string | Parent objective |
| `opt/v1/planId` | string | Parent plan |
| `opt/v1/taskIndex` | number | Position in plan |

## Agent Card

Declare OPT support:

```json
{
  "capabilities": {
    "extensions": [{
      "uri": "https://github.com/zeroasterisk/a2a-opt/v1",
      "required": false
    }]
  }
}
```

## Implementations

| Implementation | Status |
|----------------|--------|
| [OpenClaw A2A Plugin](https://github.com/zeroasterisk/zaf/tree/main/plugins/a2a) | ✅ Ready |

## Use Cases

- **Multi-step projects** — Track phases with dependencies
- **Human-in-the-loop** — Block plans awaiting approval
- **Multi-agent orchestration** — Delegate plans to specialists
- **Progress visibility** — Show completion in UI

## Links

- [A2A Protocol](https://a2a-protocol.org)
- [A2A Extensions Guide](https://a2a-protocol.org/latest/topics/extensions/)
- [OpenClaw](https://openclaw.ai)

## License

Apache-2.0
