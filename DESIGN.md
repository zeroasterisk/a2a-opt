# A2A OPT Extension Design

## Overview

The OPT (Objective-Plan-Task) extension adds hierarchical task management to A2A. This document describes how clients and servers interact using OPT.

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

This is important: **the server decides** whether work requires task tracking or can be answered directly.

## OPT Extension Flow

OPT extends this pattern. When the server determines work requires planning, it creates an Objective with Plans and Tasks.

### Activation

Client activates OPT via HTTP header:
```
A2A-Extensions: https://github.com/zeroasterisk/a2a-opt/v1
```

### Starting a Conversation

Client sends a standard `message/send`:

```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": 1,
  "params": {
    "message": {
      "messageId": "msg-123",
      "role": "user",
      "parts": [{"type": "text", "text": "Research AI safety papers and write a summary"}]
    }
  }
}
```

### Server Response (With Planning)

Server decides this needs planning, creates Objective + Plans, returns:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "task": {
      "id": "task-001",
      "contextId": "obj-abc",
      "status": {"state": "working", "timestamp": "..."},
      "metadata": {
        "opt/v1/objectiveId": "obj-abc",
        "opt/v1/planId": "plan-001",
        "opt/v1/taskIndex": 0
      }
    }
  }
}
```

Key points:
- `contextId` equals `objectiveId` — all tasks in this objective share context
- Metadata links task to its plan and objective
- Task state is "working" — server is processing

### Server Response (Simple, No Planning)

For simple requests, server may skip planning entirely:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "message": {
      "role": "agent",
      "parts": [{"type": "text", "text": "2 + 2 = 4"}]
    }
  }
}
```

No Objective, no Plan, no Task — just a direct answer.

### Fetching the Objective Hierarchy

After receiving a task with OPT metadata, client can fetch the full structure:

```json
{
  "jsonrpc": "2.0",
  "method": "objectives/get",
  "id": 2,
  "params": {
    "id": "obj-abc",
    "includePlans": true,
    "includeTasks": true
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "objective": {
      "id": "obj-abc",
      "name": "Research AI safety papers and write a summary",
      "status": "working",
      "plans": [
        {
          "id": "plan-001",
          "name": "Research",
          "status": "working",
          "tasks": [
            {"id": "task-001", "name": "Search papers", "status": "working"},
            {"id": "task-002", "name": "Summarize findings", "status": "pending"}
          ]
        },
        {
          "id": "plan-002",
          "name": "Writing",
          "status": "pending",
          "tasks": [
            {"id": "task-003", "name": "Write summary", "status": "pending"}
          ]
        }
      ]
    }
  }
}
```

### Lifecycle Updates

As the server progresses through tasks:

1. Task completes → server updates task status
2. All tasks in plan complete → plan status becomes "completed"
3. All plans complete → objective status becomes "completed"

Client can poll `objectives/get` or `tasks/get` for updates, or use streaming if supported.

## Context Mapping

```
contextId = objectiveId = scope of related work
```

- All tasks within an Objective share the same `contextId`
- This allows A2A's built-in context features to work with OPT
- `tasks/list` with `contextId` filter returns all tasks for an objective

## Who Decides When to Plan?

**The server (agent) decides.** This is consistent with A2A's design where the server chooses whether to return a Task or Message.

The server may use heuristics:
- Simple factual question → direct Message response
- Multi-step request → create Objective + Plans
- Ambiguous → create minimal Objective, add Plans as needed

Clients can provide hints (see Alternatives below) but the server makes the final call.

---

## Alternatives Considered

### Option A: Raw message/send, Server Creates Objective Implicitly

```json
// Client sends
{"method": "message/send", "params": {"message": {...}}}

// Server returns task with OPT metadata (if it decided to plan)
{"result": {"task": {"metadata": {"opt/v1/objectiveId": "..."}}}}
```

**Pros:**
- Simple client implementation
- Server has full control
- Works with existing A2A clients (they just ignore OPT metadata)

**Cons:**
- Client doesn't know an Objective exists until it inspects metadata
- No way for client to influence planning decision
- Client must poll to discover hierarchy

### Option B: Client Explicitly Creates Objective

```json
// Client sends
{"method": "objectives/create", "params": {"name": "Research AI safety..."}}

// Server returns objective
{"result": {"objective": {"id": "obj-abc", "status": "planning"}}}

// Then client sends message to objective's context
{"method": "message/send", "params": {"message": {..., "contextId": "obj-abc"}}}
```

**Pros:**
- Client explicitly controls when Objectives are created
- Clear two-phase: create structure, then execute

**Cons:**
- Client must decide up-front if planning is needed
- More complex client implementation
- Breaks the "server decides" principle of A2A

### Option C: message/send with OPT Hints (Recommended)

```json
// Client sends with optional hint
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

// Server returns task + objective (if it agreed planning was needed)
{
  "result": {
    "task": {...},
    "objective": {
      "id": "obj-abc",
      "name": "AI Safety Research",
      "status": "working",
      "plans": [...]
    }
  }
}
```

**Pros:**
- Client can hint preference without mandating
- Server still decides (may ignore hint for simple requests)
- Single round-trip returns both task and hierarchy
- Backward compatible — servers without OPT ignore metadata hints

**Cons:**
- Slightly more complex than Option A
- Hint semantics need clear definition

### Recommendation

**Option C** with fallback to **Option A** behavior.

- Default: Client sends plain `message/send`, server decides
- Enhanced: Client can add `opt/v1/preferObjective` hint
- Server always makes final decision
- Response includes objective if one was created

This maintains A2A's "server decides" principle while giving clients influence.

---

## Metadata Keys Reference

| Key | Location | Type | Description |
|-----|----------|------|-------------|
| `opt/v1/objectiveId` | Task.metadata | string | Parent objective ID |
| `opt/v1/planId` | Task.metadata | string | Parent plan ID |
| `opt/v1/taskIndex` | Task.metadata | number | Position in plan (0-indexed) |
| `opt/v1/preferObjective` | Message.metadata | boolean | Hint: client prefers Objective creation |
| `opt/v1/suggestedName` | Message.metadata | string | Hint: suggested Objective name |

---

## Open Questions

1. **Streaming updates:** Should objective/plan status changes be streamed alongside task updates? Or separate subscription?

2. **Plan modification mid-flight:** Can server add/remove plans after objective is created? How does client discover changes?

3. **Human-in-the-loop:** How does "input-required" state propagate from task to plan to objective?
