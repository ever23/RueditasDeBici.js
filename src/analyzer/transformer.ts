import { FlowchartData, FlowchartNode, FlowchartEdge } from '../shared/types';

export function transformAstToFlowchart(ast: any): FlowchartData {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  let nodeCounter = 0;

  // Nodo Inicio
  nodes.push({
    id: 'start',
    type: 'startEnd',
    data: { label: 'Inicio', codeLine: 1 },
    position: { x: 0, y: 0 },
  });

  let lastNodeId = 'start';

  function isPromptCall(expr: any): boolean {
    if (!expr) return false;
    
    // Si es llamada directa prompt(...) o parseInt(prompt(...))
    if (expr.type === 'CallExpression') {
      const callee = expr.callee;
      if (callee?.name === 'prompt' || callee?.name === 'PromptSync' || callee?.name === 'leer') return true;

      if (
        (callee?.name === 'parseInt' || callee?.name === 'parseFloat') &&
        expr.arguments[0] &&
        isPromptCall(expr.arguments[0])
      ) {
        return true;
      }

      // Si es un encadenamiento de métodos como prompt(...).toLowerCase()
      if (callee?.type === 'MemberExpression') {
        return isPromptCall(callee.object);
      }
    }
    return false;
  }

  function formatLiteralOrId(node: any): string {
    if (!node) return '';
    if (node.type === 'Literal') return JSON.stringify(node.value);
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'TemplateLiteral') return '`...`';
    return '...';
  }

  function formatExpr(node: any): string {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'Literal') return String(node.value);
    if (node.type === 'MemberExpression') {
      const obj = formatExpr(node.object);
      const prop = formatExpr(node.property);
      return `${obj}.${prop}`;
    }
    if (node.type === 'BinaryExpression') {
      return `${formatExpr(node.left)} ${node.operator} ${formatExpr(node.right)}`;
    }
    if (node.type === 'CallExpression') {
      const name = formatExpr(node.callee);
      return `${name}()`;
    }
    if (node.type === 'UpdateExpression') {
      return `${formatExpr(node.argument)}${node.operator}`;
    }
    if (node.type === 'AssignmentExpression') {
      return `${formatExpr(node.left)} ${node.operator} ${formatExpr(node.right)}`;
    }
    return '...';
  }

  function inspectExpression(expr: any): { label: string; type: FlowchartNode['type'] } | null {
    if (!expr) return null;

    if (expr.type === 'UpdateExpression') {
      const varName = formatExpr(expr.argument);
      const isInc = expr.operator === '++';
      return {
        label: `Contador: ${varName} = ${varName} ${isInc ? '+' : '-'} 1`,
        type: 'process',
      };
    }

    if (expr.type === 'AssignmentExpression') {
      const targetVar = formatExpr(expr.left) || 'variable';
      
      if (isPromptCall(expr.right)) {
        return { label: `Leer: ${targetVar}`, type: 'io' };
      }

      const op = expr.operator;
      if (op === '+=' || op === '-=' || op === '*=' || op === '/=') {
        const sign = op[0];
        return {
          label: `Acumulador: ${targetVar} = ${targetVar} ${sign} ${formatExpr(expr.right)}`,
          type: 'process',
        };
      }

      if (
        op === '=' &&
        expr.right?.type === 'BinaryExpression' &&
        formatExpr(expr.right.left) === targetVar
      ) {
        return {
          label: `Acumulador: ${targetVar} = ${formatExpr(expr.right)}`,
          type: 'process',
        };
      }

      const rightText = formatExpr(expr.right);
      return { label: `Asignar: ${targetVar} = ${rightText}`, type: 'process' };
    }

    if (expr.type === 'CallExpression') {
      const calleeObj = expr.callee;
      
      if (
        calleeObj?.type === 'MemberExpression' &&
        calleeObj.object?.name === 'console' &&
        calleeObj.property?.name === 'log'
      ) {
        const argText = expr.arguments.map((arg: any) => formatLiteralOrId(arg)).join(', ');
        return { label: `Escribir: ${argText || '""'}`, type: 'io' };
      }

      if (isPromptCall(expr)) {
        return { label: `Leer: datos`, type: 'io' };
      }

      const funcName = formatExpr(expr.callee);
      return { label: `Llamar: ${funcName}()`, type: 'subroutine' };
    }

    return null;
  }

  function processStatements(statements: any[]) {
    let i = 0;
    while (i < statements.length) {
      const stmt = statements[i];

      if (!stmt || stmt.type === 'ImportDeclaration') {
        i++;
        continue;
      }

      if (
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.some(
          (d: any) => d.id?.name === 'prompt' && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
        )
      ) {
        i++;
        continue;
      }

      if (stmt.type === 'VariableDeclaration') {
        const groupedDecls: string[] = [];
        let firstLine = stmt.loc?.start?.line || 1;

        while (i < statements.length && statements[i]?.type === 'VariableDeclaration') {
          const currentStmt = statements[i];
          const isPromptInit = currentStmt.declarations.some(
            (d: any) => d.id?.name === 'prompt' && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
          );
          if (isPromptInit) {
            i++;
            continue;
          }

          let hasPrompt = false;
          currentStmt.declarations.forEach((d: any) => {
            if (d.init && isPromptCall(d.init)) {
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
              groupedDecls.push(varName);
            }
          });

          i++;
        }

        if (groupedDecls.length > 0) {
          const id = `node_${++nodeCounter}`;
          nodes.push({
            id,
            type: 'process',
            data: { label: `Declarar: ${groupedDecls.join('\n')}`, codeLine: firstLine },
            position: { x: 0, y: 0 },
          });
          edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
          lastNodeId = id;
        }

        if (i < statements.length && statements[i]?.type === 'VariableDeclaration') {
          processSingleStatement(statements[i]);
          i++;
        }
      } else {
        processSingleStatement(stmt);
        i++;
      }
    }
  }

  function processSingleStatement(stmt: any) {
    if (!stmt) return;
    const line = stmt.loc?.start?.line || 1;
    const id = `node_${++nodeCounter}`;

    if (stmt.type === 'VariableDeclaration') {
      let readVar = '';
      stmt.declarations.forEach((d: any) => {
        if (d.init && isPromptCall(d.init)) {
          readVar = formatExpr(d.id) || 'datos';
        }
      });

      nodes.push({
        id,
        type: 'io',
        data: { label: `Leer: ${readVar}`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;
    }
    else if (stmt.type === 'FunctionDeclaration') {
      const funcName = stmt.id?.name || 'función';
      nodes.push({
        id,
        type: 'subroutine',
        data: { label: `Subprograma: ${funcName}()`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;

      if (stmt.body && stmt.body.body) {
        processStatements(stmt.body.body);
      }

      const endFuncId = `endfunc_${++nodeCounter}`;
      nodes.push({
        id: endFuncId,
        type: 'process',
        data: { label: `Retorno de ${funcName}()`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${endFuncId}`, source: lastNodeId, target: endFuncId });
      lastNodeId = endFuncId;
    }
    else if (stmt.type === 'SwitchStatement') {
      const discriminant = formatExpr(stmt.discriminant);
      const switchId = `switch_${++nodeCounter}`;

      nodes.push({
        id: switchId,
        type: 'decision',
        data: { label: `¿Según (${discriminant})?`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${switchId}`, source: lastNodeId, target: switchId });

      const endSwitchId = `endswitch_${++nodeCounter}`;
      const caseLastNodeIds: string[] = [];

      if (Array.isArray(stmt.cases)) {
        stmt.cases.forEach((caseClause: any) => {
          const caseTest = caseClause.test ? formatExpr(caseClause.test) : 'Por Defecto';
          lastNodeId = switchId;

          const firstCaseNodeIndex = nodeCounter + 1;
          processStatements(caseClause.consequent || []);
          const firstCaseNodeId = `node_${firstCaseNodeIndex}`;

          const edgeToCase = edges.find(e => e.source === switchId && e.target === firstCaseNodeId);
          if (edgeToCase) {
            edgeToCase.label = `Opción: ${caseTest}`;
            edgeToCase.sourceHandle = 'source-right';
          } else {
            edges.push({
              id: `e_${switchId}_${firstCaseNodeId}`,
              source: switchId,
              target: firstCaseNodeId,
              label: `Opción: ${caseTest}`,
              sourceHandle: 'source-right',
            });
          }

          caseLastNodeIds.push(lastNodeId);
        });
      }

      nodes.push({
        id: endSwitchId,
        type: 'process',
        data: { label: 'Fin Según (Switch)', codeLine: line },
        position: { x: 0, y: 0 },
      });

      caseLastNodeIds.forEach((caseLastId) => {
        edges.push({
          id: `e_${caseLastId}_${endSwitchId}`,
          source: caseLastId,
          target: endSwitchId,
        });
      });

      lastNodeId = endSwitchId;
    }
    else if (stmt.type === 'DoWhileStatement') {
      const loopId = `loop_${++nodeCounter}`;
      const loopCond = formatExpr(stmt.test);

      nodes.push({
        id: loopId,
        type: 'loop',
        data: { label: `Hacer...Mientras (${loopCond})`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${loopId}`, source: lastNodeId, target: loopId });
      lastNodeId = loopId;

      if (stmt.body) {
        const statementsToProcess = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        processStatements(statementsToProcess);
      }

      edges.push({
        id: `e_loopback_${lastNodeId}_${loopId}`,
        source: lastNodeId,
        target: loopId,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        label: 'Repetir',
        type: 'step',
      });

      const exitLoopId = `exitloop_${++nodeCounter}`;
      nodes.push({
        id: exitLoopId,
        type: 'process',
        data: { label: 'Fin Bucle Do...While', codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${loopId}_${exitLoopId}`, source: loopId, target: exitLoopId, label: 'Fin Ciclo' });

      lastNodeId = exitLoopId;
    }
    else if (stmt.type === 'ExpressionStatement') {
      const inspected = inspectExpression(stmt.expression);
      let nodeType: FlowchartNode['type'] = 'process';
      let labelText = `Expresión (L. ${line})`;

      if (inspected) {
        nodeType = inspected.type;
        labelText = inspected.label;
      }

      nodes.push({
        id,
        type: nodeType,
        data: { label: labelText, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;
    } 
    else if (stmt.type === 'IfStatement') {
      const condText = formatExpr(stmt.test);
      const decisionId = `dec_${++nodeCounter}`;
      nodes.push({
        id: decisionId,
        type: 'decision',
        data: { label: `¿${condText}?`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${decisionId}`, source: lastNodeId, target: decisionId });

      lastNodeId = decisionId;
      let firstInConsequentId: string | null = null;

      if (stmt.consequent) {
        const nextCounter = nodeCounter + 1;
        const statementsToProcess = stmt.consequent.type === 'BlockStatement' ? stmt.consequent.body : [stmt.consequent];
        processStatements(statementsToProcess);
        firstInConsequentId = `node_${nextCounter}`;
      }
      const lastInConsequent = lastNodeId;

      const consequentEdgeIndex = edges.findIndex(e => e.source === decisionId && (firstInConsequentId ? e.target === firstInConsequentId : true));
      if (consequentEdgeIndex !== -1) {
        edges[consequentEdgeIndex].label = 'Sí';
        edges[consequentEdgeIndex].sourceHandle = 'source-bottom';
      }

      lastNodeId = decisionId;
      let firstInAlternateId: string | null = null;
      let lastInAlternate: string | null = null;

      if (stmt.alternate) {
        const nextCounter = nodeCounter + 1;
        const statementsToProcess = stmt.alternate.type === 'BlockStatement' ? stmt.alternate.body : [stmt.alternate];
        processStatements(statementsToProcess);
        firstInAlternateId = `node_${nextCounter}`;
        lastInAlternate = lastNodeId;

        const alternateEdgeIndex = edges.findIndex(e => e.source === decisionId && e.target === firstInAlternateId);
        if (alternateEdgeIndex !== -1) {
          edges[alternateEdgeIndex].label = 'No';
          edges[alternateEdgeIndex].sourceHandle = 'source-right';
        }
      }

      const endIfId = `endif_${++nodeCounter}`;
      nodes.push({
        id: endIfId,
        type: 'process',
        data: { label: 'Fin If', codeLine: line },
        position: { x: 0, y: 0 },
      });

      edges.push({
        id: `e_${lastInConsequent}_${endIfId}`,
        source: lastInConsequent,
        target: endIfId,
        targetHandle: 'target-top',
      });

      if (lastInAlternate) {
        edges.push({
          id: `e_${lastInAlternate}_${endIfId}`,
          source: lastInAlternate,
          target: endIfId,
          targetHandle: 'target-right',
        });
      } else {
        edges.push({
          id: `e_${decisionId}_${endIfId}`,
          source: decisionId,
          target: endIfId,
          label: 'No',
          sourceHandle: 'source-right',
          targetHandle: 'target-right',
        });
      }

      lastNodeId = endIfId;
    } 
    else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement') {
      const loopId = `loop_${++nodeCounter}`;
      let loopCond = '';
      if (stmt.type === 'ForStatement' && stmt.test) {
        loopCond = formatExpr(stmt.test);
      } else if (stmt.type === 'WhileStatement' && stmt.test) {
        loopCond = formatExpr(stmt.test);
      }

      nodes.push({
        id: loopId,
        type: 'loop',
        data: { label: `Bucle (${loopCond || 'condición'})`, codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${loopId}`, source: lastNodeId, target: loopId });

      lastNodeId = loopId;

      if (stmt.body) {
        const statementsToProcess = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        processStatements(statementsToProcess);
      }

      edges.push({
        id: `e_loopback_${lastNodeId}_${loopId}`,
        source: lastNodeId,
        target: loopId,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        label: 'Repetir',
        type: 'step',
      });

      const exitLoopId = `exitloop_${++nodeCounter}`;
      nodes.push({
        id: exitLoopId,
        type: 'process',
        data: { label: 'Fin Bucle', codeLine: line },
        position: { x: 0, y: 0 },
      });

      edges.push({ id: `e_${loopId}_${exitLoopId}`, source: loopId, target: exitLoopId, label: 'Fin Ciclo' });

      lastNodeId = exitLoopId;
    }
  }

  if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
    processStatements(ast.body);
  }

  // Nodo Fin
  const endId = 'end';
  nodes.push({
    id: endId,
    type: 'startEnd',
    data: { label: 'Fin', codeLine: ast?.loc?.end?.line || 1 },
    position: { x: 0, y: 0 },
  });

  edges.push({ id: `e_${lastNodeId}_${endId}`, source: lastNodeId, target: endId });

  return { nodes, edges };
}
