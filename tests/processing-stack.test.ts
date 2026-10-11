import { expect, it } from 'vitest';
import {
  createGraph,
  createProgrammableNode,
} from '../src/core/compositing-registry';
import {
  insertGraphNode,
  deleteGraphNodes,
} from '../src/core/compositing-operations';
import {
  processingStack,
  reorderProcessingStack,
} from '../src/core/processing-stack';
import { organicTexturePackage } from '../src/core/effect-examples';
import { compileGraph } from '../src/core/compositing-compiler';
it('projects generator and filter chains without detaching generators during reorder', () => {
  let graph = insertGraphNode(
    createGraph(crypto.randomUUID()),
    'radialGradient',
  ).graph;
  graph = insertGraphNode(graph, 'gaussianBlur').graph;
  graph = insertGraphNode(graph, 'exposure').graph;
  const stack = processingStack(graph)!;
  expect(stack.map((n) => n.type)).toEqual([
    'radialGradient',
    'gaussianBlur',
    'exposure',
  ]);
  const reordered = reorderProcessingStack(graph, [
    stack[0]!.id,
    stack[2]!.id,
    stack[1]!.id,
  ]);
  expect(compileGraph(reordered).valid).toBe(true);
  expect(processingStack(reordered)!.map((n) => n.type)).toEqual([
    'radialGradient',
    'exposure',
    'gaussianBlur',
  ]);
  expect(() =>
    reorderProcessingStack(graph, [stack[1]!.id, stack[0]!.id, stack[2]!.id]),
  ).toThrow('起点');
});
it('removes custom generator and reconnects source to remaining filters', () => {
  let graph = insertGraphNode(
    createGraph(crypto.randomUUID()),
    createProgrammableNode(organicTexturePackage()),
  ).graph;
  const id = processingStack(graph)![0]!.id;
  graph = insertGraphNode(graph, 'gaussianBlur').graph;
  const next = deleteGraphNodes(graph, [id]);
  expect(compileGraph(next).valid).toBe(true);
  expect(processingStack(next)!.map((n) => n.type)).toEqual(['gaussianBlur']);
});
