/**
 * In-memory implementation of OPTStore.
 * 
 * This provides a reference implementation for testing and simple use cases.
 * For production, implement OPTStore with persistent storage.
 */

import {
  OPTStore,
  Objective,
  Plan,
  PlanTask,
  CreateObjectiveRequest,
  CreatePlanRequest,
  ListObjectivesRequest,
  ListObjectivesResponse,
} from './types.js';

/**
 * Generate a unique ID with optional prefix.
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Get current ISO 8601 timestamp.
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * In-memory implementation of OPTStore.
 */
export class InMemoryOPTStore implements OPTStore {
  private objectives: Map<string, Objective> = new Map();
  private plans: Map<string, Plan> = new Map();
  private tasks: Map<string, PlanTask> = new Map();

  // =========================================================================
  // Objectives
  // =========================================================================

  async createObjective(data: CreateObjectiveRequest): Promise<Objective> {
    const now = timestamp();
    const objective: Objective = {
      id: generateId('obj'),
      name: data.name,
      description: data.description,
      status: 'submitted',
      plans: [],
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.objectives.set(objective.id, objective);
    return { ...objective };
  }

  async getObjective(id: string): Promise<Objective | null> {
    const objective = this.objectives.get(id);
    if (!objective) return null;
    
    // Populate plans
    const plans = await this.getPlansForObjective(id);
    return { ...objective, plans };
  }

  async listObjectives(params: ListObjectivesRequest): Promise<ListObjectivesResponse> {
    let objectives = Array.from(this.objectives.values());
    
    // Filter by status
    if (params.status) {
      objectives = objectives.filter(o => o.status === params.status);
    }
    
    // Sort by createdAt descending
    objectives.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Pagination
    const pageSize = params.pageSize ?? 10;
    const startIndex = params.pageToken ? parseInt(params.pageToken, 10) : 0;
    const endIndex = startIndex + pageSize;
    const page = objectives.slice(startIndex, endIndex);
    
    return {
      objectives: page.map(o => ({ ...o })),
      nextPageToken: endIndex < objectives.length ? String(endIndex) : undefined,
      totalSize: objectives.length,
    };
  }

  async updateObjective(id: string, updates: Partial<Objective>): Promise<Objective | null> {
    const objective = this.objectives.get(id);
    if (!objective) return null;
    
    // Apply updates (excluding id, createdAt)
    const updated: Objective = {
      ...objective,
      ...updates,
      id: objective.id,
      createdAt: objective.createdAt,
      updatedAt: timestamp(),
    };
    
    this.objectives.set(id, updated);
    return { ...updated };
  }

  async deleteObjective(id: string): Promise<boolean> {
    if (!this.objectives.has(id)) return false;
    
    // Delete associated plans and tasks
    const plans = await this.getPlansForObjective(id);
    for (const plan of plans) {
      await this.deletePlan(plan.id);
    }
    
    this.objectives.delete(id);
    return true;
  }

  // =========================================================================
  // Plans
  // =========================================================================

  async createPlan(data: CreatePlanRequest): Promise<Plan> {
    const now = timestamp();
    const planId = generateId('plan');
    
    // Create the plan
    const plan: Plan = {
      id: planId,
      objectiveId: data.objectiveId,
      name: data.name,
      description: data.description,
      status: 'pending',
      tasks: [],
      dependencies: data.dependencies ?? [],
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    
    // Create tasks if provided
    if (data.tasks && data.tasks.length > 0) {
      const planTasks: PlanTask[] = [];
      const taskIdMap: Map<number, string> = new Map();
      
      for (let i = 0; i < data.tasks.length; i++) {
        const taskData = data.tasks[i];
        const taskId = generateId('task');
        taskIdMap.set(i, taskId);
        
        const planTask: PlanTask = {
          id: taskId,
          planId,
          objectiveId: data.objectiveId,
          name: taskData.name,
          description: taskData.description,
          taskIndex: i,
          dependencies: [],
          status: 'pending',
          metadata: {},
        };
        
        this.tasks.set(taskId, planTask);
        planTasks.push(planTask);
      }
      
      // Resolve task dependencies (e.g., "task-0" → actual ID)
      for (let i = 0; i < data.tasks.length; i++) {
        const taskData = data.tasks[i];
        if (taskData.dependencies) {
          const taskId = taskIdMap.get(i)!;
          const task = this.tasks.get(taskId)!;
          task.dependencies = taskData.dependencies
            .map(dep => {
              const match = dep.match(/^task-(\d+)$/);
              if (match) {
                const index = parseInt(match[1], 10);
                return taskIdMap.get(index);
              }
              return dep;
            })
            .filter((id): id is string => id !== undefined);
          this.tasks.set(taskId, task);
        }
      }
      
      plan.tasks = planTasks;
    }
    
    this.plans.set(planId, plan);
    return { ...plan };
  }

  async getPlan(id: string): Promise<Plan | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;
    
    // Populate tasks
    const tasks = await this.getTasksForPlan(id);
    return { ...plan, tasks };
  }

  async getPlansForObjective(objectiveId: string): Promise<Plan[]> {
    const plans: Plan[] = [];
    for (const plan of this.plans.values()) {
      if (plan.objectiveId === objectiveId) {
        const tasks = await this.getTasksForPlan(plan.id);
        plans.push({ ...plan, tasks });
      }
    }
    // Sort by createdAt
    plans.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return plans;
  }

  async updatePlan(id: string, updates: Partial<Plan>): Promise<Plan | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;
    
    const updated: Plan = {
      ...plan,
      ...updates,
      id: plan.id,
      objectiveId: plan.objectiveId,
      createdAt: plan.createdAt,
      updatedAt: timestamp(),
    };
    
    this.plans.set(id, updated);
    return { ...updated };
  }

  async deletePlan(id: string): Promise<boolean> {
    if (!this.plans.has(id)) return false;
    
    // Delete associated tasks
    const tasks = await this.getTasksForPlan(id);
    for (const task of tasks) {
      this.tasks.delete(task.id);
    }
    
    this.plans.delete(id);
    return true;
  }

  // =========================================================================
  // Tasks
  // =========================================================================

  async getTasksForPlan(planId: string): Promise<PlanTask[]> {
    const tasks: PlanTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.planId === planId) {
        tasks.push({ ...task });
      }
    }
    // Sort by taskIndex
    tasks.sort((a, b) => a.taskIndex - b.taskIndex);
    return tasks;
  }

  async updatePlanTask(id: string, updates: Partial<PlanTask>): Promise<PlanTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    
    const updated: PlanTask = {
      ...task,
      ...updates,
      id: task.id,
      planId: task.planId,
      objectiveId: task.objectiveId,
    };
    
    this.tasks.set(id, updated);
    return { ...updated };
  }

  async linkA2ATask(planTaskId: string, a2aTaskId: string): Promise<void> {
    const task = this.tasks.get(planTaskId);
    if (!task) {
      throw new Error(`PlanTask not found: ${planTaskId}`);
    }
    task.a2aTaskId = a2aTaskId;
    this.tasks.set(planTaskId, task);
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Clear all data. Useful for testing.
   */
  clear(): void {
    this.objectives.clear();
    this.plans.clear();
    this.tasks.clear();
  }

  /**
   * Get counts for debugging.
   */
  getCounts(): { objectives: number; plans: number; tasks: number } {
    return {
      objectives: this.objectives.size,
      plans: this.plans.size,
      tasks: this.tasks.size,
    };
  }
}
