import { ISimulationContext } from '../shared/types';
import { ScopeManager } from './ScopeManager';
import { StepFactory } from './stepFactory';
import { ExpressionEvaluator } from './expressionEvaluator';

export interface InvokerContext {
  scopeManager: ScopeManager;
  stepFactory: StepFactory;
  functionsMap: Map<string, any>;
  evaluator: ExpressionEvaluator;
  simulationContext: ISimulationContext;
  insideFunction: { value: boolean };
  lastReturnValue: { value: any };
  returnSignal?: { value: boolean };
  evaluateStatements: (statements: any[], nodesMap: Map<string, string>) => void;
}

/**
 * Invoca una función registrada en el mapa de funciones:
 * 1. Genera un paso de salto en la llamada (diagrama principal).
 * 2. Apila el nuevo ámbito en el call stack y asigna argumentos a parámetros.
 * 3. Activa el contexto visual de la función (mini-diagrama).
 * 4. Evalúa las sentencias del cuerpo paso a paso.
 * 5. Genera el paso de fin de subrutina, desapila el ámbito y retorna al flujo llamador.
 */
export function invokeFunctionCall(
  callExpr: any,
  callerNodeId: string,
  nodesMap: Map<string, string>,
  ctx: InvokerContext
): any {
  const funcName = callExpr.callee?.name;
  const funcDecl = ctx.functionsMap.get(funcName);
  if (!funcDecl) return 0;

  const callerLine = callExpr.loc?.start?.line || 1;
  const funcStartLine = funcDecl.loc?.start?.line || 1;
  const funcEndLine = funcDecl.loc?.end?.line || funcStartLine;

  const argsValues = (callExpr.arguments || []).map((arg: any) =>
    ctx.evaluator.evaluate(arg, ctx.simulationContext, nodesMap, callerNodeId, callerLine)
  );

  // 1. Paso en la llamada (diagrama principal) — nodo del flujo principal
  ctx.stepFactory.emitStep({
    activeNodeId: callerNodeId,
    codeLine: callerLine,
    cpuOperation: `SALTO DE CONTROL ➜ Invocando Subrutina ${funcName}(${argsValues
      .map((v: any) => JSON.stringify(v))
      .join(', ')})`,
  });

  ctx.scopeManager.pushScope(funcName);

  // 2. Mapear parámetros a la memoria RAM
  const params = funcDecl.params || [];
  params.forEach((param: any, i: number) => {
    const paramName = param.name;
    if (paramName) {
      ctx.scopeManager.declareVariable(
        paramName,
        argsValues[i] !== undefined ? argsValues[i] : undefined
      );
    }
  });

  // 3. Activar modo función — resolveNodeId usará 'func:LINE'
  const prevInsideFunction = ctx.insideFunction.value;
  const prevReturnValue = ctx.lastReturnValue.value;
  const prevReturnSignal = ctx.returnSignal ? ctx.returnSignal.value : false;
  ctx.insideFunction.value = true;
  ctx.lastReturnValue.value = undefined;
  if (ctx.returnSignal) {
    ctx.returnSignal.value = false;
  }

  // Paso visual: Inicio de la función (nodo func_start en el mini-diagrama)
  const funcStartNodeId = ctx.stepFactory.resolveNodeId(funcStartLine, nodesMap, true);
  ctx.stepFactory.emitStep({
    activeNodeId: funcStartNodeId,
    codeLine: funcStartLine,
    cpuOperation: `📦 ENTRADA A SUBRUTINA: ${funcName}(${params
      .map((p: any) => `${p.name}=${JSON.stringify(ctx.scopeManager.getMemory()[p.name])}`)
      .join(', ')})`,
  });

  // 4. Evaluar el cuerpo de la función paso a paso en su mini-diagrama
  if (funcDecl.body && Array.isArray(funcDecl.body.body)) {
    ctx.evaluateStatements(funcDecl.body.body, nodesMap);
  } else if (funcDecl.body) {
    ctx.lastReturnValue.value = ctx.evaluator.evaluate(
      funcDecl.body,
      ctx.simulationContext,
      nodesMap,
      funcStartNodeId,
      funcStartLine
    );
  }

  const retVal = ctx.lastReturnValue.value;

  // Paso visual: Fin de la función (nodo func_end en el mini-diagrama)
  const funcEndNodeId = ctx.stepFactory.resolveNodeId(funcEndLine, nodesMap, true);
  ctx.stepFactory.emitStep({
    activeNodeId: funcEndNodeId,
    codeLine: funcEndLine,
    cpuOperation: `📦 FIN SUBRUTINA: ${funcName}() ➜ Retornó: ${JSON.stringify(retVal)}`,
  });

  ctx.scopeManager.popScope();

  // 5. Restaurar modo y estado de retorno previo (soporta recursión y llamadas anidadas)
  ctx.insideFunction.value = prevInsideFunction;
  ctx.lastReturnValue.value = prevReturnValue;
  if (ctx.returnSignal) {
    ctx.returnSignal.value = prevReturnSignal;
  }

  ctx.stepFactory.emitStep({
    activeNodeId: callerNodeId,
    codeLine: callerLine,
    cpuOperation: `RETORNO DE SUBRUTINA ➜ ${funcName}() completado ➜ Valor: ${JSON.stringify(retVal)}`,
  });

  return retVal;
}
