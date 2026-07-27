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
      expect(learning.example.length, `${node.id} English example`).toBeGreaterThan(30);
      expect(learning.exampleZh.length, `${node.id} Chinese example`).toBeGreaterThan(15);
      expect(learning.resourceIds.length, `${node.id} resources`).toBeGreaterThanOrEqual(2);
      learning.resourceIds.forEach((resourceId) => {
        expect(knowledgeLearningResourceById.has(resourceId), `${node.id} -> ${resourceId}`).toBe(true);
      });
    }
  });
});
