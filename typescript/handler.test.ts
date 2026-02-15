/**
 * Tests for OPTHandler.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OPTHandler, JSON_RPC_ERRORS, isValidObjectiveTransition, isValidPlanTransition } from './handler.js';
import { InMemoryOPTStore } from './store.js';

describe('OPTHandler', () => {
  let store: InMemoryOPTStore;
  let handler: OPTHandler;

  beforeEach(() => {
    store = new InMemoryOPTStore();
    handler = new OPTHandler(store);
  });

  // ===========================================================================
  // Handler Basics
  // ===========================================================================

  describe('canHandle', () => {
    it('returns true for supported methods', () => {
      expect(handler.canHandle('objectives/create')).toBe(true);
      expect(handler.canHandle('objectives/get')).toBe(true);
      expect(handler.canHandle('objectives/list')).toBe(true);
      expect(handler.canHandle('objectives/update')).toBe(true);
      expect(handler.canHandle('plans/create')).toBe(true);
      expect(handler.canHandle('plans/get')).toBe(true);
      expect(handler.canHandle('plans/update')).toBe(true);
    });

    it('returns false for unsupported methods', () => {
      expect(handler.canHandle('unknown/method')).toBe(false);
      expect(handler.canHandle('tasks/create')).toBe(false);
    });
  });

  describe('getSupportedMethods', () => {
    it('returns all supported methods', () => {
      const methods = handler.getSupportedMethods();
      expect(methods).toContain('objectives/create');
      expect(methods).toContain('plans/update');
      expect(methods).toHaveLength(7);
    });
  });

  describe('handle', () => {
    it('returns error for unknown method', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'unknown/method',
        id: '1',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    });

    it('preserves request id in response', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        id: 'request-123',
        params: { name: 'Test' },
      });

      expect(response.id).toBe('request-123');
    });

    it('handles numeric request id', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        id: 42,
        params: { name: 'Test' },
      });

      expect(response.id).toBe(42);
    });
  });

  // ===========================================================================
  // objectives/create
  // ===========================================================================

  describe('objectives/create', () => {
    it('creates an objective', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        id: '1',
        params: {
          name: 'Test Objective',
          description: 'A test',
        },
      });

      expect(response.result).toBeDefined();
      expect(response.result?.objective).toBeDefined();
      expect(response.result?.objective.name).toBe('Test Objective');
      expect(response.result?.objective.status).toBe('submitted');
    });

    it('returns error without name', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        id: '1',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(response.error?.message).toContain('name');
    });
  });

  // ===========================================================================
  // objectives/get
  // ===========================================================================

  describe('objectives/get', () => {
    it('gets an objective', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Test' },
      });
      const objId = createRes.result?.objective.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/get',
        id: '1',
        params: { id: objId },
      });

      expect(response.result?.objective).toBeDefined();
      expect(response.result?.objective.id).toBe(objId);
    });

    it('returns error for non-existent objective', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/get',
        id: '1',
        params: { id: 'non-existent' },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JSON_RPC_ERRORS.NOT_FOUND);
    });

    it('returns error without id', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/get',
        id: '1',
        params: {},
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
    });

    it('excludes plans when includePlans is false', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Test' },
      });
      const objId = createRes.result?.objective.id;
      
      await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: { objectiveId: objId, name: 'Plan' },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/get',
        params: { id: objId, includePlans: false },
      });

      expect(response.result?.objective.plans).toBeUndefined();
    });

    it('excludes tasks when includeTasks is false', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Test' },
      });
      const objId = createRes.result?.objective.id;
      
      await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objId,
          name: 'Plan',
          tasks: [{ name: 'Task' }],
        },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/get',
        params: { id: objId, includeTasks: false },
      });

      expect(response.result?.objective.plans?.[0].tasks).toBeUndefined();
    });
  });

  // ===========================================================================
  // objectives/list
  // ===========================================================================

  describe('objectives/list', () => {
    it('lists objectives', async () => {
      await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Obj 1' },
      });
      await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Obj 2' },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/list',
        id: '1',
      });

      expect(response.result?.objectives).toHaveLength(2);
      expect(response.result?.totalSize).toBe(2);
    });

    it('filters by status', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Obj 1' },
      });
      await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Obj 2' },
      });
      await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        params: { id: createRes.result?.objective.id, status: 'working' },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/list',
        params: { status: 'working' },
      });

      expect(response.result?.objectives).toHaveLength(1);
    });

    it('handles empty params', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/list',
        id: '1',
        params: undefined,
      });

      expect(response.result?.objectives).toBeDefined();
    });
  });

  // ===========================================================================
  // objectives/update
  // ===========================================================================

  describe('objectives/update', () => {
    it('updates an objective', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Old Name' },
      });
      const objId = createRes.result?.objective.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        id: '1',
        params: { id: objId, name: 'New Name' },
      });

      expect(response.result?.objective.name).toBe('New Name');
    });

    it('validates status transitions', async () => {
      const createRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Test' },
      });
      const objId = createRes.result?.objective.id;

      // submitted → working is valid
      let response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        params: { id: objId, status: 'working' },
      });
      expect(response.result?.objective.status).toBe('working');

      // working → submitted is invalid
      response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        params: { id: objId, status: 'submitted' },
      });
      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_STATE);
    });

    it('returns error without id', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        params: { name: 'Test' },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
    });

    it('returns error for non-existent objective', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/update',
        params: { id: 'non-existent', name: 'Test' },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.NOT_FOUND);
    });
  });

  // ===========================================================================
  // plans/create
  // ===========================================================================

  describe('plans/create', () => {
    it('creates a plan', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const objId = objRes.result?.objective.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        id: '1',
        params: {
          objectiveId: objId,
          name: 'Test Plan',
        },
      });

      expect(response.result?.plan).toBeDefined();
      expect(response.result?.plan.name).toBe('Test Plan');
      expect(response.result?.plan.objectiveId).toBe(objId);
    });

    it('creates plan with tasks', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const objId = objRes.result?.objective.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objId,
          name: 'Plan',
          tasks: [
            { name: 'Task 1' },
            { name: 'Task 2' },
          ],
        },
      });

      expect(response.result?.plan.tasks).toHaveLength(2);
    });

    it('returns error for non-existent objective', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: 'non-existent',
          name: 'Plan',
        },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.NOT_FOUND);
    });

    it('returns error without objectiveId', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: { name: 'Plan' },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
    });

    it('returns error without name', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: { objectiveId: objRes.result?.objective.id },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
    });
  });

  // ===========================================================================
  // plans/get
  // ===========================================================================

  describe('plans/get', () => {
    it('gets a plan', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const planRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objRes.result?.objective.id,
          name: 'Plan',
        },
      });
      const planId = planRes.result?.plan.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/get',
        id: '1',
        params: { id: planId },
      });

      expect(response.result?.plan).toBeDefined();
      expect(response.result?.plan.id).toBe(planId);
    });

    it('returns error for non-existent plan', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/get',
        params: { id: 'non-existent' },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.NOT_FOUND);
    });

    it('excludes tasks when includeTasks is false', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const planRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objRes.result?.objective.id,
          name: 'Plan',
          tasks: [{ name: 'Task' }],
        },
      });

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/get',
        params: { id: planRes.result?.plan.id, includeTasks: false },
      });

      expect(response.result?.plan.tasks).toBeUndefined();
    });
  });

  // ===========================================================================
  // plans/update
  // ===========================================================================

  describe('plans/update', () => {
    it('updates a plan', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const planRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objRes.result?.objective.id,
          name: 'Old Name',
        },
      });
      const planId = planRes.result?.plan.id;

      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/update',
        id: '1',
        params: { id: planId, name: 'New Name' },
      });

      expect(response.result?.plan.name).toBe('New Name');
    });

    it('validates status transitions', async () => {
      const objRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'objectives/create',
        params: { name: 'Objective' },
      });
      const planRes = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/create',
        params: {
          objectiveId: objRes.result?.objective.id,
          name: 'Plan',
        },
      });
      const planId = planRes.result?.plan.id;

      // pending → working is valid
      let response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/update',
        params: { id: planId, status: 'working' },
      });
      expect(response.result?.plan.status).toBe('working');

      // working → pending is invalid
      response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/update',
        params: { id: planId, status: 'pending' },
      });
      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_STATE);
    });

    it('returns error for non-existent plan', async () => {
      const response = await handler.handle({
        jsonrpc: '2.0',
        method: 'plans/update',
        params: { id: 'non-existent', name: 'Test' },
      });

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.NOT_FOUND);
    });
  });
});

// =============================================================================
// State Transition Tests
// =============================================================================

describe('State Transitions', () => {
  describe('isValidObjectiveTransition', () => {
    it('allows same status', () => {
      expect(isValidObjectiveTransition('submitted', 'submitted')).toBe(true);
      expect(isValidObjectiveTransition('working', 'working')).toBe(true);
    });

    it('allows valid forward transitions', () => {
      expect(isValidObjectiveTransition('submitted', 'planning')).toBe(true);
      expect(isValidObjectiveTransition('submitted', 'working')).toBe(true);
      expect(isValidObjectiveTransition('planning', 'working')).toBe(true);
      expect(isValidObjectiveTransition('working', 'completed')).toBe(true);
      expect(isValidObjectiveTransition('working', 'failed')).toBe(true);
    });

    it('allows cancel from most states', () => {
      expect(isValidObjectiveTransition('submitted', 'canceled')).toBe(true);
      expect(isValidObjectiveTransition('planning', 'canceled')).toBe(true);
      expect(isValidObjectiveTransition('working', 'canceled')).toBe(true);
      expect(isValidObjectiveTransition('blocked', 'canceled')).toBe(true);
    });

    it('blocks invalid transitions', () => {
      expect(isValidObjectiveTransition('completed', 'working')).toBe(false);
      expect(isValidObjectiveTransition('working', 'submitted')).toBe(false);
      expect(isValidObjectiveTransition('completed', 'canceled')).toBe(false);
    });

    it('allows retry from failed', () => {
      expect(isValidObjectiveTransition('failed', 'submitted')).toBe(true);
      expect(isValidObjectiveTransition('failed', 'planning')).toBe(true);
    });

    it('allows restart from canceled', () => {
      expect(isValidObjectiveTransition('canceled', 'submitted')).toBe(true);
    });
  });

  describe('isValidPlanTransition', () => {
    it('allows same status', () => {
      expect(isValidPlanTransition('pending', 'pending')).toBe(true);
    });

    it('allows valid forward transitions', () => {
      expect(isValidPlanTransition('pending', 'working')).toBe(true);
      expect(isValidPlanTransition('working', 'completed')).toBe(true);
      expect(isValidPlanTransition('working', 'failed')).toBe(true);
      expect(isValidPlanTransition('working', 'blocked')).toBe(true);
    });

    it('allows skip from pending', () => {
      expect(isValidPlanTransition('pending', 'skipped')).toBe(true);
    });

    it('blocks invalid transitions', () => {
      expect(isValidPlanTransition('completed', 'working')).toBe(false);
      expect(isValidPlanTransition('skipped', 'working')).toBe(false);
      expect(isValidPlanTransition('working', 'pending')).toBe(false);
    });

    it('allows retry from failed', () => {
      expect(isValidPlanTransition('failed', 'pending')).toBe(true);
      expect(isValidPlanTransition('failed', 'working')).toBe(true);
    });
  });
});
