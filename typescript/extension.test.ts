/**
 * Tests for extension activation and metadata helpers.
 */

import { describe, it, expect } from 'vitest';
import {
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
import { OPT_EXTENSION_URI, OPT_METADATA, PlanTask, Objective, Plan } from './types.js';

// =============================================================================
// Extension Header Tests
// =============================================================================

describe('Extension Header', () => {
  describe('A2A_EXTENSIONS_HEADER', () => {
    it('has correct value', () => {
      expect(A2A_EXTENSIONS_HEADER).toBe('X-A2A-Extensions');
    });
  });

  describe('isOPTActivated', () => {
    it('returns true when OPT extension is in headers', () => {
      const headers = { 'X-A2A-Extensions': OPT_EXTENSION_URI };
      expect(isOPTActivated(headers)).toBe(true);
    });

    it('returns true with multiple extensions', () => {
      const headers = {
        'X-A2A-Extensions': `https://example.com/ext1, ${OPT_EXTENSION_URI}, https://example.com/ext2`,
      };
      expect(isOPTActivated(headers)).toBe(true);
    });

    it('returns false when OPT extension not present', () => {
      const headers = { 'X-A2A-Extensions': 'https://example.com/other' };
      expect(isOPTActivated(headers)).toBe(false);
    });

    it('returns false when header missing', () => {
      const headers = {};
      expect(isOPTActivated(headers)).toBe(false);
    });

    it('works with Headers object', () => {
      const headers = new Headers({
        'X-A2A-Extensions': OPT_EXTENSION_URI,
      });
      expect(isOPTActivated(headers)).toBe(true);
    });

    it('works with Map', () => {
      const headers = new Map([['X-A2A-Extensions', OPT_EXTENSION_URI]]);
      expect(isOPTActivated(headers)).toBe(true);
    });

    it('handles lowercase header name in Map', () => {
      const headers = new Map([['x-a2a-extensions', OPT_EXTENSION_URI]]);
      expect(isOPTActivated(headers)).toBe(true);
    });

    it('handles lowercase header name in object', () => {
      const headers = { 'x-a2a-extensions': OPT_EXTENSION_URI };
      expect(isOPTActivated(headers)).toBe(true);
    });
  });

  describe('parseExtensionsHeader', () => {
    it('parses single extension', () => {
      const uris = parseExtensionsHeader(OPT_EXTENSION_URI);
      expect(uris).toEqual([OPT_EXTENSION_URI]);
    });

    it('parses multiple extensions', () => {
      const value = 'https://ext1.com, https://ext2.com, https://ext3.com';
      const uris = parseExtensionsHeader(value);
      expect(uris).toEqual([
        'https://ext1.com',
        'https://ext2.com',
        'https://ext3.com',
      ]);
    });

    it('handles extra whitespace', () => {
      const value = '  https://ext1.com  ,  https://ext2.com  ';
      const uris = parseExtensionsHeader(value);
      expect(uris).toEqual(['https://ext1.com', 'https://ext2.com']);
    });

    it('filters empty strings', () => {
      const value = 'https://ext1.com,,,https://ext2.com';
      const uris = parseExtensionsHeader(value);
      expect(uris).toEqual(['https://ext1.com', 'https://ext2.com']);
    });
  });

  describe('buildExtensionsHeader', () => {
    it('builds header from URIs', () => {
      const uris = ['https://ext1.com', 'https://ext2.com'];
      const header = buildExtensionsHeader(uris);
      expect(header).toBe('https://ext1.com, https://ext2.com');
    });

    it('handles single URI', () => {
      const header = buildExtensionsHeader([OPT_EXTENSION_URI]);
      expect(header).toBe(OPT_EXTENSION_URI);
    });
  });
});

// =============================================================================
// Metadata Helper Tests
// =============================================================================

describe('Metadata Helpers', () => {
  const samplePlanTask: PlanTask = {
    id: 'task-123',
    planId: 'plan-456',
    objectiveId: 'obj-789',
    name: 'Test Task',
    taskIndex: 2,
    dependencies: ['task-100', 'task-101'],
  };

  describe('setOPTMetadata', () => {
    it('sets all OPT metadata fields', () => {
      const metadata = {};
      setOPTMetadata(metadata, samplePlanTask);

      expect(metadata[OPT_METADATA.OBJECTIVE_ID]).toBe('obj-789');
      expect(metadata[OPT_METADATA.PLAN_ID]).toBe('plan-456');
      expect(metadata[OPT_METADATA.TASK_INDEX]).toBe(2);
      expect(metadata[OPT_METADATA.DEPENDENCIES]).toEqual(['task-100', 'task-101']);
    });

    it('does not set dependencies if empty', () => {
      const metadata = {};
      setOPTMetadata(metadata, { ...samplePlanTask, dependencies: [] });

      expect(metadata[OPT_METADATA.DEPENDENCIES]).toBeUndefined();
    });

    it('does not set dependencies if undefined', () => {
      const metadata = {};
      setOPTMetadata(metadata, { ...samplePlanTask, dependencies: undefined });

      expect(metadata[OPT_METADATA.DEPENDENCIES]).toBeUndefined();
    });

    it('returns the mutated metadata object', () => {
      const metadata = { existing: 'value' };
      const result = setOPTMetadata(metadata, samplePlanTask);

      expect(result).toBe(metadata);
      expect(result['existing']).toBe('value');
    });
  });

  describe('getOPTMetadata', () => {
    it('extracts OPT metadata', () => {
      const metadata = {
        [OPT_METADATA.OBJECTIVE_ID]: 'obj-123',
        [OPT_METADATA.PLAN_ID]: 'plan-456',
        [OPT_METADATA.TASK_INDEX]: 3,
        [OPT_METADATA.DEPENDENCIES]: ['dep-1'],
      };

      const result = getOPTMetadata(metadata);
      expect(result).toEqual({
        objectiveId: 'obj-123',
        planId: 'plan-456',
        taskIndex: 3,
        dependencies: ['dep-1'],
      });
    });

    it('returns null for undefined metadata', () => {
      expect(getOPTMetadata(undefined)).toBeNull();
    });

    it('returns null if objectiveId missing', () => {
      const metadata = {
        [OPT_METADATA.PLAN_ID]: 'plan-456',
      };
      expect(getOPTMetadata(metadata)).toBeNull();
    });

    it('returns null if planId missing', () => {
      const metadata = {
        [OPT_METADATA.OBJECTIVE_ID]: 'obj-123',
      };
      expect(getOPTMetadata(metadata)).toBeNull();
    });

    it('defaults taskIndex to 0', () => {
      const metadata = {
        [OPT_METADATA.OBJECTIVE_ID]: 'obj-123',
        [OPT_METADATA.PLAN_ID]: 'plan-456',
      };
      const result = getOPTMetadata(metadata);
      expect(result?.taskIndex).toBe(0);
    });

    it('omits dependencies if not present', () => {
      const metadata = {
        [OPT_METADATA.OBJECTIVE_ID]: 'obj-123',
        [OPT_METADATA.PLAN_ID]: 'plan-456',
      };
      const result = getOPTMetadata(metadata);
      expect(result?.dependencies).toBeUndefined();
    });
  });

  describe('isOPTTask', () => {
    it('returns true for OPT task', () => {
      const metadata = {
        [OPT_METADATA.OBJECTIVE_ID]: 'obj-123',
        [OPT_METADATA.PLAN_ID]: 'plan-456',
      };
      expect(isOPTTask(metadata)).toBe(true);
    });

    it('returns false for non-OPT task', () => {
      expect(isOPTTask({})).toBe(false);
      expect(isOPTTask(undefined)).toBe(false);
    });
  });

  describe('setObjectiveInMetadata / getObjectiveFromMetadata', () => {
    const objective: Objective = {
      id: 'obj-123',
      name: 'Test Objective',
      status: 'working',
      createdAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-02-15T00:00:00Z',
    };

    it('sets objective in metadata', () => {
      const metadata = {};
      setObjectiveInMetadata(metadata, objective);
      expect(metadata[OPT_METADATA.OBJECTIVE]).toEqual(objective);
    });

    it('gets objective from metadata', () => {
      const metadata = { [OPT_METADATA.OBJECTIVE]: objective };
      const result = getObjectiveFromMetadata(metadata);
      expect(result).toEqual(objective);
    });

    it('returns null if not present', () => {
      expect(getObjectiveFromMetadata({})).toBeNull();
      expect(getObjectiveFromMetadata(undefined)).toBeNull();
    });

    it('returns null if not an object', () => {
      expect(getObjectiveFromMetadata({ [OPT_METADATA.OBJECTIVE]: 'string' })).toBeNull();
    });
  });

  describe('setPlanInMetadata / getPlanFromMetadata', () => {
    const plan: Plan = {
      id: 'plan-123',
      objectiveId: 'obj-456',
      name: 'Test Plan',
      status: 'pending',
      createdAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-02-15T00:00:00Z',
    };

    it('sets plan in metadata', () => {
      const metadata = {};
      setPlanInMetadata(metadata, plan);
      expect(metadata[OPT_METADATA.PLAN]).toEqual(plan);
    });

    it('gets plan from metadata', () => {
      const metadata = { [OPT_METADATA.PLAN]: plan };
      const result = getPlanFromMetadata(metadata);
      expect(result).toEqual(plan);
    });

    it('returns null if not present', () => {
      expect(getPlanFromMetadata({})).toBeNull();
      expect(getPlanFromMetadata(undefined)).toBeNull();
    });
  });
});

// =============================================================================
// AgentCard Helper Tests
// =============================================================================

describe('AgentCard Helpers', () => {
  describe('createOPTExtensionDeclaration', () => {
    it('creates declaration with defaults', () => {
      const decl = createOPTExtensionDeclaration();
      expect(decl.uri).toBe(OPT_EXTENSION_URI);
      expect(decl.required).toBe(false);
      expect(decl.params).toBeUndefined();
    });

    it('creates declaration with params', () => {
      const decl = createOPTExtensionDeclaration({
        maxPlansPerObjective: 20,
        persistenceEnabled: true,
      });
      expect(decl.params?.maxPlansPerObjective).toBe(20);
      expect(decl.params?.persistenceEnabled).toBe(true);
    });

    it('creates required declaration', () => {
      const decl = createOPTExtensionDeclaration(undefined, true);
      expect(decl.required).toBe(true);
    });
  });

  describe('DEFAULT_OPT_PARAMS', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_OPT_PARAMS.maxPlansPerObjective).toBe(10);
      expect(DEFAULT_OPT_PARAMS.maxTasksPerPlan).toBe(50);
      expect(DEFAULT_OPT_PARAMS.persistenceEnabled).toBe(false);
    });
  });

  describe('agentSupportsOPT', () => {
    it('returns true if OPT in extensions', () => {
      const agentCard = {
        name: 'Test Agent',
        capabilities: {
          extensions: [{ uri: OPT_EXTENSION_URI }],
        },
      };
      expect(agentSupportsOPT(agentCard)).toBe(true);
    });

    it('returns true with other extensions', () => {
      const agentCard = {
        capabilities: {
          extensions: [
            { uri: 'https://example.com/ext1' },
            { uri: OPT_EXTENSION_URI },
            { uri: 'https://example.com/ext2' },
          ],
        },
      };
      expect(agentSupportsOPT(agentCard)).toBe(true);
    });

    it('returns false if OPT not in extensions', () => {
      const agentCard = {
        capabilities: {
          extensions: [{ uri: 'https://example.com/other' }],
        },
      };
      expect(agentSupportsOPT(agentCard)).toBe(false);
    });

    it('returns false if no extensions', () => {
      expect(agentSupportsOPT({})).toBe(false);
      expect(agentSupportsOPT({ capabilities: {} })).toBe(false);
      expect(agentSupportsOPT({ capabilities: { extensions: [] } })).toBe(false);
    });
  });

  describe('getOPTParams', () => {
    it('returns params from agent card', () => {
      const agentCard = {
        capabilities: {
          extensions: [
            {
              uri: OPT_EXTENSION_URI,
              params: {
                maxPlansPerObjective: 20,
                maxTasksPerPlan: 100,
              },
            },
          ],
        },
      };
      const params = getOPTParams(agentCard);
      expect(params?.maxPlansPerObjective).toBe(20);
      expect(params?.maxTasksPerPlan).toBe(100);
    });

    it('returns null if no params', () => {
      const agentCard = {
        capabilities: {
          extensions: [{ uri: OPT_EXTENSION_URI }],
        },
      };
      expect(getOPTParams(agentCard)).toBeNull();
    });

    it('returns null if extension not found', () => {
      const agentCard = {
        capabilities: {
          extensions: [{ uri: 'https://other.com/ext' }],
        },
      };
      expect(getOPTParams(agentCard)).toBeNull();
    });

    it('returns null if no extensions', () => {
      expect(getOPTParams({})).toBeNull();
    });
  });
});
