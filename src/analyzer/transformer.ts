import { FlowchartData } from '../shared/types';
import { FlowchartBuilder, ProcessingContext } from './FlowchartBuilder';
import { scanForPromptVars } from './promptDetector';

/**
 * Función central del Transformador. Recibe un AST (Árbol de Sintaxis Abstracta)
 * y lo convierte en un formato compatible con Vue Flow (Nodos y Aristas/Conexiones).
 * 
 * Orquesta la detección de variables de entrada, la inicialización del constructor
 * del diagrama (FlowchartBuilder) y la generación del flujo principal.
 * 
 * @param ast El árbol generado por el Parser (acorn).
 * @returns FlowchartData Objeto que contiene las listas de `nodes` y `edges`.
 */
export function transformAstToFlowchart(ast: any): FlowchartData {
  const promptVars = scanForPromptVars(ast);
  const builder = new FlowchartBuilder(promptVars);

  // Nodo Inicio del diagrama principal
  builder.addNode('start', 'startEnd', 'Inicio', 1);

  let ctx: ProcessingContext = { lastNodeId: 'start' };

  if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
    ctx = builder.processStatements(ast.body, ctx);
  }

  // Nodo Fin del diagrama principal
  const endId = 'end';
  builder.addNode(endId, 'startEnd', 'Fin', ast?.loc?.end?.line || 1);
  builder.addEdge(ctx.lastNodeId, endId);

  return builder.build();
}
