import { ISimulationContext } from '../shared/types';
import { ScopeManager } from './ScopeManager';
import { InputManager } from './InputManager';
import { StepFactory } from './stepFactory';
import { ExpressionEvaluator } from './expressionEvaluator';
import { invokeFunctionCall } from './functionInvoker';

export interface StatementHandlerContext {
  scopeManager: ScopeManager;
  inputManager: InputManager;
  stepFactory: StepFactory;
  functionsMap: Map<string, any>;
  evaluator: ExpressionEvaluator;
  simulationContext: ISimulationContext;
  insideFunction: { value: boolean };
  breakSignal: { value: boolean };
  continueSignal: { value: boolean };
  returnSignal?: { value: boolean };
  lastReturnValue: { value: any };
  maxLoopIterations: number;
}

/**
 * Evalúa una lista de sentencias secuencialmente, deteniéndose ante señales de break, continue o return.
 */
export function evaluateStatements(
  statements: any[],
  nodesMap: Map<string, string>,
  ctx: StatementHandlerContext
): void {
  for (const stmt of statements) {
    if (ctx.breakSignal.value || ctx.continueSignal.value || ctx.returnSignal?.value) return;
    evaluateStatement(stmt, nodesMap, ctx);
    if (ctx.breakSignal.value || ctx.continueSignal.value || ctx.returnSignal?.value) return;
  }
}

/**
 * Despacha la evaluación de una sentencia individual según su tipo en el AST.
 */
export function evaluateStatement(
  stmt: any,
  nodesMap: Map<string, string>,
  ctx: StatementHandlerContext
): void {
  if (!stmt) return;

  const handler = statementHandlers[stmt.type];
  if (handler) {
    handler(stmt, nodesMap, ctx);
  }
}

type StatementHandler = (
  stmt: any,
  nodesMap: Map<string, string>,
  ctx: StatementHandlerContext
) => void;

const handleImport: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const source = stmt.source?.value || 'unknown';

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `Sistema ➔ Cargando librería externa: '${source}'`,
  });
};

const handleBreak: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: 'SALTO DE CONTROL ➜ BREAK: Salir del Bucle',
  });
  ctx.breakSignal.value = true;
};

const handleContinue: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: 'SALTO DE CONTROL ➜ CONTINUE: Siguiente Iteración',
  });
  ctx.continueSignal.value = true;
};

const handleReturn: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const retVal = stmt.argument
    ? ctx.evaluator.evaluate(stmt.argument, ctx.simulationContext, nodesMap, targetNodeId, line)
    : undefined;

  ctx.lastReturnValue.value = retVal;
  if (ctx.returnSignal) {
    ctx.returnSignal.value = true;
  }

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `CPU Retorno de Subrutina ➔ Valor devuelto: ${JSON.stringify(retVal)}`,
  });
};

const handleVariableDecl: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);

  stmt.declarations.forEach((d: any) => {
    if (ctx.inputManager.isPromptRequireDecl(d)) {
      ctx.scopeManager.declareVariable(d.id?.name, '[Interfaz de Teclado]');
      ctx.stepFactory.emitStep({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `Sistema ➔ Instanciando librería de teclado ➔ RAM [${d.id?.name}]`,
      });
      return;
    }

    // Desestructuración de Objetos
    if (d.id?.type === 'ObjectPattern') {
      const initVal = ctx.evaluator.evaluate(d.init, ctx.simulationContext, nodesMap, targetNodeId, line);
      const keys: string[] = [];
      d.id.properties.forEach((prop: any) => {
        if (prop.type === 'Property' && prop.value.type === 'Identifier') {
          const propName = prop.key.name || prop.key.value;
          const targetName = prop.value.name;
          const val = initVal ? initVal[propName] : undefined;
          ctx.scopeManager.declareVariable(targetName, val);
          keys.push(`${targetName}: ${val}`);
        }
      });
      ctx.stepFactory.emitStep({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `CPU Desestructuración {} ➔ RAM [${keys.join(', ')}]`,
      });
      return;
    }

    // Desestructuración de Arreglos
    if (d.id?.type === 'ArrayPattern') {
      const initVal = ctx.evaluator.evaluate(d.init, ctx.simulationContext, nodesMap, targetNodeId, line);
      const keys: string[] = [];
      d.id.elements.forEach((elem: any, idx: number) => {
        if (elem && elem.type === 'Identifier') {
          const val = Array.isArray(initVal) ? initVal[idx] : undefined;
          ctx.scopeManager.declareVariable(elem.name, val);
          keys.push(`${elem.name}: ${val}`);
        } else if (elem && elem.type === 'RestElement' && elem.argument.type === 'Identifier') {
          const val = Array.isArray(initVal) ? initVal.slice(idx) : [];
          ctx.scopeManager.declareVariable(elem.argument.name, val);
          keys.push(`...${elem.argument.name}: [${val.length} items]`);
        }
      });
      ctx.stepFactory.emitStep({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `CPU Desestructuración [] ➔ RAM [${keys.join(', ')}]`,
      });
      return;
    }

    const name = d.id?.name || 'var';

    if (d.init && ctx.inputManager.isPromptCall(d.init)) {
      const promptMsg = ctx.inputManager.extractPromptText(d.init, (arg) =>
        ctx.evaluator.evaluate(arg, ctx.simulationContext, nodesMap)
      );
      const providedValue = ctx.inputManager.consumeNextInput();

      if (providedValue !== null) {
        const isNumeric = ctx.inputManager.wrapsNumericConversion(d.init);
        const parsedVal = isNumeric ? Number(providedValue) : providedValue;
        ctx.scopeManager.declareVariable(name, parsedVal);

        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
          needsInput: false,
          inputVarName: name,
          inputPromptText: promptMsg,
        });
      } else {
        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
          needsInput: true,
          inputVarName: name,
          inputPromptText: promptMsg,
        });
      }
      return;
    }

    let val: any = undefined;
    let opDesc = `Declarar variable: ${name}`;

    if (d.init) {
      if (d.init.type === 'Literal') {
        val = d.init.value;
        opDesc = `CPU Cargar valor literal ${val} ➔ Asignar a RAM [${name}]`;
      } else if (
        d.init.type === 'ArrowFunctionExpression' ||
        d.init.type === 'FunctionExpression'
      ) {
        const paramsList = (d.init.params || []).map((p: any) => p.name || '...').join(', ');
        const groupNodeId = nodesMap.get(`group:${line}`) || targetNodeId;
        val = {
          __type: 'Function',
          name: name,
          signature: `ƒ(${paramsList})`,
          line: line,
          nodeId: groupNodeId,
        };
        ctx.functionsMap.set(name, d.init);
        opDesc = `CPU Asignar tipo Function (expresión) ➔ RAM [${name}] = ƒ(${paramsList})`;
      } else if (
        d.init.type === 'CallExpression' &&
        ctx.functionsMap.has(d.init.callee?.name)
      ) {
        val = invokeFunctionCall(d.init, targetNodeId, nodesMap, {
          scopeManager: ctx.scopeManager,
          stepFactory: ctx.stepFactory,
          functionsMap: ctx.functionsMap,
          evaluator: ctx.evaluator,
          simulationContext: ctx.simulationContext,
          insideFunction: ctx.insideFunction,
          lastReturnValue: ctx.lastReturnValue,
          returnSignal: ctx.returnSignal,
          evaluateStatements: (stmts, map) => evaluateStatements(stmts, map, ctx),
        });
        opDesc = `CPU Asignar retorno de subrutina ${d.init.callee.name}() ➔ RAM [${name}] = ${JSON.stringify(val)}`;
      } else {
        val = ctx.evaluator.evaluate(d.init, ctx.simulationContext, nodesMap, targetNodeId, line);
        opDesc = `CPU Evaluar Expresión ➔ RAM [${name}] = ${JSON.stringify(val)}`;
      }
    }

    ctx.scopeManager.declareVariable(name, val);

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: opDesc,
    });
  });
};

const handleExpression: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const expr = stmt.expression;

  // console.log, warn, error, info
  if (
    expr.type === 'CallExpression' &&
    expr.callee?.type === 'MemberExpression' &&
    expr.callee.object?.name === 'console' &&
    ['log', 'warn', 'error', 'info'].includes(expr.callee.property?.name)
  ) {
    const method = expr.callee.property.name;
    const printedText = expr.arguments
      .map((arg: any) => {
        return String(
          ctx.evaluator.evaluate(arg, ctx.simulationContext, nodesMap, targetNodeId, line)
        );
      })
      .join(' ');

    let prefix = '';
    if (method === 'warn') prefix = '⚠️ ';
    else if (method === 'error') prefix = '❌ ';
    else if (method === 'info') prefix = 'ℹ️ ';

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `E/S Imprimir en Consola (Escribir): "${printedText}"`,
      outputLog: prefix + printedText,
    });
    return;
  }

  // AssignmentExpression
  if (expr.type === 'AssignmentExpression') {
    const isMember = expr.left?.type === 'MemberExpression';
    const name = isMember ? expr.left.object?.name || 'obj' : expr.left?.name || 'var';

    if (ctx.inputManager.isPromptCall(expr.right)) {
      const promptMsg = ctx.inputManager.extractPromptText(expr.right, (arg) =>
        ctx.evaluator.evaluate(arg, ctx.simulationContext, nodesMap)
      );
      const providedValue = ctx.inputManager.consumeNextInput();

      if (providedValue !== null) {
        const isNumeric = ctx.inputManager.wrapsNumericConversion(expr.right);
        const parsedVal = isNumeric ? Number(providedValue) : providedValue;

        if (isMember) {
          const objVal = ctx.evaluator.evaluate(expr.left.object, ctx.simulationContext, nodesMap);
          const propName = expr.left.computed
            ? ctx.evaluator.evaluate(expr.left.property, ctx.simulationContext, nodesMap)
            : expr.left.property?.name;
          if (objVal != null && propName != null) objVal[propName] = parsedVal;
        } else {
          ctx.scopeManager.updateVariable(name, parsedVal);
        }

        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
          needsInput: false,
          inputVarName: name,
          inputPromptText: promptMsg,
        });
      } else {
        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
          needsInput: true,
          inputVarName: name,
          inputPromptText: promptMsg,
        });
      }
      return;
    }

    let rightVal: any = 0;
    if (
      expr.right?.type === 'CallExpression' &&
      ctx.functionsMap.has(expr.right.callee?.name)
    ) {
      rightVal = invokeFunctionCall(expr.right, targetNodeId, nodesMap, {
        scopeManager: ctx.scopeManager,
        stepFactory: ctx.stepFactory,
        functionsMap: ctx.functionsMap,
        evaluator: ctx.evaluator,
        simulationContext: ctx.simulationContext,
        insideFunction: ctx.insideFunction,
        lastReturnValue: ctx.lastReturnValue,
        returnSignal: ctx.returnSignal,
        evaluateStatements: (stmts, map) => evaluateStatements(stmts, map, ctx),
      });
    } else {
      rightVal = ctx.evaluator.evaluate(expr.right, ctx.simulationContext, nodesMap, targetNodeId, line);
    }

    let currentVal: any = 0;
    let objVal: any = null;
    let propName: any = null;

    if (isMember) {
      objVal = ctx.evaluator.evaluate(expr.left.object, ctx.simulationContext, nodesMap);
      propName = expr.left.computed
        ? ctx.evaluator.evaluate(expr.left.property, ctx.simulationContext, nodesMap)
        : expr.left.property?.name;
      if (objVal != null && propName != null) {
        currentVal = objVal[propName];
      }
    } else {
      currentVal = ctx.scopeManager.getMemory()[name];
    }

    let val = rightVal;
    if (expr.operator === '+=') val = currentVal + rightVal;
    else if (expr.operator === '-=') val = currentVal - rightVal;
    else if (expr.operator === '*=') val = currentVal * rightVal;
    else if (expr.operator === '/=') val = currentVal / rightVal;
    else if (expr.operator === '%=') val = currentVal % rightVal;

    if (isMember) {
      if (objVal != null && propName != null) objVal[propName] = val;
    } else {
      ctx.scopeManager.updateVariable(name, val);
    }

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Cálculo: ${name} = ${JSON.stringify(val)} ➔ Guardar en RAM`,
    });
  } else if (expr.type === 'UpdateExpression') {
    const name = expr.argument?.name || 'var';
    const isInc = expr.operator === '++';
    const oldVal = Number(ctx.scopeManager.getMemory()[name] || 0);
    const newVal = isInc ? oldVal + 1 : oldVal - 1;
    ctx.scopeManager.updateVariable(name, newVal);

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Contador: ${name} (${oldVal} ${isInc ? '+' : '-'} 1) ➔ ${newVal}`,
    });
  } else if (expr.type === 'CallExpression') {
    if (ctx.inputManager.isPromptCall(expr)) {
      const promptMsg = ctx.inputManager.extractPromptText(expr);
      const providedValue = ctx.inputManager.consumeNextInput();

      if (providedValue !== null) {
        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${promptMsg}`,
          needsInput: false,
          inputVarName: 'datos',
          inputPromptText: promptMsg,
        });
      } else {
        ctx.stepFactory.emitStep({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${promptMsg}`,
          needsInput: true,
          inputVarName: 'datos',
          inputPromptText: promptMsg,
        });
      }
    } else if (ctx.functionsMap.has(expr.callee?.name)) {
      invokeFunctionCall(expr, targetNodeId, nodesMap, {
        scopeManager: ctx.scopeManager,
        stepFactory: ctx.stepFactory,
        functionsMap: ctx.functionsMap,
        evaluator: ctx.evaluator,
        simulationContext: ctx.simulationContext,
        insideFunction: ctx.insideFunction,
        lastReturnValue: ctx.lastReturnValue,
        returnSignal: ctx.returnSignal,
        evaluateStatements: (stmts, map) => evaluateStatements(stmts, map, ctx),
      });
    } else {
      const callee = expr.callee?.property?.name || expr.callee?.name || '';
      ctx.evaluator.evaluate(expr, ctx.simulationContext, nodesMap, targetNodeId, line);

      ctx.stepFactory.emitStep({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `E/S Ejecución de Subrutina nativa: ${callee}()`,
      });
    }
  }
};

const handleIf: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const condVal = Boolean(ctx.evaluator.evaluate(stmt.test, ctx.simulationContext, nodesMap, targetNodeId, line));
  const condText = ctx.evaluator.formatConditionText(stmt.test, ctx.simulationContext);

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `ALU Evaluación Lógica: ¿${condText}? ➔ Resultado: ${
      condVal ? 'VERDADERO (Sí)' : 'FALSO (No)'
    }`,
  });

  if (condVal && stmt.consequent) {
    const body = stmt.consequent.type === 'BlockStatement' ? stmt.consequent.body : [stmt.consequent];
    ctx.scopeManager.pushScope('Bloque If');
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();
  } else if (!condVal && stmt.alternate) {
    const body = stmt.alternate.type === 'BlockStatement' ? stmt.alternate.body : [stmt.alternate];
    ctx.scopeManager.pushScope('Bloque Else');
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();
  }
};

const handleForWhile: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const isFor = stmt.type === 'ForStatement';

  if (isFor) {
    ctx.scopeManager.pushScope('Ámbito de Bucle For');
    if (stmt.init) {
      evaluateStatement(stmt.init, nodesMap, ctx);
    }
  }

  let loopCount = 0;

  while (loopCount < ctx.maxLoopIterations) {
    const condVal = stmt.test
      ? Boolean(ctx.evaluator.evaluate(stmt.test, ctx.simulationContext, nodesMap, targetNodeId, line))
      : true;

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Condición de Bucle (Iteración #${loopCount + 1}): ¿Continuar? ➔ ${
        condVal ? 'SÍ (Repetir)' : 'NO (Salir)'
      }`,
    });

    if (!condVal) break;

    const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    ctx.scopeManager.pushScope(`Bloque (Iteración #${loopCount + 1})`);
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();

    if (ctx.returnSignal?.value) {
      break;
    }
    if (ctx.breakSignal.value) {
      ctx.breakSignal.value = false;
      break;
    }
    if (ctx.continueSignal.value) {
      ctx.continueSignal.value = false;
    }

    if (stmt.update) {
      ctx.evaluator.evaluate(stmt.update, ctx.simulationContext, nodesMap, targetNodeId, line);
    }

    loopCount++;
  }

  if (loopCount >= ctx.maxLoopIterations) {
    const condDesc = stmt.test ? ctx.evaluator.formatConditionText(stmt.test, ctx.simulationContext) : 'true';
    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `⚠️ Límite de ${ctx.maxLoopIterations} iteraciones alcanzado (Posible ciclo infinito en condición: ${condDesc})`,
      outputLog: `⚠️ Advertencia: Se detuvo el bucle tras ${ctx.maxLoopIterations} iteraciones para evitar bloqueo.`,
    });
  }

  if (isFor) {
    ctx.scopeManager.popScope();
  }
};

const handleDoWhile: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  let loopCount = 0;
  let condVal = true;

  do {
    const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    ctx.scopeManager.pushScope(`Bloque Do-While (Iteración #${loopCount + 1})`);
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();

    if (ctx.returnSignal?.value) {
      break;
    }
    if (ctx.breakSignal.value) {
      ctx.breakSignal.value = false;
      break;
    }
    if (ctx.continueSignal.value) {
      ctx.continueSignal.value = false;
    }

    condVal = stmt.test
      ? Boolean(ctx.evaluator.evaluate(stmt.test, ctx.simulationContext, nodesMap, targetNodeId, line))
      : true;

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Condición de Do...While (Iteración #${loopCount + 1}): ¿Continuar? ➔ ${
        condVal ? 'SÍ (Repetir)' : 'NO (Salir)'
      }`,
    });

    loopCount++;
  } while (condVal && loopCount < ctx.maxLoopIterations);

  if (condVal && loopCount >= ctx.maxLoopIterations) {
    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `⚠️ Límite de ${ctx.maxLoopIterations} iteraciones alcanzado en Do...While`,
      outputLog: `⚠️ Advertencia: Se detuvo el bucle Do...While tras ${ctx.maxLoopIterations} iteraciones.`,
    });
  }
};

const handleSwitch: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const discriminantVal = ctx.evaluator.evaluate(stmt.discriminant, ctx.simulationContext, nodesMap, targetNodeId, line);

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `ALU Evaluación: Según (${JSON.stringify(discriminantVal)}) ...`,
  });

  let matched = false;
  let fellThrough = false;

  if (Array.isArray(stmt.cases)) {
    for (const caseClause of stmt.cases) {
      const caseLine = caseClause.loc?.start?.line || line;
      const caseNodeId = ctx.stepFactory.resolveNodeId(caseLine, nodesMap, ctx.insideFunction.value);

      if (!matched && !fellThrough) {
        if (caseClause.test) {
          const caseVal = ctx.evaluator.evaluate(caseClause.test, ctx.simulationContext, nodesMap, caseNodeId, caseLine);
          const isMatch = discriminantVal === caseVal;

          ctx.stepFactory.emitStep({
            activeNodeId: caseNodeId,
            codeLine: caseLine,
            cpuOperation: `ALU Comparar: ${JSON.stringify(discriminantVal)} === ${JSON.stringify(
              caseVal
            )} ➔ ${isMatch ? 'COINCIDE' : 'No coincide'}`,
          });

          if (!isMatch) continue;
          matched = true;
        } else {
          matched = true;
          ctx.stepFactory.emitStep({
            activeNodeId: caseNodeId,
            codeLine: caseLine,
            cpuOperation: 'ALU Caso Por Defecto (default) ➔ Ejecutar',
          });
        }
      }

      if (matched || fellThrough) {
        if (Array.isArray(caseClause.consequent)) {
          ctx.scopeManager.pushScope('Bloque Switch Case');
          evaluateStatements(caseClause.consequent, nodesMap, ctx);
          ctx.scopeManager.popScope();
        }

        if (ctx.returnSignal?.value || ctx.continueSignal.value) {
          break;
        }
        if (ctx.breakSignal.value) {
          ctx.breakSignal.value = false;
          break;
        }
        fellThrough = true;
      }
    }
  }
};

const handleForIn: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const objVal = ctx.evaluator.evaluate(stmt.right, ctx.simulationContext, nodesMap, targetNodeId, line);
  const varName = stmt.left?.declarations?.[0]?.id?.name || stmt.left?.name || 'key';
  const keys = objVal != null ? Object.keys(objVal) : [];

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `ALU Bucle For...In: Iterar propiedades de ${stmt.right?.name || 'objeto'} (${
      keys.length
    } propiedades)`,
  });

  let loopCount = 0;
  for (const key of keys) {
    if (loopCount >= ctx.maxLoopIterations) break;
    ctx.scopeManager.declareVariable(varName, key);

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Iteración #${loopCount + 1}: ${varName} = "${key}"`,
    });

    const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    ctx.scopeManager.pushScope(`Bloque For-In (Iteración #${loopCount + 1})`);
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();

    if (ctx.returnSignal?.value) {
      break;
    }
    if (ctx.breakSignal.value) {
      ctx.breakSignal.value = false;
      break;
    }
    if (ctx.continueSignal.value) {
      ctx.continueSignal.value = false;
    }
    loopCount++;
  }
};

const handleForOf: StatementHandler = (stmt, nodesMap, ctx) => {
  const line = stmt.loc?.start?.line || 1;
  const targetNodeId = ctx.stepFactory.resolveNodeId(line, nodesMap, ctx.insideFunction.value);
  const iterableVal = ctx.evaluator.evaluate(stmt.right, ctx.simulationContext, nodesMap, targetNodeId, line);
  const varName = stmt.left?.declarations?.[0]?.id?.name || stmt.left?.name || 'item';
  const items = Array.isArray(iterableVal)
    ? iterableVal
    : typeof iterableVal === 'string'
    ? [...iterableVal]
    : [];

  ctx.stepFactory.emitStep({
    activeNodeId: targetNodeId,
    codeLine: line,
    cpuOperation: `ALU Bucle For...Of: Iterar elementos de ${stmt.right?.name || 'iterable'} (${
      items.length
    } elementos)`,
  });

  let loopCount = 0;
  for (const item of items) {
    if (loopCount >= ctx.maxLoopIterations) break;
    ctx.scopeManager.declareVariable(varName, item);

    ctx.stepFactory.emitStep({
      activeNodeId: targetNodeId,
      codeLine: line,
      cpuOperation: `ALU Iteración #${loopCount + 1}: ${varName} = ${JSON.stringify(item)}`,
    });

    const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    ctx.scopeManager.pushScope(`Bloque For-Of (Iteración #${loopCount + 1})`);
    evaluateStatements(body, nodesMap, ctx);
    ctx.scopeManager.popScope();

    if (ctx.returnSignal?.value) {
      break;
    }
    if (ctx.breakSignal.value) {
      ctx.breakSignal.value = false;
      break;
    }
    if (ctx.continueSignal.value) {
      ctx.continueSignal.value = false;
    }
    loopCount++;
  }
};

const statementHandlers: Record<string, StatementHandler> = {
  ImportDeclaration: handleImport,
  FunctionDeclaration: () => {}, // Se omite en el flujo principal (se ejecuta vía hoisting o llamadas)
  BreakStatement: handleBreak,
  ContinueStatement: handleContinue,
  ReturnStatement: handleReturn,
  VariableDeclaration: handleVariableDecl,
  ExpressionStatement: handleExpression,
  IfStatement: handleIf,
  ForStatement: handleForWhile,
  WhileStatement: handleForWhile,
  DoWhileStatement: handleDoWhile,
  SwitchStatement: handleSwitch,
  ForInStatement: handleForIn,
  ForOfStatement: handleForOf,
};
