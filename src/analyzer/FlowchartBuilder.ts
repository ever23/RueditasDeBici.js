import { FlowchartData, FlowchartNode, FlowchartEdge, FlowchartNodeType } from '../shared/types';
import { formatExpr, inspectExpression } from './formatUtils';
import { isPromptCall } from './promptDetector';

const FUNCTION_COLORS = [
  'rgba(168, 85, 247, 0.15)',   // Púrpura
  'rgba(59, 130, 246, 0.15)',   // Azul
  'rgba(16, 185, 129, 0.15)',   // Verde
  'rgba(245, 158, 11, 0.15)',   // Ámbar
  'rgba(239, 68, 68, 0.15)',    // Rojo
  'rgba(236, 72, 153, 0.15)',   // Rosa
  'rgba(6, 182, 212, 0.15)',    // Cian
  'rgba(132, 204, 22, 0.15)',   // Lima
];

const FUNCTION_BORDER_COLORS = [
  '#a855f7',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

/**
 * Contexto de procesamiento para mantener el seguimiento del flujo.
 * Diferencia entre el flujo principal y los bloques anidados dentro de funciones.
 */
export interface ProcessingContext {
  /** ID del grupo contenedor (definido si estamos dentro de una función) */
  parentGroup?: string;
  /** ID del último nodo conectado en la secuencia actual */
  lastNodeId: string;
}

/**
 * Clase constructora de diagramas de flujo.
 * Encapsula la generación de nodos y aristas (edges), contadores de IDs,
 * colores de funciones y la lógica de recorrido y transformación del AST.
 */
export class FlowchartBuilder {
  private nodes: FlowchartNode[] = [];
  private edges: FlowchartEdge[] = [];
  private nodeCounter = 0;
  private colorIndex = 0;
  private promptVars: Set<string>;

  constructor(promptVars: Set<string>) {
    this.promptVars = promptVars;
  }

  /**
   * Genera un identificador único correlativo.
   */
  nextId(prefix = 'node'): string {
    return `${prefix}_${++this.nodeCounter}`;
  }

  /**
   * Agrega un nodo al grafo y retorna el nodo creado.
   */
  addNode(
    id: string,
    type: FlowchartNodeType,
    label: string,
    codeLine: number,
    ctx?: ProcessingContext,
    extra?: {
      lines?: number[];
      codeSnippet?: string;
      style?: Record<string, any>;
    }
  ): FlowchartNode {
    const node: FlowchartNode = {
      id,
      type,
      data: {
        label,
        codeLine,
        ...(extra?.lines ? { lines: extra.lines } : {}),
        ...(extra?.codeSnippet ? { codeSnippet: extra.codeSnippet } : {}),
      },
      position: { x: 0, y: 0 },
      ...(ctx?.parentGroup ? { parentNode: ctx.parentGroup, extent: 'parent' as const } : {}),
      ...(extra?.style ? { style: extra.style } : {}),
    };
    this.nodes.push(node);
    return node;
  }

  /**
   * Agrega una conexión (arista) entre dos nodos existentes.
   */
  addEdge(
    source: string,
    target: string,
    options?: {
      id?: string;
      label?: string;
      sourceHandle?: string;
      targetHandle?: string;
      type?: 'default' | 'smoothstep' | 'step';
    }
  ): FlowchartEdge {
    const edge: FlowchartEdge = {
      id: options?.id || `e_${source}_${target}`,
      source,
      target,
      ...(options?.label !== undefined ? { label: options?.label } : {}),
      ...(options?.sourceHandle ? { sourceHandle: options.sourceHandle } : {}),
      ...(options?.targetHandle ? { targetHandle: options.targetHandle } : {}),
      ...(options?.type ? { type: options.type } : {}),
    };
    this.edges.push(edge);
    return edge;
  }

  /**
   * Procesa la declaración de una función creando un sub-diagrama encapsulado
   * en un grupo (`functionGroup`) con sus propios nodos de inicio, parámetros y fin.
   */
  processFunctionDeclaration(funcStmt: any): void {
    const funcName = funcStmt.id?.name || 'función';
    const params = funcStmt.params ? funcStmt.params.map((p: any) => formatExpr(p)).join(', ') : '';
    const line = funcStmt.loc?.start?.line || 1;

    const bgColor = FUNCTION_COLORS[this.colorIndex % FUNCTION_COLORS.length];
    const borderColor = FUNCTION_BORDER_COLORS[this.colorIndex % FUNCTION_BORDER_COLORS.length];
    this.colorIndex++;

    const groupId = `func_group_${funcName}_${++this.nodeCounter}`;

    // Nodo contenedor (Caja del mini-diagrama de la función)
    this.nodes.push({
      id: groupId,
      type: 'functionGroup',
      data: { label: `Función: ${funcName}(${params})`, codeLine: line },
      position: { x: 0, y: 0 },
      style: {
        backgroundColor: bgColor,
        borderColor: borderColor,
      },
    });

    const funcStartId = `func_start_${++this.nodeCounter}`;
    this.nodes.push({
      id: funcStartId,
      type: 'startEnd',
      data: { label: `Inicio ${funcName}`, codeLine: line },
      position: { x: 0, y: 0 },
      parentNode: groupId,
      extent: 'parent',
    });

    let currentLast = funcStartId;

    if (params) {
      const paramNodeId = `func_params_${++this.nodeCounter}`;
      this.nodes.push({
        id: paramNodeId,
        type: 'functionData',
        data: { label: `Recibe: ${params}`, codeLine: line },
        position: { x: 0, y: 0 },
        parentNode: groupId,
        extent: 'parent',
      });
      this.edges.push({ id: `e_${currentLast}_${paramNodeId}`, source: currentLast, target: paramNodeId });
      currentLast = paramNodeId;
    }

    if (funcStmt.body && Array.isArray(funcStmt.body.body)) {
      const funcCtx = this.processStatements(funcStmt.body.body, {
        parentGroup: groupId,
        lastNodeId: currentLast,
      });
      currentLast = funcCtx.lastNodeId;
    }

    const funcEndId = `func_end_${++this.nodeCounter}`;
    this.nodes.push({
      id: funcEndId,
      type: 'startEnd',
      data: { label: `Fin ${funcName}`, codeLine: funcStmt.loc?.end?.line || line },
      position: { x: 0, y: 0 },
      parentNode: groupId,
      extent: 'parent',
    });

    this.edges.push({ id: `e_${currentLast}_${funcEndId}`, source: currentLast, target: funcEndId });
  }

  /**
   * Procesa una lista secuencial de sentencias (statements), aplicando agrupación
   * inteligente de declaraciones de variables consecutivas en el flujo principal.
   */
  processStatements(statements: any[], ctx: ProcessingContext): ProcessingContext {
    let i = 0;
    while (i < statements.length) {
      const stmt = statements[i];

      if (!stmt || stmt.type === 'ImportDeclaration') {
        i++;
        continue;
      }

      if (stmt.type === 'FunctionDeclaration') {
        this.processFunctionDeclaration(stmt);
        i++;
        continue;
      }

      // Si está en el nivel superior, ignorar inicializaciones de prompt-sync o require
      if (
        !ctx.parentGroup &&
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.some(
          (d: any) => d.id?.name && this.promptVars.has(d.id.name) && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
        )
      ) {
        i++;
        continue;
      }

      if (stmt.type === 'VariableDeclaration') {
        // Generar sub-diagramas para funciones anónimas o flecha asignadas a variables
        stmt.declarations.forEach((d: any) => {
          if (d.id?.name && d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression')) {
            const fakeFunc = {
              ...d.init,
              id: { name: d.id.name },
              loc: stmt.loc,
            };
            this.processFunctionDeclaration(fakeFunc);
          }
        });

        const groupedDecls: string[] = [];
        const groupedLines: number[] = [];
        const firstLine = stmt.loc?.start?.line || 1;

        while (i < statements.length && statements[i]?.type === 'VariableDeclaration') {
          const currentStmt = statements[i];
          const isPromptInit = currentStmt.declarations.some(
            (d: any) => d.id?.name && this.promptVars.has(d.id.name) && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
          );
          if (isPromptInit) {
            i++;
            continue;
          }

          let hasPrompt = false;
          currentStmt.declarations.forEach((d: any) => {
            if (d.init && isPromptCall(d.init, this.promptVars)) {
              hasPrompt = true;
            }
          });

          if (hasPrompt) {
            break;
          }

          currentStmt.declarations.forEach((d: any) => {
            const varName = formatExpr(d.id) || 'var';
            if (d.init) {
              groupedDecls.push(`${varName} = ${formatExpr(d.init)}`);
            } else {
              groupedDecls.push(`${varName}`);
            }
          });

          groupedLines.push(currentStmt.loc?.start?.line || 1);
          i++;
        }

        if (groupedDecls.length > 0) {
          const declPrefix = stmt.kind === 'const' ? 'Constante' : 'Variable';
          const id = `node_${++this.nodeCounter}`;
          this.addNode(id, 'process', `${declPrefix}:\n${groupedDecls.join('\n')}`, firstLine, ctx, {
            lines: groupedLines,
          });
          this.addEdge(ctx.lastNodeId, id);
          ctx = { ...ctx, lastNodeId: id };
        }

        if (i < statements.length && statements[i]?.type === 'VariableDeclaration') {
          ctx = this.processSingleStatement(statements[i], ctx);
          i++;
        }
      } else {
        ctx = this.processSingleStatement(stmt, ctx);
        i++;
      }
    }

    return ctx;
  }

  /**
   * Procesa un único statement individual despachando al handler correspondiente.
   */
  processSingleStatement(stmt: any, ctx: ProcessingContext): ProcessingContext {
    if (!stmt) return ctx;
    const line = stmt.loc?.start?.line || 1;
    const id = `node_${++this.nodeCounter}`;

    if (stmt.type === 'ReturnStatement') {
      const retVal = stmt.argument ? formatExpr(stmt.argument) : '';
      this.addNode(id, 'functionData', `Retornar: ${retVal}`, line, ctx);
      this.addEdge(ctx.lastNodeId, id);
      return { ...ctx, lastNodeId: id };
    }

    if (stmt.type === 'VariableDeclaration') {
      let hasPrompt = false;
      let readVar = '';
      const groupedDecls: string[] = [];

      stmt.declarations.forEach((d: any) => {
        if (d.init && isPromptCall(d.init, this.promptVars)) {
          hasPrompt = true;
          readVar = formatExpr(d.id) || 'datos';
        }

        const varName = formatExpr(d.id) || 'var';
        if (d.init) {
          groupedDecls.push(`${varName} = ${formatExpr(d.init)}`);
        } else {
          groupedDecls.push(`${varName}`);
        }
      });

      if (hasPrompt) {
        this.addNode(id, 'input', `Leer: ${readVar}`, line, ctx);
      } else {
        const declPrefix = stmt.kind === 'const' ? 'Constante' : 'Variable';
        this.addNode(id, 'process', `${declPrefix}:\n${groupedDecls.join('\n')}`, line, ctx);
      }
      this.addEdge(ctx.lastNodeId, id);
      return { ...ctx, lastNodeId: id };
    }

    if (stmt.type === 'SwitchStatement') {
      const discriminant = formatExpr(stmt.discriminant);
      const switchId = `switch_${++this.nodeCounter}`;

      this.addNode(switchId, 'decision', `¿Según (${discriminant})?`, line, ctx);
      this.addEdge(ctx.lastNodeId, switchId);

      const endSwitchId = `endswitch_${++this.nodeCounter}`;
      const caseLastNodeIds: string[] = [];

      if (Array.isArray(stmt.cases)) {
        stmt.cases.forEach((caseClause: any) => {
          const caseTest = caseClause.test ? formatExpr(caseClause.test) : 'Por Defecto';
          const caseStartCtx: ProcessingContext = { ...ctx, lastNodeId: switchId };

          const firstCaseNodeIndex = this.nodeCounter + 1;
          const caseResultCtx = this.processStatements(caseClause.consequent || [], caseStartCtx);
          const firstCaseNodeId = `node_${firstCaseNodeIndex}`;

          const edgeToCase = this.edges.find((e) => e.source === switchId && e.target === firstCaseNodeId);
          if (edgeToCase) {
            edgeToCase.label = `Opción: ${caseTest}`;
            edgeToCase.sourceHandle = 'source-right';
          } else {
            this.edges.push({
              id: `e_${switchId}_${firstCaseNodeId}`,
              source: switchId,
              target: firstCaseNodeId,
              label: `Opción: ${caseTest}`,
              sourceHandle: 'source-right',
            });
          }

          caseLastNodeIds.push(caseResultCtx.lastNodeId);
        });
      }

      this.addNode(endSwitchId, 'process', 'Fin Según (Switch)', line, ctx);

      caseLastNodeIds.forEach((caseLastId) => {
        this.addEdge(caseLastId, endSwitchId);
      });

      return { ...ctx, lastNodeId: endSwitchId };
    }

    if (stmt.type === 'DoWhileStatement') {
      const loopId = `loop_${++this.nodeCounter}`;
      const loopCond = formatExpr(stmt.test);

      this.addNode(loopId, 'loop', `Hacer...Mientras (${loopCond})`, line, ctx);
      this.addEdge(ctx.lastNodeId, loopId);

      let loopCtx: ProcessingContext = { ...ctx, lastNodeId: loopId };

      if (stmt.body) {
        const statementsToProcess = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        loopCtx = this.processStatements(statementsToProcess, loopCtx);
      }

      this.addEdge(loopCtx.lastNodeId, loopId, {
        id: `e_loopback_${loopCtx.lastNodeId}_${loopId}`,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        label: 'Repetir',
        type: 'step',
      });

      const exitLoopId = `exitloop_${++this.nodeCounter}`;
      this.addNode(exitLoopId, 'process', 'Fin Bucle Do...While', line, ctx);
      this.addEdge(loopId, exitLoopId, { label: 'Fin Ciclo' });

      return { ...ctx, lastNodeId: exitLoopId };
    }

    if (stmt.type === 'BreakStatement') {
      this.addNode(id, 'process', 'Salir del Bucle (break)', line, ctx);
      this.addEdge(ctx.lastNodeId, id);
      return { ...ctx, lastNodeId: id };
    }

    if (stmt.type === 'ContinueStatement') {
      this.addNode(id, 'process', 'Siguiente Iteración (continue)', line, ctx);
      this.addEdge(ctx.lastNodeId, id);
      return { ...ctx, lastNodeId: id };
    }

    if (stmt.type === 'ExpressionStatement') {
      const inspected = inspectExpression(stmt.expression, this.promptVars);
      let nodeType: FlowchartNodeType = 'process';
      let labelText = `Expresión (L. ${line})`;

      if (inspected) {
        nodeType = inspected.type;
        labelText = inspected.label;
      }

      this.addNode(id, nodeType, labelText, line, ctx);
      this.addEdge(ctx.lastNodeId, id);
      return { ...ctx, lastNodeId: id };
    }

    if (stmt.type === 'IfStatement') {
      const branches: any[] = [];
      let curr = stmt;
      while (curr && curr.type === 'IfStatement') {
        branches.push({ test: curr.test, consequent: curr.consequent, line: curr.loc?.start?.line || line });
        curr = curr.alternate;
      }
      const finalElse = curr;

      const endIfId = `endif_${++this.nodeCounter}`;
      let previousDecisionId: string | null = null;
      let inputToNext = ctx.lastNodeId;
      const lastNodesOfBranches: string[] = [];

      for (let branchIdx = 0; branchIdx < branches.length; branchIdx++) {
        const branch = branches[branchIdx];
        const condText = formatExpr(branch.test);
        const decisionId = `dec_${++this.nodeCounter}`;

        this.addNode(decisionId, 'decision', `¿${condText}?`, branch.line, ctx);

        this.addEdge(inputToNext, decisionId, {
          label: previousDecisionId ? 'No' : undefined,
          sourceHandle: previousDecisionId ? 'source-right' : undefined,
        });

        let branchCtx: ProcessingContext = { ...ctx, lastNodeId: decisionId };
        const body = branch.consequent.type === 'BlockStatement' ? branch.consequent.body : [branch.consequent];
        branchCtx = this.processStatements(body, branchCtx);

        const edgeIdx = this.edges.findIndex((e) => e.source === decisionId && !e.label);
        if (edgeIdx !== -1) {
          this.edges[edgeIdx].label = 'Sí';
          this.edges[edgeIdx].sourceHandle = 'source-bottom';
        }

        lastNodesOfBranches.push(branchCtx.lastNodeId);

        previousDecisionId = decisionId;
        inputToNext = decisionId;
      }

      if (finalElse) {
        let elseCtx: ProcessingContext = { ...ctx, lastNodeId: previousDecisionId! };
        const body = finalElse.type === 'BlockStatement' ? finalElse.body : [finalElse];
        elseCtx = this.processStatements(body, elseCtx);

        const edgeIdx = this.edges.findIndex((e) => e.source === previousDecisionId && !e.label);
        if (edgeIdx !== -1) {
          this.edges[edgeIdx].label = 'No';
          this.edges[edgeIdx].sourceHandle = 'source-right';
        }

        lastNodesOfBranches.push(elseCtx.lastNodeId);
      } else {
        this.addEdge(previousDecisionId!, endIfId, {
          label: 'No',
          sourceHandle: 'source-right',
        });
      }

      this.addNode(endIfId, 'process', 'Fin If', line, ctx);

      for (const branchLast of lastNodesOfBranches) {
        this.addEdge(branchLast, endIfId, {
          targetHandle: 'target-top',
        });
      }

      return { ...ctx, lastNodeId: endIfId };
    }

    if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement') {
      if (stmt.type === 'ForStatement' && stmt.init) {
        const initStmt =
          stmt.init.type === 'VariableDeclaration'
            ? stmt.init
            : { type: 'ExpressionStatement', expression: stmt.init, loc: stmt.init.loc };
        ctx = this.processSingleStatement(initStmt, ctx);
      }

      const loopId = `loop_${++this.nodeCounter}`;
      let loopCond = '';
      if (stmt.type === 'ForStatement' && stmt.test) {
        loopCond = formatExpr(stmt.test);
      } else if (stmt.type === 'WhileStatement' && stmt.test) {
        loopCond = formatExpr(stmt.test);
      }

      this.addNode(loopId, 'loop', `Bucle (${loopCond || 'condición'})`, line, ctx);
      this.addEdge(ctx.lastNodeId, loopId);

      let loopCtx: ProcessingContext = { ...ctx, lastNodeId: loopId };

      if (stmt.body) {
        const statementsToProcess = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        loopCtx = this.processStatements(statementsToProcess, loopCtx);
      }

      this.addEdge(loopCtx.lastNodeId, loopId, {
        id: `e_loopback_${loopCtx.lastNodeId}_${loopId}`,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        label: 'Repetir',
        type: 'step',
      });

      const exitLoopId = `exitloop_${++this.nodeCounter}`;
      this.addNode(exitLoopId, 'process', 'Fin Bucle', line, ctx);
      this.addEdge(loopId, exitLoopId, { label: 'Fin Ciclo' });

      return { ...ctx, lastNodeId: exitLoopId };
    }

    if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
      const loopId = `loop_${++this.nodeCounter}`;
      const varName = stmt.left?.declarations?.[0]?.id
        ? formatExpr(stmt.left.declarations[0].id)
        : formatExpr(stmt.left);
      const iterableName = formatExpr(stmt.right);
      const keyword = stmt.type === 'ForInStatement' ? 'in' : 'of';
      const loopLabel = `Para cada (${varName} ${keyword} ${iterableName})`;

      this.addNode(loopId, 'loop', loopLabel, line, ctx);
      this.addEdge(ctx.lastNodeId, loopId);

      let loopCtx: ProcessingContext = { ...ctx, lastNodeId: loopId };

      if (stmt.body) {
        const statementsToProcess = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        loopCtx = this.processStatements(statementsToProcess, loopCtx);
      }

      this.addEdge(loopCtx.lastNodeId, loopId, {
        id: `e_loopback_${loopCtx.lastNodeId}_${loopId}`,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        label: 'Repetir',
        type: 'step',
      });

      const exitLoopId = `exitloop_${++this.nodeCounter}`;
      this.addNode(exitLoopId, 'process', `Fin Bucle For...${keyword === 'in' ? 'In' : 'Of'}`, line, ctx);
      this.addEdge(loopId, exitLoopId, { label: 'Fin Ciclo' });

      return { ...ctx, lastNodeId: exitLoopId };
    }

    return ctx;
  }

  /**
   * Retorna los nodos y aristas construidos.
   */
  build(): FlowchartData {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
}
