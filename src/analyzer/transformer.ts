import { FlowchartData, FlowchartNode, FlowchartEdge } from '../shared/types';

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

export function transformAstToFlowchart(ast: any): FlowchartData {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  let nodeCounter = 0;
  let colorIndex = 0;

  // Nodo Inicio del diagrama principal
  nodes.push({
    id: 'start',
    type: 'startEnd',
    data: { label: 'Inicio', codeLine: 1 },
    position: { x: 0, y: 0 },
  });

  let lastNodeId = 'start';
  let promptVars = new Set<string>(['prompt', 'leer']);
  
  const scanForPrompts = (node: any) => {
    if (!node) return;
    if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
      if (node.init.type === 'CallExpression' && (node.init.callee?.name === 'PromptSync' || node.init.callee?.name === 'require')) {
        promptVars.add(node.id.name);
      }
    }
    if (Array.isArray(node)) {
      node.forEach(scanForPrompts);
    } else if (typeof node === 'object') {
      for (const key in node) {
        if (node.hasOwnProperty(key)) scanForPrompts(node[key]);
      }
    }
  };
  scanForPrompts(ast);

  function isPromptCall(expr: any): boolean {
    if (!expr) return false;
    
    if (expr.type === 'CallExpression') {
      const callee = expr.callee;
      if (callee?.name && promptVars.has(callee.name)) return true;

      if (
        (callee?.name === 'parseInt' || callee?.name === 'parseFloat') &&
        expr.arguments[0] &&
        isPromptCall(expr.arguments[0])
      ) {
        return true;
      }

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
    if (node.type === 'TemplateLiteral') return formatExpr(node);
    return '...';
  }

  function formatExpr(node: any): string {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'Literal') return String(node.value);
    if (node.type === 'TemplateLiteral') {
      let str = '`';
      const quasis = node.quasis || [];
      const expressions = node.expressions || [];
      for (let i = 0; i < quasis.length; i++) {
        str += quasis[i].value?.raw || '';
        if (i < expressions.length) {
          str += '${' + formatExpr(expressions[i]) + '}';
        }
      }
      str += '`';
      return str;
    }
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
      const args = node.arguments ? node.arguments.map((a: any) => formatExpr(a)).join(', ') : '';
      return `${name}(${args})`;
    }
    if (node.type === 'UpdateExpression') {
      return `${formatExpr(node.argument)}${node.operator}`;
    }
    if (node.type === 'AssignmentExpression') {
      return `${formatExpr(node.left)} ${node.operator} ${formatExpr(node.right)}`;
    }
    if (node.type === 'ObjectPattern') {
      const props = node.properties.map((p: any) => p.value ? formatExpr(p.value) : formatExpr(p)).join(', ');
      return `{ ${props} }`;
    }
    if (node.type === 'ArrayPattern') {
      const elems = node.elements.map((e: any) => e ? formatExpr(e) : '').join(', ');
      return `[${elems}]`;
    }
    if (node.type === 'RestElement') {
      return `...${formatExpr(node.argument)}`;
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
        return { label: `Leer: ${targetVar}`, type: 'input' };
      }

      if (expr.right?.type === 'CallExpression') {
        const funcName = formatExpr(expr.right.callee);
        if (funcName && funcName !== 'prompt' && funcName !== 'parseInt' && funcName !== 'parseFloat') {
          return { label: `Asignar retorno de: ${funcName}() a ${targetVar}`, type: 'subroutine' };
        }
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
      if (expr.callee?.type === 'MemberExpression' && expr.callee.object?.name === 'console') {
        const method = expr.callee.property?.name;
        if (['log', 'error', 'warn', 'info'].includes(method)) {
          const argsStr = expr.arguments.map((a: any) => formatExpr(a)).join(', ');
          return { label: `Escribir: ${argsStr}`, type: 'output' };
        }
      }

      if (isPromptCall(expr)) {
        return { label: `Leer: datos`, type: 'input' };
      }

      const funcName = formatExpr(expr.callee);
      return { label: `Llamada: ${funcName}()`, type: 'subroutine' };
    }

    return null;
  }

  // Transformar la declaración de una función en un mini-diagrama independiente encerrado en una caja
  function processFunctionDeclaration(funcStmt: any) {
    const funcName = funcStmt.id?.name || 'función';
    const params = funcStmt.params ? funcStmt.params.map((p: any) => formatExpr(p)).join(', ') : '';
    const line = funcStmt.loc?.start?.line || 1;

    const bgColor = FUNCTION_COLORS[colorIndex % FUNCTION_COLORS.length];
    const borderColor = FUNCTION_BORDER_COLORS[colorIndex % FUNCTION_BORDER_COLORS.length];
    colorIndex++;

    const groupId = `func_group_${funcName}_${++nodeCounter}`;

    // Nodo contenedor (Caja del mini-diagrama de la función)
    nodes.push({
      id: groupId,
      type: 'functionGroup',
      data: { label: `Función: ${funcName}(${params})`, codeLine: line },
      position: { x: 0, y: 0 },
      style: {
        backgroundColor: bgColor,
        borderColor: borderColor,
      },
    });

    const funcStartId = `func_start_${++nodeCounter}`;
    nodes.push({
      id: funcStartId,
      type: 'startEnd',
      data: { label: `Inicio ${funcName}`, codeLine: line },
      position: { x: 0, y: 0 },
      parentNode: groupId,
      extent: 'parent',
    });

    let currentLast = funcStartId;

    if (params) {
      const paramNodeId = `func_params_${++nodeCounter}`;
      nodes.push({
        id: paramNodeId,
        type: 'functionData',
        data: { label: `Recibe: ${params}`, codeLine: line },
        position: { x: 0, y: 0 },
        parentNode: groupId,
        extent: 'parent',
      });
      edges.push({ id: `e_${currentLast}_${paramNodeId}`, source: currentLast, target: paramNodeId });
      currentLast = paramNodeId;
    }

    if (funcStmt.body && Array.isArray(funcStmt.body.body)) {
      currentLast = processStatementsInsideFunction(funcStmt.body.body, groupId, currentLast);
    }

    const funcEndId = `func_end_${++nodeCounter}`;
    nodes.push({
      id: funcEndId,
      type: 'startEnd',
      data: { label: `Fin ${funcName}`, codeLine: funcStmt.loc?.end?.line || line },
      position: { x: 0, y: 0 },
      parentNode: groupId,
      extent: 'parent',
    });

    edges.push({ id: `e_${currentLast}_${funcEndId}`, source: currentLast, target: funcEndId });
  }

  function processStatementsInsideFunction(statements: any[], groupId: string, startNodeId: string): string {
    let localLast = startNodeId;

    for (const stmt of statements) {
      if (!stmt) continue;
      const line = stmt.loc?.start?.line || 1;
      const id = `node_${++nodeCounter}`;

      if (stmt.type === 'ReturnStatement') {
        const retVal = stmt.argument ? formatExpr(stmt.argument) : '';
        nodes.push({
          id,
          type: 'functionData',
          data: { label: `Retornar: ${retVal}`, codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${id}`, source: localLast, target: id });
        localLast = id;
      }
      else if (stmt.type === 'VariableDeclaration') {
        const decls = stmt.declarations.map((d: any) => {
          const varName = formatExpr(d.id);
          return d.init ? `${varName} = ${formatExpr(d.init)}` : varName;
        }).join(', ');

        const declPrefix = stmt.kind === 'const' ? 'Constante' : 'Variable';
        nodes.push({
          id,
          type: 'process',
          data: { label: `${declPrefix}: ${decls}`, codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${id}`, source: localLast, target: id });
        localLast = id;
      }
      else if (stmt.type === 'ExpressionStatement') {
        const inspected = inspectExpression(stmt.expression);
        nodes.push({
          id,
          type: inspected ? inspected.type : 'process',
          data: { label: inspected ? inspected.label : `Expresión (L. ${line})`, codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${id}`, source: localLast, target: id });
        localLast = id;
      }
      else if (stmt.type === 'BreakStatement') {
        nodes.push({
          id,
          type: 'process',
          data: { label: 'Salir del Bucle (break)', codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${id}`, source: localLast, target: id });
        localLast = id;
      }
      else if (stmt.type === 'ContinueStatement') {
        nodes.push({
          id,
          type: 'process',
          data: { label: 'Siguiente Iteración (continue)', codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${id}`, source: localLast, target: id });
        localLast = id;
      }
      else if (stmt.type === 'IfStatement') {
        const condText = formatExpr(stmt.test);
        const decId = `dec_${++nodeCounter}`;
        nodes.push({
          id: decId,
          type: 'decision',
          data: { label: `¿${condText}?`, codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });
        edges.push({ id: `e_${localLast}_${decId}`, source: localLast, target: decId });

        let consequentLast = decId;
        if (stmt.consequent) {
          const body = stmt.consequent.type === 'BlockStatement' ? stmt.consequent.body : [stmt.consequent];
          consequentLast = processStatementsInsideFunction(body, groupId, decId);
        }

        let alternateLast: string | null = null;
        if (stmt.alternate) {
          const body = stmt.alternate.type === 'BlockStatement' ? stmt.alternate.body : [stmt.alternate];
          alternateLast = processStatementsInsideFunction(body, groupId, decId);
        }

        const endIfId = `endif_${++nodeCounter}`;
        nodes.push({
          id: endIfId,
          type: 'process',
          data: { label: 'Fin If', codeLine: line },
          position: { x: 0, y: 0 },
          parentNode: groupId,
          extent: 'parent',
        });

        edges.push({ id: `e_${consequentLast}_${endIfId}`, source: consequentLast, target: endIfId });
        if (alternateLast) {
          edges.push({ id: `e_${alternateLast}_${endIfId}`, source: alternateLast, target: endIfId });
        } else {
          edges.push({ id: `e_${decId}_${endIfId}`, source: decId, target: endIfId, label: 'No' });
        }

        localLast = endIfId;
      }
    }

    return localLast;
  }

  function processStatements(statements: any[]) {
    let i = 0;
    while (i < statements.length) {
      const stmt = statements[i];

      if (!stmt || stmt.type === 'ImportDeclaration') {
        i++;
        continue;
      }

      if (stmt.type === 'FunctionDeclaration') {
        processFunctionDeclaration(stmt);
        i++;
        continue;
      }

      if (
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.some(
          (d: any) => d.id?.name && promptVars.has(d.id.name) && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
        )
      ) {
        i++;
        continue;
      }

      if (stmt.type === 'VariableDeclaration') {
        // Generar sub-diagramas para funciones asignadas a variables
        stmt.declarations.forEach((d: any) => {
          if (d.id?.name && d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression')) {
            const fakeFunc = {
              ...d.init,
              id: { name: d.id.name },
              loc: stmt.loc
            };
            processFunctionDeclaration(fakeFunc);
          }
        });

        const groupedDecls: string[] = [];
        const groupedLines: number[] = [];
        let firstLine = stmt.loc?.start?.line || 1;

        while (i < statements.length && statements[i]?.type === 'VariableDeclaration') {
          const currentStmt = statements[i];
          const isPromptInit = currentStmt.declarations.some(
            (d: any) => d.id?.name && promptVars.has(d.id.name) && (d.init?.callee?.name === 'PromptSync' || d.init?.callee?.name === 'require')
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
              groupedDecls.push(`${varName}`);
            }
          });
          
          groupedLines.push(currentStmt.loc?.start?.line || 1);

          i++;
        }

        if (groupedDecls.length > 0) {
          const declPrefix = stmt.kind === 'const' ? 'Constante' : 'Variable';
          const id = `node_${++nodeCounter}`;
          nodes.push({
            id,
            type: 'process',
            data: { label: `${declPrefix}:\n${groupedDecls.join('\n')}`, codeLine: firstLine, lines: groupedLines },
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
      let hasPrompt = false;
      let readVar = '';
      let groupedDecls: string[] = [];

      stmt.declarations.forEach((d: any) => {
        if (d.init && isPromptCall(d.init)) {
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
        nodes.push({
          id,
          type: 'input',
          data: { label: `Leer: ${readVar}`, codeLine: line },
          position: { x: 0, y: 0 },
        });
      } else {
        const declPrefix = stmt.kind === 'const' ? 'Constante' : 'Variable';
        nodes.push({
          id,
          type: 'process',
          data: { label: `${declPrefix}:\n${groupedDecls.join('\n')}`, codeLine: line },
          position: { x: 0, y: 0 },
        });
      }
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;
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
    else if (stmt.type === 'BreakStatement') {
      nodes.push({
        id,
        type: 'process',
        data: { label: 'Salir del Bucle (break)', codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;
    }
    else if (stmt.type === 'ContinueStatement') {
      nodes.push({
        id,
        type: 'process',
        data: { label: 'Siguiente Iteración (continue)', codeLine: line },
        position: { x: 0, y: 0 },
      });
      edges.push({ id: `e_${lastNodeId}_${id}`, source: lastNodeId, target: id });
      lastNodeId = id;
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
      const branches: any[] = [];
      let curr = stmt;
      while (curr && curr.type === 'IfStatement') {
        branches.push({ test: curr.test, consequent: curr.consequent, line: curr.loc?.start?.line || line });
        curr = curr.alternate;
      }
      const finalElse = curr;

      const endIfId = `endif_${++nodeCounter}`;
      let previousDecisionId: string | null = null;
      let inputToNext = lastNodeId;
      const lastNodesOfBranches: string[] = [];

      for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const condText = formatExpr(branch.test);
        const decisionId = `dec_${++nodeCounter}`;
        
        nodes.push({
          id: decisionId,
          type: 'decision',
          data: { label: `¿${condText}?`, codeLine: branch.line },
          position: { x: 0, y: 0 },
        });

        edges.push({
          id: `e_${inputToNext}_${decisionId}`,
          source: inputToNext,
          target: decisionId,
          label: previousDecisionId ? 'No' : undefined,
          sourceHandle: previousDecisionId ? 'source-right' : undefined
        });

        lastNodeId = decisionId;
        const body = branch.consequent.type === 'BlockStatement' ? branch.consequent.body : [branch.consequent];
        processStatements(body);
        
        const edgeIdx = edges.findIndex(e => e.source === decisionId && !e.label);
        if (edgeIdx !== -1) {
          edges[edgeIdx].label = 'Sí';
          edges[edgeIdx].sourceHandle = 'source-bottom';
        }

        lastNodesOfBranches.push(lastNodeId);
        
        previousDecisionId = decisionId;
        inputToNext = decisionId;
      }

      if (finalElse) {
        lastNodeId = previousDecisionId!;
        const body = finalElse.type === 'BlockStatement' ? finalElse.body : [finalElse];
        processStatements(body);
        
        const edgeIdx = edges.findIndex(e => e.source === previousDecisionId && !e.label);
        if (edgeIdx !== -1) {
          edges[edgeIdx].label = 'No';
          edges[edgeIdx].sourceHandle = 'source-right';
        }
        
        lastNodesOfBranches.push(lastNodeId);
      } else {
        edges.push({
          id: `e_${previousDecisionId}_${endIfId}`,
          source: previousDecisionId!,
          target: endIfId,
          label: 'No',
          sourceHandle: 'source-right'
        });
      }

      nodes.push({
        id: endIfId,
        type: 'process',
        data: { label: 'Fin If', codeLine: line },
        position: { x: 0, y: 0 },
      });

      for (const branchLast of lastNodesOfBranches) {
        edges.push({
          id: `e_${branchLast}_${endIfId}`,
          source: branchLast,
          target: endIfId,
          targetHandle: 'target-top',
        });
      }

      lastNodeId = endIfId;
    } 
    else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement') {
      if (stmt.type === 'ForStatement' && stmt.init) {
        const initStmt = stmt.init.type === 'VariableDeclaration' 
          ? stmt.init 
          : { type: 'ExpressionStatement', expression: stmt.init, loc: stmt.init.loc };
        processSingleStatement(initStmt);
      }

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
    else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
      const loopId = `loop_${++nodeCounter}`;
      const varName = stmt.left?.declarations?.[0]?.id ? formatExpr(stmt.left.declarations[0].id) : formatExpr(stmt.left);
      const iterableName = formatExpr(stmt.right);
      const keyword = stmt.type === 'ForInStatement' ? 'in' : 'of';
      const loopLabel = `Para cada (${varName} ${keyword} ${iterableName})`;

      nodes.push({
        id: loopId,
        type: 'loop',
        data: { label: loopLabel, codeLine: line },
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
        data: { label: `Fin Bucle For...${keyword === 'in' ? 'In' : 'Of'}`, codeLine: line },
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
