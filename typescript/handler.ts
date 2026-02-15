/**
 * JSON-RPC method handlers for OPT extension.
 * 
 * Implements the RPC methods defined in the specification:
 * - objectives/create, objectives/get, objectives/list, objectives/update
 * - plans/create, plans/get, plans/update
 */

import {
  OPTStore,
  CreateObjectiveRequest,
  CreateObjectiveResponse,
  GetObjectiveRequest,
  GetObjectiveResponse,
  ListObjectivesRequest,
  ListObjectivesResponse,
  UpdateObjectiveRequest,
  UpdateObjectiveResponse,
  CreatePlanRequest,
  CreatePlanResponse,
  GetPlanRequest,
  GetPlanResponse,
  UpdatePlanRequest,
  UpdatePlanResponse,
} from './types.js';

// =============================================================================
// JSON-RPC Types
// =============================================================================

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  id?: string | number;
  params?: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id?: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Standard JSON-RPC error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom OPT errors
  NOT_FOUND: -32000,
  INVALID_STATE: -32001,
} as const;

// =============================================================================
// Handler
// =============================================================================

export type MethodHandler<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult>;

/**
 * OPT extension RPC handler.
 * 
 * Provides JSON-RPC method handlers for objective and plan management.
 * 
 * @example
 * ```typescript
 * const store = new InMemoryOPTStore();
 * const handler = new OPTHandler(store);
 * 
 * const response = await handler.handle({
 *   jsonrpc: '2.0',
 *   method: 'objectives/create',
 *   id: '1',
 *   params: { name: 'My Objective' }
 * });
 * ```
 */
export class OPTHandler {
  private store: OPTStore;
  private methods: Map<string, MethodHandler>;

  constructor(store: OPTStore) {
    this.store = store;
    this.methods = new Map();
    this.registerMethods();
  }

  private registerMethods(): void {
    // Objectives
    this.methods.set('objectives/create', this.objectivesCreate.bind(this));
    this.methods.set('objectives/get', this.objectivesGet.bind(this));
    this.methods.set('objectives/list', this.objectivesList.bind(this));
    this.methods.set('objectives/update', this.objectivesUpdate.bind(this));
    
    // Plans
    this.methods.set('plans/create', this.plansCreate.bind(this));
    this.methods.set('plans/get', this.plansGet.bind(this));
    this.methods.set('plans/update', this.plansUpdate.bind(this));
  }

  /**
   * Check if this handler can handle the given method.
   */
  canHandle(method: string): boolean {
    return this.methods.has(method);
  }

  /**
   * Get list of supported methods.
   */
  getSupportedMethods(): string[] {
    return Array.from(this.methods.keys());
  }

  /**
   * Handle a JSON-RPC request.
   */
  async handle<T = unknown>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
    const { method, id, params } = request;

    // Check if method is supported
    const handler = this.methods.get(method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          message: `Method not found: ${method}`,
        },
      };
    }

    try {
      const result = await handler(params);
      return {
        jsonrpc: '2.0',
        id,
        result: result as T,
      };
    } catch (error) {
      return this.errorResponse(id, error);
    }
  }

  private errorResponse(
    id: string | number | undefined,
    error: unknown
  ): JsonRpcResponse {
    if (error instanceof OPTError) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: error.code,
          message: error.message,
          data: error.data,
        },
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: JSON_RPC_ERRORS.INTERNAL_ERROR,
        message,
      },
    };
  }

  // =========================================================================
  // Objective Methods
  // =========================================================================

  private async objectivesCreate(
    params: CreateObjectiveRequest
  ): Promise<CreateObjectiveResponse> {
    if (!params?.name) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: name'
      );
    }

    const objective = await this.store.createObjective(params);
    return { objective };
  }

  private async objectivesGet(
    params: GetObjectiveRequest
  ): Promise<GetObjectiveResponse> {
    if (!params?.id) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: id'
      );
    }

    const objective = await this.store.getObjective(params.id);
    if (!objective) {
      throw new OPTError(
        JSON_RPC_ERRORS.NOT_FOUND,
        `Objective not found: ${params.id}`
      );
    }

    // If includePlans is false, remove plans
    if (params.includePlans === false) {
      delete objective.plans;
    }

    // If includeTasks is false, remove tasks from plans
    if (params.includeTasks === false && objective.plans) {
      objective.plans = objective.plans.map(plan => ({
        ...plan,
        tasks: undefined,
      }));
    }

    return { objective };
  }

  private async objectivesList(
    params: ListObjectivesRequest = {}
  ): Promise<ListObjectivesResponse> {
    return this.store.listObjectives(params);
  }

  private async objectivesUpdate(
    params: UpdateObjectiveRequest
  ): Promise<UpdateObjectiveResponse> {
    if (!params?.id) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: id'
      );
    }

    // Validate status transition if status is being changed
    if (params.status) {
      const current = await this.store.getObjective(params.id);
      if (!current) {
        throw new OPTError(
          JSON_RPC_ERRORS.NOT_FOUND,
          `Objective not found: ${params.id}`
        );
      }
      
      if (!isValidObjectiveTransition(current.status, params.status)) {
        throw new OPTError(
          JSON_RPC_ERRORS.INVALID_STATE,
          `Invalid status transition: ${current.status} → ${params.status}`
        );
      }
    }

    const objective = await this.store.updateObjective(params.id, params);
    if (!objective) {
      throw new OPTError(
        JSON_RPC_ERRORS.NOT_FOUND,
        `Objective not found: ${params.id}`
      );
    }

    return { objective };
  }

  // =========================================================================
  // Plan Methods
  // =========================================================================

  private async plansCreate(
    params: CreatePlanRequest
  ): Promise<CreatePlanResponse> {
    if (!params?.objectiveId) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: objectiveId'
      );
    }
    if (!params?.name) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: name'
      );
    }

    // Verify objective exists
    const objective = await this.store.getObjective(params.objectiveId);
    if (!objective) {
      throw new OPTError(
        JSON_RPC_ERRORS.NOT_FOUND,
        `Objective not found: ${params.objectiveId}`
      );
    }

    const plan = await this.store.createPlan(params);
    return { plan };
  }

  private async plansGet(params: GetPlanRequest): Promise<GetPlanResponse> {
    if (!params?.id) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: id'
      );
    }

    const plan = await this.store.getPlan(params.id);
    if (!plan) {
      throw new OPTError(
        JSON_RPC_ERRORS.NOT_FOUND,
        `Plan not found: ${params.id}`
      );
    }

    // If includeTasks is false, remove tasks
    if (params.includeTasks === false) {
      delete plan.tasks;
    }

    return { plan };
  }

  private async plansUpdate(
    params: UpdatePlanRequest
  ): Promise<UpdatePlanResponse> {
    if (!params?.id) {
      throw new OPTError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required parameter: id'
      );
    }

    // Validate status transition if status is being changed
    if (params.status) {
      const current = await this.store.getPlan(params.id);
      if (!current) {
        throw new OPTError(
          JSON_RPC_ERRORS.NOT_FOUND,
          `Plan not found: ${params.id}`
        );
      }
      
      if (!isValidPlanTransition(current.status, params.status)) {
        throw new OPTError(
          JSON_RPC_ERRORS.INVALID_STATE,
          `Invalid status transition: ${current.status} → ${params.status}`
        );
      }
    }

    const plan = await this.store.updatePlan(params.id, params);
    if (!plan) {
      throw new OPTError(
        JSON_RPC_ERRORS.NOT_FOUND,
        `Plan not found: ${params.id}`
      );
    }

    return { plan };
  }
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Custom error for OPT operations.
 */
export class OPTError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'OPTError';
  }
}

// =============================================================================
// State Transitions
// =============================================================================

import { ObjectiveStatus, PlanStatus } from './types.js';

/**
 * Valid objective status transitions.
 */
const VALID_OBJECTIVE_TRANSITIONS: Record<ObjectiveStatus, ObjectiveStatus[]> = {
  submitted: ['planning', 'working', 'canceled'],
  planning: ['working', 'blocked', 'failed', 'canceled'],
  working: ['blocked', 'completed', 'failed', 'canceled'],
  blocked: ['planning', 'working', 'failed', 'canceled'],
  completed: [],  // Terminal state
  failed: ['submitted', 'planning'],  // Can retry
  canceled: ['submitted'],  // Can restart
};

/**
 * Valid plan status transitions.
 */
const VALID_PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  pending: ['working', 'skipped'],
  working: ['blocked', 'completed', 'failed'],
  blocked: ['working', 'failed', 'skipped'],
  completed: [],  // Terminal state
  failed: ['pending', 'working'],  // Can retry
  skipped: [],  // Terminal state
};

/**
 * Check if an objective status transition is valid.
 */
export function isValidObjectiveTransition(
  from: ObjectiveStatus,
  to: ObjectiveStatus
): boolean {
  if (from === to) return true;  // No change is always valid
  return VALID_OBJECTIVE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a plan status transition is valid.
 */
export function isValidPlanTransition(
  from: PlanStatus,
  to: PlanStatus
): boolean {
  if (from === to) return true;  // No change is always valid
  return VALID_PLAN_TRANSITIONS[from]?.includes(to) ?? false;
}
