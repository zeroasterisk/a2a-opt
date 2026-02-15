/**
 * Extension activation and metadata helpers for OPT.
 * 
 * Provides utilities for:
 * - Extension activation via X-A2A-Extensions header
 * - Metadata key management (opt/v1/ prefix)
 * - AgentCard extension declaration
 */

import {
  OPT_EXTENSION_URI,
  OPT_METADATA,
  Objective,
  Plan,
  PlanTask,
  OPTExtensionDeclaration,
  OPTExtensionParams,
} from './types.js';

// =============================================================================
// Extension Header
// =============================================================================

/**
 * HTTP header used to activate A2A extensions.
 */
export const A2A_EXTENSIONS_HEADER = 'X-A2A-Extensions';

/**
 * Check if the OPT extension is requested in headers.
 * 
 * @param headers - HTTP headers (Map, Headers, or plain object)
 * @returns true if OPT extension is activated
 * 
 * @example
 * ```typescript
 * const headers = new Headers({ 'X-A2A-Extensions': 'https://github.com/zeroasterisk/a2a-opt/v1' });
 * if (isOPTActivated(headers)) {
 *   // Enable OPT features
 * }
 * ```
 */
export function isOPTActivated(
  headers: Headers | Map<string, string> | Record<string, string | undefined>
): boolean {
  let value: string | undefined | null;
  
  if (headers instanceof Headers) {
    value = headers.get(A2A_EXTENSIONS_HEADER);
  } else if (headers instanceof Map) {
    value = headers.get(A2A_EXTENSIONS_HEADER) ?? headers.get(A2A_EXTENSIONS_HEADER.toLowerCase());
  } else {
    value = headers[A2A_EXTENSIONS_HEADER] ?? headers[A2A_EXTENSIONS_HEADER.toLowerCase()];
  }
  
  if (!value) return false;
  
  // Header can contain multiple URIs separated by commas
  const uris = value.split(',').map(u => u.trim());
  return uris.includes(OPT_EXTENSION_URI);
}

/**
 * Parse all extension URIs from the header.
 */
export function parseExtensionsHeader(value: string): string[] {
  return value.split(',').map(u => u.trim()).filter(Boolean);
}

/**
 * Build the extensions header value.
 */
export function buildExtensionsHeader(uris: string[]): string {
  return uris.join(', ');
}

// =============================================================================
// Metadata Helpers
// =============================================================================

/**
 * Set OPT metadata on an A2A task.
 * 
 * @param metadata - Existing metadata object (will be mutated)
 * @param planTask - The PlanTask to extract IDs from
 * @returns The mutated metadata object
 * 
 * @example
 * ```typescript
 * const taskMetadata = setOPTMetadata({}, planTask);
 * // {
 * //   'opt/v1/objectiveId': 'obj-123',
 * //   'opt/v1/planId': 'plan-456',
 * //   'opt/v1/taskIndex': 0,
 * //   'opt/v1/dependencies': ['task-789']
 * // }
 * ```
 */
export function setOPTMetadata(
  metadata: Record<string, unknown>,
  planTask: PlanTask
): Record<string, unknown> {
  metadata[OPT_METADATA.OBJECTIVE_ID] = planTask.objectiveId;
  metadata[OPT_METADATA.PLAN_ID] = planTask.planId;
  metadata[OPT_METADATA.TASK_INDEX] = planTask.taskIndex;
  
  if (planTask.dependencies && planTask.dependencies.length > 0) {
    metadata[OPT_METADATA.DEPENDENCIES] = planTask.dependencies;
  }
  
  return metadata;
}

/**
 * Extract OPT metadata from an A2A task.
 * 
 * @param metadata - A2A task metadata
 * @returns Extracted OPT fields, or null if not an OPT task
 */
export function getOPTMetadata(
  metadata: Record<string, unknown> | undefined
): {
  objectiveId: string;
  planId: string;
  taskIndex: number;
  dependencies?: string[];
} | null {
  if (!metadata) return null;
  
  const objectiveId = metadata[OPT_METADATA.OBJECTIVE_ID];
  const planId = metadata[OPT_METADATA.PLAN_ID];
  const taskIndex = metadata[OPT_METADATA.TASK_INDEX];
  
  if (typeof objectiveId !== 'string' || typeof planId !== 'string') {
    return null;
  }
  
  const result: {
    objectiveId: string;
    planId: string;
    taskIndex: number;
    dependencies?: string[];
  } = {
    objectiveId,
    planId,
    taskIndex: typeof taskIndex === 'number' ? taskIndex : 0,
  };
  
  const dependencies = metadata[OPT_METADATA.DEPENDENCIES];
  if (Array.isArray(dependencies)) {
    result.dependencies = dependencies as string[];
  }
  
  return result;
}

/**
 * Check if metadata indicates this is an OPT-managed task.
 */
export function isOPTTask(metadata: Record<string, unknown> | undefined): boolean {
  return getOPTMetadata(metadata) !== null;
}

/**
 * Set an objective in message metadata.
 */
export function setObjectiveInMetadata(
  metadata: Record<string, unknown>,
  objective: Objective
): Record<string, unknown> {
  metadata[OPT_METADATA.OBJECTIVE] = objective;
  return metadata;
}

/**
 * Get an objective from message metadata.
 */
export function getObjectiveFromMetadata(
  metadata: Record<string, unknown> | undefined
): Objective | null {
  if (!metadata) return null;
  const obj = metadata[OPT_METADATA.OBJECTIVE];
  if (!obj || typeof obj !== 'object') return null;
  return obj as Objective;
}

/**
 * Set a plan in message metadata.
 */
export function setPlanInMetadata(
  metadata: Record<string, unknown>,
  plan: Plan
): Record<string, unknown> {
  metadata[OPT_METADATA.PLAN] = plan;
  return metadata;
}

/**
 * Get a plan from message metadata.
 */
export function getPlanFromMetadata(
  metadata: Record<string, unknown> | undefined
): Plan | null {
  if (!metadata) return null;
  const plan = metadata[OPT_METADATA.PLAN];
  if (!plan || typeof plan !== 'object') return null;
  return plan as Plan;
}

// =============================================================================
// AgentCard Helpers
// =============================================================================

/**
 * Create an OPT extension declaration for AgentCard.
 * 
 * @param params - Optional extension parameters
 * @returns Extension declaration to add to capabilities.extensions
 * 
 * @example
 * ```typescript
 * const agentCard = {
 *   name: 'My Agent',
 *   capabilities: {
 *     extensions: [
 *       createOPTExtensionDeclaration({
 *         maxPlansPerObjective: 10,
 *         maxTasksPerPlan: 50,
 *         persistenceEnabled: true
 *       })
 *     ]
 *   }
 * };
 * ```
 */
export function createOPTExtensionDeclaration(
  params?: OPTExtensionParams,
  required: boolean = false
): OPTExtensionDeclaration {
  return {
    uri: OPT_EXTENSION_URI,
    required,
    params,
  };
}

/**
 * Default extension parameters.
 */
export const DEFAULT_OPT_PARAMS: OPTExtensionParams = {
  maxPlansPerObjective: 10,
  maxTasksPerPlan: 50,
  persistenceEnabled: false,
};

/**
 * Check if an agent card supports the OPT extension.
 */
export function agentSupportsOPT(agentCard: {
  capabilities?: {
    extensions?: Array<{ uri: string; required?: boolean }>;
  };
}): boolean {
  const extensions = agentCard?.capabilities?.extensions;
  if (!extensions || !Array.isArray(extensions)) return false;
  return extensions.some(ext => ext.uri === OPT_EXTENSION_URI);
}

/**
 * Get OPT extension params from an agent card.
 */
export function getOPTParams(agentCard: {
  capabilities?: {
    extensions?: Array<{ uri: string; params?: OPTExtensionParams }>;
  };
}): OPTExtensionParams | null {
  const extensions = agentCard?.capabilities?.extensions;
  if (!extensions || !Array.isArray(extensions)) return null;
  
  const optExt = extensions.find(ext => ext.uri === OPT_EXTENSION_URI);
  return optExt?.params ?? null;
}
