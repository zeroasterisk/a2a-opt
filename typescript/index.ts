/**
 * A2A OPT Extension
 * 
 * Objective-Plan-Task: Hierarchical task management for A2A agents.
 * 
 * @packageDocumentation
 */

// Core types
export * from './types.js';

// In-memory store implementation
export { InMemoryOPTStore, generateId, timestamp } from './store.js';

// JSON-RPC handler
export {
  OPTHandler,
  OPTError,
  isValidObjectiveTransition,
  isValidPlanTransition,
  JSON_RPC_ERRORS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcError,
  type MethodHandler,
} from './handler.js';

// Extension helpers
export {
  A2A_EXTENSIONS_HEADER,
  isOPTActivated,
  parseExtensionsHeader,
  buildExtensionsHeader,
  setOPTMetadata,
  getOPTMetadata,
  isOPTTask,
  setObjectiveInMetadata,
  getObjectiveFromMetadata,
  setPlanInMetadata,
  getPlanFromMetadata,
  createOPTExtensionDeclaration,
  DEFAULT_OPT_PARAMS,
  agentSupportsOPT,
  getOPTParams,
} from './extension.js';
