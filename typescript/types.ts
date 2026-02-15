/**
 * A2A OPT Extension - TypeScript Types
 * 
 * Objective-Plan-Task extension for A2A protocol.
 * Extension URI: https://github.com/zeroasterisk/a2a-opt/v1
 */

// =============================================================================
// Core Types
// =============================================================================

export type ObjectiveStatus =
  | 'submitted'    // Just created
  | 'planning'     // Agent is creating/refining plans
  | 'working'      // Plans are being executed
  | 'blocked'      // Waiting on external input
  | 'completed'    // All plans completed successfully
  | 'failed'       // Objective cannot be achieved
  | 'canceled';    // User canceled

export type PlanStatus =
  | 'pending'      // Not yet started
  | 'working'      // Tasks are being executed
  | 'blocked'      // Waiting on dependencies or input
  | 'completed'    // All tasks completed
  | 'failed'       // Plan cannot be completed
  | 'skipped';     // Plan was skipped (alternative chosen)

export interface Objective {
  id: string;
  name: string;
  description?: string;
  status: ObjectiveStatus;
  plans?: Plan[];
  metadata?: Record<string, unknown>;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

export interface Plan {
  id: string;
  objectiveId: string;
  name: string;
  description?: string;
  status: PlanStatus;
  tasks?: PlanTask[];
  dependencies?: string[];  // Plan IDs that must complete first
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanTask {
  id: string;
  planId: string;
  objectiveId: string;
  name: string;
  description?: string;
  taskIndex: number;        // Order within plan (0-indexed)
  dependencies?: string[];  // PlanTask IDs that must complete first
  a2aTaskId?: string;       // Linked A2A Task ID
  status?: string;          // Mirrors A2A task state
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Metadata Keys
// =============================================================================

/**
 * Metadata keys used in A2A Task metadata to link to OPT.
 * 
 * Example usage:
 * ```typescript
 * const task = {
 *   id: "task-123",
 *   metadata: {
 *     [OPT_METADATA.OBJECTIVE_ID]: "obj-456",
 *     [OPT_METADATA.PLAN_ID]: "plan-789",
 *     [OPT_METADATA.TASK_INDEX]: 0,
 *   }
 * }
 * ```
 */
export const OPT_METADATA = {
  /** ID of parent objective */
  OBJECTIVE_ID: 'opt/v1/objectiveId',
  /** ID of parent plan */
  PLAN_ID: 'opt/v1/planId',
  /** Position within plan (0-indexed) */
  TASK_INDEX: 'opt/v1/taskIndex',
  /** IDs of tasks that must complete first */
  DEPENDENCIES: 'opt/v1/dependencies',
  /** Full objective object (in message metadata) */
  OBJECTIVE: 'opt/v1/objective',
  /** Full plan object (in message metadata) */
  PLAN: 'opt/v1/plan',
} as const;

/** Extension URI for activation */
export const OPT_EXTENSION_URI = 'https://github.com/zeroasterisk/a2a-opt/v1';

// =============================================================================
// RPC Request/Response Types
// =============================================================================

// objectives/create
export interface CreateObjectiveRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateObjectiveResponse {
  objective: Objective;
}

// objectives/get
export interface GetObjectiveRequest {
  id: string;
  includePlans?: boolean;
  includeTasks?: boolean;
}

export interface GetObjectiveResponse {
  objective: Objective;
}

// objectives/list
export interface ListObjectivesRequest {
  status?: ObjectiveStatus;
  pageSize?: number;
  pageToken?: string;
}

export interface ListObjectivesResponse {
  objectives: Objective[];
  nextPageToken?: string;
  totalSize?: number;
}

// objectives/update
export interface UpdateObjectiveRequest {
  id: string;
  name?: string;
  description?: string;
  status?: ObjectiveStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateObjectiveResponse {
  objective: Objective;
}

// plans/create
export interface CreatePlanRequest {
  objectiveId: string;
  name: string;
  description?: string;
  tasks?: Array<{
    name: string;
    description?: string;
    dependencies?: string[];  // References by index: "task-0", "task-1"
  }>;
  dependencies?: string[];  // Plan IDs
  metadata?: Record<string, unknown>;
}

export interface CreatePlanResponse {
  plan: Plan;
}

// plans/get
export interface GetPlanRequest {
  id: string;
  includeTasks?: boolean;
}

export interface GetPlanResponse {
  plan: Plan;
}

// plans/update
export interface UpdatePlanRequest {
  id: string;
  name?: string;
  description?: string;
  status?: PlanStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdatePlanResponse {
  plan: Plan;
}

// =============================================================================
// Agent Card Extension Declaration
// =============================================================================

export interface OPTExtensionParams {
  maxPlansPerObjective?: number;
  maxTasksPerPlan?: number;
  persistenceEnabled?: boolean;
}

/**
 * Add to AgentCard.capabilities.extensions:
 * 
 * ```json
 * {
 *   "uri": "https://github.com/zeroasterisk/a2a-opt/v1",
 *   "required": false,
 *   "params": {
 *     "maxPlansPerObjective": 10,
 *     "maxTasksPerPlan": 50
 *   }
 * }
 * ```
 */
export interface OPTExtensionDeclaration {
  uri: typeof OPT_EXTENSION_URI;
  required?: boolean;
  params?: OPTExtensionParams;
}

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Interface for OPT persistence.
 * Implement this to store objectives/plans in your backend.
 */
export interface OPTStore {
  // Objectives
  createObjective(data: CreateObjectiveRequest): Promise<Objective>;
  getObjective(id: string): Promise<Objective | null>;
  listObjectives(params: ListObjectivesRequest): Promise<ListObjectivesResponse>;
  updateObjective(id: string, updates: Partial<Objective>): Promise<Objective | null>;
  deleteObjective(id: string): Promise<boolean>;

  // Plans
  createPlan(data: CreatePlanRequest): Promise<Plan>;
  getPlan(id: string): Promise<Plan | null>;
  getPlansForObjective(objectiveId: string): Promise<Plan[]>;
  updatePlan(id: string, updates: Partial<Plan>): Promise<Plan | null>;
  deletePlan(id: string): Promise<boolean>;

  // Tasks
  getTasksForPlan(planId: string): Promise<PlanTask[]>;
  updatePlanTask(id: string, updates: Partial<PlanTask>): Promise<PlanTask | null>;
  linkA2ATask(planTaskId: string, a2aTaskId: string): Promise<void>;
}
