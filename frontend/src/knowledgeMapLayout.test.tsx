import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { KnowledgeMap } from "./components/KnowledgeMap";
import {
  KNOWLEDGE_NODE_HEIGHT,
  knowledgeMapDomainById,
  knowledgeMapDomains,
  knowledgeMapEdges,
  knowledgeMapNodes,
} from "./knowledgeMapData";

describe("Knowledge Map visual structure", () => {
  it("never renders an edge whose endpoint is hidden at the current semantic level", () => {
    const { container } = render(
      <MemoryRouter>
        <KnowledgeMap />
      </MemoryRouter>,
    );

    fireEvent.click(container.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!);
    expect(container.querySelector(".knowledge-map-workspace")).toHaveAttribute("data-level", "2");

    const edges = Array.from(container.querySelectorAll<SVGPathElement>(".knowledge-map-edges > path"));
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      const from = container.querySelector(`[data-node-id="${edge.dataset.from}"]`);
      const to = container.querySelector(`[data-node-id="${edge.dataset.to}"]`);
      expect(from, `from ${edge.dataset.from}`).not.toHaveClass("semantic-hidden");
      expect(to, `to ${edge.dataset.to}`).not.toHaveClass("semantic-hidden");
    }
  });

  it("keeps domain frames separate and reserves a stable header above every node", () => {
    for (const [index, domain] of knowledgeMapDomains.entries()) {
      for (const other of knowledgeMapDomains.slice(index + 1)) {
        const overlaps = (
          domain.x < other.x + other.width
          && domain.x + domain.width > other.x
          && domain.y < other.y + other.height
          && domain.y + domain.height > other.y
        );
        expect(overlaps, `${domain.id} overlaps ${other.id}`).toBe(false);
      }
    }

    for (const node of knowledgeMapNodes) {
      const domain = knowledgeMapDomainById.get(node.mapDomain)!;
      expect(node.mapY, `${node.id} clears ${domain.id} header`).toBeGreaterThanOrEqual(domain.y + 132);
      expect(node.mapY + KNOWLEDGE_NODE_HEIGHT, `${node.id} stays inside ${domain.id}`).toBeLessThanOrEqual(domain.y + domain.height);
    }
  });

  it("uses a restrained overview skeleton instead of every possible dependency", () => {
    const overviewEdges = knowledgeMapEdges.filter((edge) => edge.overview);
    expect(overviewEdges.length).toBeLessThanOrEqual(28);
    expect(overviewEdges.map((edge) => `${edge.from}→${edge.to}`)).toEqual(expect.arrayContaining([
      "internet→http",
      "http→browser",
      "browser→components",
      "server-state→api-contract",
      "api-contract→service-layer",
      "service-layer→data-modeling",
    ]));
  });

  it("keeps every node as a visible spatial anchor during trackpad pinch zoom", () => {
    const { container } = render(
      <MemoryRouter>
        <KnowledgeMap />
      </MemoryRouter>,
    );
    const workspace = container.querySelector<HTMLElement>(".knowledge-map-workspace")!;

    fireEvent.wheel(workspace, {
      ctrlKey: true,
      deltaY: -120,
      clientX: 500,
      clientY: 300,
    });
    fireEvent.wheel(workspace, {
      ctrlKey: true,
      deltaY: 480,
      clientX: 500,
      clientY: 300,
    });

    expect(container.querySelectorAll(".knowledge-node")).toHaveLength(knowledgeMapNodes.length);
    expect(container.querySelectorAll(".knowledge-node.semantic-hidden")).toHaveLength(0);
  });

  it("uses English terms as the primary label and direct Chinese as support", () => {
    const { container } = render(
      <MemoryRouter>
        <KnowledgeMap />
      </MemoryRouter>,
    );
    const internetNode = container.querySelector<HTMLElement>('[data-node-id="internet"]')!;

    expect(within(internetNode).getByText("Internet & DNS").tagName).toBe("SPAN");
    expect(within(internetNode).getByText("互联网与 DNS").tagName).toBe("B");

    fireEvent.click(internetNode);
    const drawer = screen.getByRole("complementary", { name: "Internet & DNS details" });
    expect(within(drawer).getByRole("heading", { level: 2, name: "Internet & DNS" })).toBeInTheDocument();
    expect(within(drawer).getByText("互联网与 DNS")).toBeInTheDocument();
  });

  it("gives every node a short plain-language Chinese explanation", () => {
    for (const node of knowledgeMapNodes) {
      expect(node.plainZh.trim().length, node.id).toBeGreaterThan(8);
    }
  });
});
