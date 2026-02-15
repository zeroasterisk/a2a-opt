# A2A OPT Extension

**Objective-Plan-Task: Hierarchical task management for A2A agents.** Structure complex work into goals, plans, and trackable tasks.

🎯 **Extension URI:** `https://github.com/zeroasterisk/a2a-opt/v1`

---

## TL;DR

A2A's Task model is great for single interactions, but complex agent work needs hierarchy:

```
Objective: "Write a blog post about AI safety"
├── Plan: Research
│   ├── Task: Search for papers
│   ├── Task: Summarize findings
│   └── Task: Find expert quotes
├── Plan: Writing  
│   ├── Task: Create outline
│   ├── Task: Write draft
│   └── Task: Add citations
└── Plan: Review
    └── Task: Self-review
```

OPT adds this to A2A. Any A2A-compatible agent can use it.

```typescript
// Activate extension in your request
headers: { "A2A-Extensions": "https://github.com/zeroasterisk/a2a-opt/v1" }

// Create an objective
{ "method": "objectives/create", "params": { "name": "Write blog post" } }

// Add a plan with tasks
{ "method": "plans/create", "params": { 
  "objectiveId": "obj-123",
  "name": "Research",
  "tasks": [
    { "name": "Search for papers" },
    { "name": "Summarize findings" }
  ]
}}
```

---

## Getting Started

### For A2A Server Implementers

1. **Declare support** in your Agent Card:

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

2. **Implement the RPC methods** (see [Specification](#specification))

3. **Use metadata keys** to link tasks to plans/objectives

### For A2A Clients

1. **Check Agent Card** for OPT support
2. **Activate extension** via header: `A2A-Extensions: https://github.com/zeroasterisk/a2a-opt/v1`
3. **Use OPT methods** to create/manage objectives and plans

### Reference Implementation

- **TypeScript:** See [openclaw-a2a](https://github.com/zeroasterisk/openclaw-a2a) for OpenClaw integration

---

## Specification

### Data Model

#### Objective
The top-level goal or desired outcome.

```typescript
interface Objective {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description?: string;          // Detailed description
  status: ObjectiveStatus;       
  plans?: Plan[];                // Ordered plans
  metadata?: Record<string, unknown>;
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

type ObjectiveStatus = 
  | 'submitted'    // Just created
  | 'planning'     // Creating/refining plans
  | 'working'      // Plans being executed
  | 'blocked'      // Waiting on input
  | 'completed'    // All plans done
  | 'failed'       // Cannot be achieved
  | 'canceled';    // User canceled
```

#### Plan
A structured approach containing ordered tasks.

```typescript
interface Plan {
  id: string;
  objectiveId: string;           // Parent objective
  name: string;
  description?: string;
  status: PlanStatus;
  tasks?: PlanTask[];            // Ordered tasks
  dependencies?: string[];       // Plan IDs that must complete first
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

type PlanStatus =
  | 'pending'      // Not started
  | 'working'      // Tasks executing
  | 'blocked'      // Waiting on dependencies
  | 'completed'    // All tasks done
  | 'failed'       // Cannot complete
  | 'skipped';     // Alternative chosen
```

#### PlanTask
A task within a plan, linked to an A2A Task.

```typescript
interface PlanTask {
  id: string;
  planId: string;
  objectiveId: string;
  name: string;
  description?: string;
  taskIndex: number;             // Order within plan (0-indexed)
  dependencies?: string[];       // PlanTask IDs that must complete first
  a2aTaskId?: string;            // Linked A2A Task ID
  status?: TaskState;            // Mirrors A2A task state
  metadata?: Record<string, unknown>;
}
```

### Metadata Keys

Use these in A2A Task metadata to link tasks to OPT:

| Key | Type | Description |
|-----|------|-------------|
| `opt/v1/objectiveId` | string | Parent objective ID |
| `opt/v1/planId` | string | Parent plan ID |
| `opt/v1/taskIndex` | number | Position in plan |
| `opt/v1/dependencies` | string[] | Task IDs that must complete first |

### RPC Methods

#### objectives/create

```json
{
  "jsonrpc": "2.0",
  "method": "objectives/create",
  "id": "1",
  "params": {
    "name": "Write blog post",
    "description": "About AI safety trends"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "id": "obj-abc123",
    "name": "Write blog post",
    "status": "submitted",
    "createdAt": "2026-02-15T04:30:00Z",
    "updatedAt": "2026-02-15T04:30:00Z"
  }
}
```

#### objectives/get

```json
{
  "method": "objectives/get",
  "params": {
    "id": "obj-abc123",
    "includePlans": true,
    "includeTasks": true
  }
}
```

#### objectives/list

```json
{
  "method": "objectives/list",
  "params": {
    "status": "working",
    "pageSize": 10,
    "pageToken": "..."
  }
}
```

#### objectives/update

```json
{
  "method": "objectives/update",
  "params": {
    "id": "obj-abc123",
    "status": "completed"
  }
}
```

#### plans/create

```json
{
  "method": "plans/create",
  "params": {
    "objectiveId": "obj-abc123",
    "name": "Research phase",
    "tasks": [
      { "name": "Search papers", "description": "Find 5 recent papers" },
      { "name": "Summarize", "dependencies": ["task-0"] }
    ]
  }
}
```

#### plans/get

```json
{
  "method": "plans/get",
  "params": {
    "id": "plan-xyz789",
    "includeTasks": true
  }
}
```

#### plans/update

```json
{
  "method": "plans/update",
  "params": {
    "id": "plan-xyz789",
    "status": "completed"
  }
}
```

### Extension Activation

Clients activate OPT via HTTP header:

```http
POST /a2a HTTP/1.1
A2A-Extensions: https://github.com/zeroasterisk/a2a-opt/v1
Content-Type: application/json
```

Or in message metadata:

```json
{
  "message": {
    "metadata": {
      "opt/v1/objective": { "id": "obj-123", "name": "..." }
    }
  }
}
```

### Agent Card Declaration

```json
{
  "name": "Planning Agent",
  "capabilities": {
    "extensions": [{
      "uri": "https://github.com/zeroasterisk/a2a-opt/v1",
      "required": false,
      "params": {
        "maxPlansPerObjective": 10,
        "maxTasksPerPlan": 50
      }
    }]
  }
}
```

---

## Use Cases

### Multi-Step Projects
Break down complex work into trackable phases with dependencies.

### Human-in-the-Loop
Plans can be `blocked` waiting for approval before proceeding.

### Multi-Agent Orchestration
Orchestrator creates objective, delegates plans to specialist agents.

### Progress Visibility
Clients can query objective status to show progress UI.

---

## Implementations

| Implementation | Language | Status |
|----------------|----------|--------|
| [openclaw-a2a](https://github.com/zeroasterisk/openclaw-a2a) | TypeScript | 🚧 In Progress |

*Want to add yours? Open a PR!*

---

## Version History

- **v1** (2026-02): Initial specification

---

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A Extensions Guide](https://a2a-protocol.org/latest/topics/extensions/)

---

## License

Apache-2.0
