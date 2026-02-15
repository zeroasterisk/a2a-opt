# A2A OPT Extension Design

## Overview

The OPT (Objective-Plan-Task) extension adds hierarchical task management to A2A. This document describes how clients and servers interact using OPT.

## Core Principle: A2A Tasks ARE the Tasks

**Important:** OPT doesn't create a parallel task system. It uses **A2A Tasks** as the atomic unit of work, adding hierarchy via metadata.

```
Objective (goal)
  └── Plan (approach)
       └── A2A Task (work item)  ← This IS the standard A2A Task
```

The OPT extension:
1. Links A2A Tasks to Plans and Objectives via `metadata`
2. Adds RPC methods to manage the hierarchy
3. Uses `contextId` to group related tasks

## State Alignment with A2A

OPT states **match** A2A Task states where applicable:

| A2A TaskState | OPT Equivalent | Used In |
|---------------|----------------|---------|
| `submitted` | `submitted` | Objective, Task |
| `working` | `working` | Objective, Plan, Task |
| `completed` | `completed` | Objective, Plan, Task |
| `failed` | `failed` | Objective, Plan, Task |
| `canceled` | `canceled` | Objective, Task |
| `input-required` | `blocked` | Objective, Plan, Task |
| `auth-required` | `blocked` | Task only |
| — | `planning` | Objective only |
| — | `pending` | Plan only (not started) |
| — | `skipped` | Plan only (alternative chosen) |

**Key insight:** `input-required` at task level bubbles up as `blocked` at plan/objective level.

## Metadata Convention

All OPT metadata uses the `opt/v1/` prefix:

```json
{
  "id": "task-123",
  "contextId": "obj-abc",
  "status": {"state": "working"},
  "metadata": {
    "opt/v1/objectiveId": "obj-abc",
    "opt/v1/planId": "plan-456",
    "opt/v1/taskIndex": 0,
    "opt/v1/dependencies": ["task-122"]
  }
}
```

**Rule:** `contextId` SHOULD equal `objectiveId` for all tasks in an objective.

## Core A2A Flow (Baseline)

Per the [A2A specification](https://a2a-protocol.org/latest/specification/), `message/send` is "the primary operation for initiating agent interactions":

```
Client                                    Server (Agent)
   |                                           |
   |  message/send (user message)              |
   |------------------------------------------>|
   |                                           |
   |         Task or Message response          |
   |<------------------------------------------|
```

The spec states:
> "The agent MAY create a new Task to process the provided message asynchronously or MAY return a direct Message response for simple interactions."

**The server decides** whether work requires task tracking.

## OPT Extension Flow

### Activation

Client activates OPT via HTTP header:
```
A2A-Extensions: https://github.com/zeroasterisk/a2a-opt/v1
```

### Flow 1: Server-Initiated Planning

Client sends standard `message/send`. Server decides planning is needed:

```json
// Request
{
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"type": "text", "text": "Research AI safety and write a summary"}]
    }
  }
}

// Response - Server created objective + plan + first task
{
  "result": {
    "task": {
      "id": "task-001",
      "contextId": "obj-abc",
      "status": {"state": "working"},
      "metadata": {
        "opt/v1/objectiveId": "obj-abc",
        "opt/v1/planId": "plan-001",
        "opt/v1/taskIndex": 0
      }
    }
  }
}
```

Client can then fetch full structure via `objectives/get`.

### Flow 2: Client-Initiated Planning

Client explicitly creates objective first:

```json
// Step 1: Create objective
{"method": "objectives/create", "params": {"name": "Research AI safety"}}
// Response: {"result": {"objective": {"id": "obj-abc", "status": "submitted"}}}

// Step 2: Send message in objective context
{
  "method": "message/send",
  "params": {
    "message": {
      "contextId": "obj-abc",
      "parts": [{"type": "text", "text": "Start with recent papers"}]
    }
  }
}
```

### Flow 3: Hint-Based (Recommended)

Client hints preference, server decides:

```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [{"type": "text", "text": "Research AI safety..."}],
      "metadata": {
        "opt/v1/preferObjective": true,
        "opt/v1/suggestedName": "AI Safety Research"
      }
    }
  }
}
```

Server may or may not create an Objective based on complexity assessment.

## RPC Methods

### Objectives

| Method | Description |
|--------|-------------|
| `objectives/create` | Create a new objective |
| `objectives/get` | Get objective with plans/tasks |
| `objectives/list` | List objectives with filters |
| `objectives/update` | Update objective status |
| `objectives/replan` | Pause existing plans, signal replanning |

### Plans

| Method | Description |
|--------|-------------|
| `plans/create` | Create plan under objective |
| `plans/get` | Get plan with tasks |
| `plans/update` | Update plan status |
| `plans/addTasks` | Add tasks to plan (bulk) |

### Tasks

Standard A2A task methods work. OPT adds:

| Method | Description |
|--------|-------------|
| `tasks/get` | Standard + returns OPT metadata |
| `tasks/list` | Filter by `contextId` (= objectiveId) |

## Status Propagation

When a task's state changes, it may affect parent status:

```
Task → input-required
  └── Plan → blocked (if blocking task)
       └── Objective → blocked (if all plans blocked)

Task → completed
  └── Plan → completed (if all tasks done)
       └── Objective → completed (if all plans done)

Task → failed
  └── Plan → failed (depending on criticality)
       └── Objective → failed (if critical plan failed)
```

**Server decides** propagation logic. This is not mandated by the spec.

## Human-in-the-Loop

When a task enters `input-required`:

1. Task status shows what input is needed
2. Plan status becomes `blocked`
3. Client shows task in "inbox" or equivalent UI
4. Human provides input via `message/send` with `contextId`
5. Server resumes task, updates status

```json
// Task requesting input
{
  "id": "task-002",
  "status": {
    "state": "input-required",
    "message": {
      "role": "agent",
      "parts": [{"type": "text", "text": "Which venue do you prefer? A, B, or C?"}]
    }
  }
}

// Human response
{
  "method": "message/send",
  "params": {
    "contextId": "obj-abc",
    "message": {
      "role": "user",
      "parts": [{"type": "text", "text": "Option B"}],
      "metadata": {"opt/v1/taskId": "task-002"}
    }
  }
}
```

## OpenClaw Implementation Notes

### Mapping to openclaw-live

| OPT Concept | openclaw-live | Notes |
|-------------|---------------|-------|
| Objective | `Objective` model | Status enum differs slightly |
| Plan | `Plan` model | Has `objectiveIds` list |
| Task | `A2ATask` model | Uses `planId` directly (should use metadata) |
| contextId | `plan_id` field | Should be `objectiveId` |

### Recommended Changes

1. **Use metadata for OPT fields:**
   ```python
   # Instead of
   task.plan_id = "plan-123"
   
   # Use
   task.metadata["opt/v1/planId"] = "plan-123"
   task.metadata["opt/v1/objectiveId"] = "obj-abc"
   ```

2. **contextId = objectiveId:**
   ```python
   task.context_id = objective.id  # All tasks in objective share context
   ```

3. **Align status enums:**
   - `pending` → `submitted` (for consistency with A2A)
   - `in-progress` → `working`
   - Keep `input-required` (A2A term)

### Gemini Live Tools

The lifecycle tools should use OPT conventions:

```python
def task_create(name, plan_id, objective_id, ...):
    """Create A2A Task linked to plan via OPT metadata."""
    task = A2ATask(
        id=generate_id(),
        context_id=objective_id,  # Important!
        status=TaskStatus(state="submitted"),
        metadata={
            "opt/v1/objectiveId": objective_id,
            "opt/v1/planId": plan_id,
            "opt/v1/taskIndex": next_index,
        }
    )
```

## Open Questions

1. **Streaming updates:** Should objective/plan status changes stream via A2A's existing streaming, or need separate subscription?

2. **Plan modification mid-flight:** How does client discover new plans added by server?

3. **Multi-agent:** When orchestrator delegates to specialist, how are tasks attributed?

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A Extensions Guide](https://a2a-protocol.org/latest/topics/extensions/)
