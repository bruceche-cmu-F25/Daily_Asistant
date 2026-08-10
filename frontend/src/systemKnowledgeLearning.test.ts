import { describe, expect, it } from "vitest";

import { systemKnowledgeNodes } from "./systemKnowledgeGraph";
import {
  knowledgeLearningResourceById,
  knowledgeNodeLearning,
} from "./systemKnowledgeLearning";

describe("system knowledge learning metadata", () => {
  it("gives every graph node a bilingual example and valid learning resources", () => {
    expect(systemKnowledgeNodes).toHaveLength(55);

    for (const node of systemKnowledgeNodes) {
      const learning = knowledgeNodeLearning[node.id];
      expect(learning, node.id).toBeDefined();
      for (const field of ["what", "why", "how"] as const) {
        expect(learning[field].length, `${node.id} English ${field}`).toBeGreaterThan(30);
        expect(learning[`${field}Zh`].length, `${node.id} Chinese ${field}`).toBeGreaterThan(15);
      }
      expect(learning.resourceIds.length, `${node.id} resources`).toBeGreaterThanOrEqual(2);
      learning.resourceIds.forEach((resourceId) => {
        expect(knowledgeLearningResourceById.has(resourceId), `${node.id} -> ${resourceId}`).toBe(true);
      });
    }
  });
});
