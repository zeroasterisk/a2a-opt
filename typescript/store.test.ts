/**
 * Tests for InMemoryOPTStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOPTStore, generateId, timestamp } from './store.js';

describe('InMemoryOPTStore', () => {
  let store: InMemoryOPTStore;

  beforeEach(() => {
    store = new InMemoryOPTStore();
  });

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with prefix', () => {
      const id = generateId('obj');
      expect(id).toMatch(/^obj-/);
    });

    it('generates IDs without prefix', () => {
      const id = generateId();
      expect(id).not.toContain('-');
    });
  });

  describe('timestamp', () => {
    it('returns ISO 8601 format', () => {
      const ts = timestamp();
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  // ===========================================================================
  // Objectives
  // ===========================================================================

  describe('createObjective', () => {
    it('creates an objective with required fields', async () => {
      const obj = await store.createObjective({ name: 'Test Objective' });
      
      expect(obj.id).toMatch(/^obj-/);
      expect(obj.name).toBe('Test Objective');
      expect(obj.status).toBe('submitted');
      expect(obj.createdAt).toBeDefined();
      expect(obj.updatedAt).toBeDefined();
    });

    it('creates an objective with optional fields', async () => {
      const obj = await store.createObjective({
        name: 'Test',
        description: 'A description',
        metadata: { key: 'value' },
      });
      
      expect(obj.description).toBe('A description');
      expect(obj.metadata).toEqual({ key: 'value' });
    });

    it('initializes with empty plans array', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      expect(obj.plans).toEqual([]);
    });
  });

  describe('getObjective', () => {
    it('returns null for non-existent objective', async () => {
      const result = await store.getObjective('non-existent');
      expect(result).toBeNull();
    });

    it('returns objective with plans populated', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan 1',
      });

      const result = await store.getObjective(obj.id);
      expect(result?.plans).toHaveLength(1);
      expect(result?.plans?.[0].name).toBe('Plan 1');
    });
  });

  describe('listObjectives', () => {
    it('returns empty list when no objectives', async () => {
      const result = await store.listObjectives({});
      expect(result.objectives).toEqual([]);
      expect(result.totalSize).toBe(0);
    });

    it('returns all objectives', async () => {
      await store.createObjective({ name: 'Obj 1' });
      await store.createObjective({ name: 'Obj 2' });
      
      const result = await store.listObjectives({});
      expect(result.objectives).toHaveLength(2);
      expect(result.totalSize).toBe(2);
    });

    it('filters by status', async () => {
      const obj1 = await store.createObjective({ name: 'Obj 1' });
      await store.createObjective({ name: 'Obj 2' });
      await store.updateObjective(obj1.id, { status: 'working' });
      
      const result = await store.listObjectives({ status: 'working' });
      expect(result.objectives).toHaveLength(1);
      expect(result.objectives[0].status).toBe('working');
    });

    it('paginates results', async () => {
      await store.createObjective({ name: 'Obj 1' });
      await store.createObjective({ name: 'Obj 2' });
      await store.createObjective({ name: 'Obj 3' });
      
      const page1 = await store.listObjectives({ pageSize: 2 });
      expect(page1.objectives).toHaveLength(2);
      expect(page1.nextPageToken).toBe('2');
      
      const page2 = await store.listObjectives({ pageSize: 2, pageToken: '2' });
      expect(page2.objectives).toHaveLength(1);
      expect(page2.nextPageToken).toBeUndefined();
    });

    it('sorts by createdAt descending', async () => {
      await store.createObjective({ name: 'First' });
      await new Promise(r => setTimeout(r, 5)); // Small delay
      await store.createObjective({ name: 'Second' });
      
      const result = await store.listObjectives({});
      expect(result.objectives[0].name).toBe('Second');
      expect(result.objectives[1].name).toBe('First');
    });
  });

  describe('updateObjective', () => {
    it('returns null for non-existent objective', async () => {
      const result = await store.updateObjective('non-existent', { name: 'New' });
      expect(result).toBeNull();
    });

    it('updates name', async () => {
      const obj = await store.createObjective({ name: 'Old' });
      const updated = await store.updateObjective(obj.id, { name: 'New' });
      
      expect(updated?.name).toBe('New');
    });

    it('updates status', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      const updated = await store.updateObjective(obj.id, { status: 'working' });
      
      expect(updated?.status).toBe('working');
    });

    it('preserves id and createdAt', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      const updated = await store.updateObjective(obj.id, { name: 'New' });
      
      expect(updated?.id).toBe(obj.id);
      expect(updated?.createdAt).toBe(obj.createdAt);
    });

    it('updates updatedAt timestamp', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      await new Promise(r => setTimeout(r, 5));
      const updated = await store.updateObjective(obj.id, { name: 'New' });
      
      expect(updated?.updatedAt).not.toBe(obj.updatedAt);
    });
  });

  describe('deleteObjective', () => {
    it('returns false for non-existent objective', async () => {
      const result = await store.deleteObjective('non-existent');
      expect(result).toBe(false);
    });

    it('deletes objective', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      const result = await store.deleteObjective(obj.id);
      
      expect(result).toBe(true);
      expect(await store.getObjective(obj.id)).toBeNull();
    });

    it('deletes associated plans and tasks', async () => {
      const obj = await store.createObjective({ name: 'Test' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task 1' }],
      });
      
      await store.deleteObjective(obj.id);
      
      expect(await store.getPlan(plan.id)).toBeNull();
      expect(await store.getTasksForPlan(plan.id)).toEqual([]);
    });
  });

  // ===========================================================================
  // Plans
  // ===========================================================================

  describe('createPlan', () => {
    it('creates a plan with required fields', async () => {
      const obj = await store.createObjective({ name: 'Objective' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Test Plan',
      });
      
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.objectiveId).toBe(obj.id);
      expect(plan.name).toBe('Test Plan');
      expect(plan.status).toBe('pending');
    });

    it('creates plan with tasks', async () => {
      const obj = await store.createObjective({ name: 'Objective' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [
          { name: 'Task 1', description: 'First task' },
          { name: 'Task 2', description: 'Second task' },
        ],
      });
      
      expect(plan.tasks).toHaveLength(2);
      expect(plan.tasks?.[0].name).toBe('Task 1');
      expect(plan.tasks?.[0].taskIndex).toBe(0);
      expect(plan.tasks?.[1].taskIndex).toBe(1);
    });

    it('resolves task dependencies by index', async () => {
      const obj = await store.createObjective({ name: 'Objective' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [
          { name: 'Task 0' },
          { name: 'Task 1', dependencies: ['task-0'] },
          { name: 'Task 2', dependencies: ['task-0', 'task-1'] },
        ],
      });
      
      const tasks = plan.tasks!;
      expect(tasks[0].dependencies).toEqual([]);
      expect(tasks[1].dependencies).toContain(tasks[0].id);
      expect(tasks[2].dependencies).toContain(tasks[0].id);
      expect(tasks[2].dependencies).toContain(tasks[1].id);
    });

    it('sets objectiveId on tasks', async () => {
      const obj = await store.createObjective({ name: 'Objective' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });
      
      expect(plan.tasks?.[0].objectiveId).toBe(obj.id);
      expect(plan.tasks?.[0].planId).toBe(plan.id);
    });
  });

  describe('getPlan', () => {
    it('returns null for non-existent plan', async () => {
      const result = await store.getPlan('non-existent');
      expect(result).toBeNull();
    });

    it('returns plan with tasks populated', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });

      const result = await store.getPlan(plan.id);
      expect(result?.tasks).toHaveLength(1);
    });
  });

  describe('getPlansForObjective', () => {
    it('returns empty array when no plans', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plans = await store.getPlansForObjective(obj.id);
      expect(plans).toEqual([]);
    });

    it('returns plans sorted by createdAt', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      await store.createPlan({ objectiveId: obj.id, name: 'Plan 1' });
      await new Promise(r => setTimeout(r, 5));
      await store.createPlan({ objectiveId: obj.id, name: 'Plan 2' });
      
      const plans = await store.getPlansForObjective(obj.id);
      expect(plans[0].name).toBe('Plan 1');
      expect(plans[1].name).toBe('Plan 2');
    });
  });

  describe('updatePlan', () => {
    it('returns null for non-existent plan', async () => {
      const result = await store.updatePlan('non-existent', { name: 'New' });
      expect(result).toBeNull();
    });

    it('updates plan status', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({ objectiveId: obj.id, name: 'Plan' });
      
      const updated = await store.updatePlan(plan.id, { status: 'working' });
      expect(updated?.status).toBe('working');
    });
  });

  describe('deletePlan', () => {
    it('returns false for non-existent plan', async () => {
      const result = await store.deletePlan('non-existent');
      expect(result).toBe(false);
    });

    it('deletes plan and its tasks', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });
      
      const result = await store.deletePlan(plan.id);
      expect(result).toBe(true);
      expect(await store.getPlan(plan.id)).toBeNull();
      expect(await store.getTasksForPlan(plan.id)).toEqual([]);
    });
  });

  // ===========================================================================
  // Tasks
  // ===========================================================================

  describe('getTasksForPlan', () => {
    it('returns tasks sorted by taskIndex', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [
          { name: 'Task 0' },
          { name: 'Task 1' },
          { name: 'Task 2' },
        ],
      });
      
      const tasks = await store.getTasksForPlan(plan.id);
      expect(tasks.map(t => t.taskIndex)).toEqual([0, 1, 2]);
    });
  });

  describe('updatePlanTask', () => {
    it('returns null for non-existent task', async () => {
      const result = await store.updatePlanTask('non-existent', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('updates task status', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });
      
      const taskId = plan.tasks![0].id;
      const updated = await store.updatePlanTask(taskId, { status: 'completed' });
      expect(updated?.status).toBe('completed');
    });
  });

  describe('linkA2ATask', () => {
    it('throws for non-existent task', async () => {
      await expect(store.linkA2ATask('non-existent', 'a2a-123'))
        .rejects.toThrow('PlanTask not found');
    });

    it('links A2A task ID', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      const plan = await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });
      
      const taskId = plan.tasks![0].id;
      await store.linkA2ATask(taskId, 'a2a-task-123');
      
      const tasks = await store.getTasksForPlan(plan.id);
      expect(tasks[0].a2aTaskId).toBe('a2a-task-123');
    });
  });

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  describe('clear', () => {
    it('removes all data', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task' }],
      });
      
      store.clear();
      
      const counts = store.getCounts();
      expect(counts).toEqual({ objectives: 0, plans: 0, tasks: 0 });
    });
  });

  describe('getCounts', () => {
    it('returns correct counts', async () => {
      const obj = await store.createObjective({ name: 'Obj' });
      await store.createPlan({
        objectiveId: obj.id,
        name: 'Plan',
        tasks: [{ name: 'Task 1' }, { name: 'Task 2' }],
      });
      
      const counts = store.getCounts();
      expect(counts).toEqual({ objectives: 1, plans: 1, tasks: 2 });
    });
  });
});
