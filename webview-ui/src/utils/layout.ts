import dagre from '@dagrejs/dagre';
import { MarkerType } from '@vue-flow/core';
import type { FlowchartNode, FlowchartEdge } from '../../src/shared/types';

export function getLayoutedElements(nodes: FlowchartNode[], edges: FlowchartEdge[], direction = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 240;
  const nodeHeight = 70;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 120,       // Espacio amplio entre columnas laterales
    ranksep: 100,       // Espacio amplio entre filas verticales
    acyclicer: 'greedy',
    ranker: 'network-simplex'
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    const isLoopback = edge.id.includes('loopback');
    const isBranch = edge.label === 'Sí' || edge.label === 'No';
    
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: isLoopback ? 1 : (isBranch ? 2 : 5),
      minlen: isLoopback ? 2 : 1,
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  const styledEdges = edges.map((edge) => {
    const isLoopback = edge.id.includes('loopback');
    const isNo = edge.label === 'No';
    const isSi = edge.label === 'Sí';

    // Asignar color rojo distintivo siempre a las líneas 'No'
    const strokeColor = isLoopback ? '#a855f7' : (isSi ? '#10b981' : (isNo ? '#ef4444' : '#64748b'));
    
    return {
      ...edge,
      type: isLoopback ? 'step' : 'smoothstep',
      animated: isLoopback,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 20,
        height: 20,
      },
      style: {
        strokeWidth: 2.5,
        stroke: strokeColor,
      },
    };
  });

  return { nodes: layoutedNodes, edges: styledEdges };
}
