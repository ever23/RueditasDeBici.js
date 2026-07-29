import dagre from '@dagrejs/dagre';
import { MarkerType } from '@vue-flow/core';
import type { FlowchartNode, FlowchartEdge } from '../../src/shared/types';

export function getLayoutedElements(nodes: FlowchartNode[], edges: FlowchartEdge[], direction = 'TB') {
  const nodeWidth = 240;
  const nodeHeight = 70;

  // Separar nodos principales (sin parentNode) de los nodos pertenecientes a grupos de funciones
  const mainNodes = nodes.filter(n => !n.parentNode && n.type !== 'functionGroup');
  const groupNodes = nodes.filter(n => n.type === 'functionGroup');
  const childNodesByGroup = new Map<string, FlowchartNode[]>();

  nodes.forEach(n => {
    if (n.parentNode) {
      const list = childNodesByGroup.get(n.parentNode) || [];
      list.push(n);
      childNodesByGroup.set(n.parentNode, list);
    }
  });

  // 1. Layout del Grafo Principal
  const mainGraph = new dagre.graphlib.Graph();
  mainGraph.setDefaultEdgeLabel(() => ({}));
  mainGraph.setGraph({
    rankdir: direction,
    nodesep: 120,
    ranksep: 100,
    acyclicer: 'greedy',
    ranker: 'network-simplex'
  });

  const mainNodeIds = new Set(mainNodes.map(n => n.id));
  mainNodes.forEach(node => mainGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));

  const mainEdges = edges.filter(e => mainNodeIds.has(e.source) && mainNodeIds.has(e.target));
  mainEdges.forEach(edge => {
    const isLoopback = edge.id.includes('loopback');
    const isBranch = edge.label === 'Sí' || edge.label === 'No';
    mainGraph.setEdge(edge.source, edge.target, {
      weight: isLoopback ? 1 : (isBranch ? 2 : 5),
      minlen: isLoopback ? 2 : 1,
    });
  });

  dagre.layout(mainGraph);

  let maxMainX = 0;
  const layoutedMainNodes = mainNodes.map(node => {
    const pos = mainGraph.node(node.id);
    const x = pos.x - nodeWidth / 2;
    const y = pos.y - nodeHeight / 2;
    if (x + nodeWidth > maxMainX) maxMainX = x + nodeWidth;
    return { ...node, position: { x, y } };
  });

  // 2. Layout para cada Grupo de Función (posicionados a la derecha del diagrama principal)
  let currentGroupOffsetX = Math.max(maxMainX + 250, 450);
  const layoutedGroupNodes: FlowchartNode[] = [];
  const layoutedChildNodes: FlowchartNode[] = [];

  groupNodes.forEach((groupNode) => {
    const children = childNodesByGroup.get(groupNode.id) || [];
    if (children.length === 0) return;

    const childIds = new Set(children.map(c => c.id));
    const groupGraph = new dagre.graphlib.Graph();
    groupGraph.setDefaultEdgeLabel(() => ({}));
    groupGraph.setGraph({
      rankdir: 'TB',
      nodesep: 60,
      ranksep: 70,
      acyclicer: 'greedy',
      ranker: 'network-simplex'
    });

    children.forEach(c => groupGraph.setNode(c.id, { width: nodeWidth, height: nodeHeight }));
    const groupEdges = edges.filter(e => childIds.has(e.source) && childIds.has(e.target));
    groupEdges.forEach(e => {
      const isBranch = e.label === 'Sí' || e.label === 'No';
      groupGraph.setEdge(e.source, e.target, { weight: isBranch ? 2 : 5 });
    });

    dagre.layout(groupGraph);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    children.forEach(c => {
      const pos = groupGraph.node(c.id);
      const cx = pos.x - nodeWidth / 2;
      const cy = pos.y - nodeHeight / 2;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx + nodeWidth > maxX) maxX = cx + nodeWidth;
      if (cy + nodeHeight > maxY) maxY = cy + nodeHeight;
    });

    const padding = 50;
    const headerHeight = 50;
    const gWidth = (maxX - minX) + padding * 2;
    const gHeight = (maxY - minY) + padding * 2 + headerHeight;

    const groupPosition = { x: currentGroupOffsetX, y: 0 };
    currentGroupOffsetX += gWidth + 150;

    // Nodo contenedor (Caja del grupo)
    layoutedGroupNodes.push({
      ...groupNode,
      position: groupPosition,
      style: {
        ...groupNode.style,
        width: `${gWidth}px`,
        height: `${gHeight}px`,
      },
    });

    // Nodos hijos posicionados de manera relativa DENTRO de las coordenadas de la caja
    children.forEach(c => {
      const pos = groupGraph.node(c.id);
      const relX = ((pos.x - nodeWidth / 2) - minX) + padding;
      const relY = ((pos.y - nodeHeight / 2) - minY) + padding + headerHeight;
      layoutedChildNodes.push({
        ...c,
        position: { x: relX, y: relY },
        parentNode: groupNode.id, // Mantener parentNode para que se arrastren con la caja
      });
    });
  });

  const allLayoutedNodes = [...layoutedMainNodes, ...layoutedGroupNodes, ...layoutedChildNodes];

  const styledEdges = edges.map((edge) => {
    const isLoopback = edge.id.includes('loopback');
    const isNo = edge.label === 'No';
    const isSi = edge.label === 'Sí';

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

  return { nodes: allLayoutedNodes, edges: styledEdges };
}
