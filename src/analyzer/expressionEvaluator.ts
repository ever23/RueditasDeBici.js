import { ISimulationContext } from '../shared/types';

/**
 * Clase encargada de resolver matemáticamente o lógicamente cualquier expresión
 * detectada en el AST. Lee los valores actuales desde la Memoria RAM.
 */
export class ExpressionEvaluator {
  /**
   * Formatea visualmente una condición para mostrarla en la UI del Procesador (ALU).
   * Por ejemplo, si x = 5, transforma "x > 3" en "x(5) > 3".
   */
  public formatConditionText(test: any, context: ISimulationContext): string {
    if (!test) return '?';
    const memory = context.getMemory();

    if (test.type === 'LogicalExpression') {
      return `${this.formatConditionText(test.left, context)} ${test.operator} ${this.formatConditionText(test.right, context)}`;
    }

    if (test.type === 'UnaryExpression' && test.operator === '!') {
      return `!${this.formatConditionText(test.argument, context)}`;
    }

    if (test.type === 'Identifier') {
      return `${test.name}(${JSON.stringify(memory[test.name])})`;
    }

    const left = test.left?.name || (test.left?.type === 'Literal' ? JSON.stringify(test.left.value) : '...');
    const op = test.operator || '==';
    const right = this.formatCondRight(test.right);
    
    const leftVal = test.left?.type === 'Identifier' ? memory[test.left.name] : left;
    const rightVal = test.right?.type === 'Identifier' ? memory[test.right.name] : right;

    return `${left}(${JSON.stringify(leftVal)}) ${op} ${rightVal}`;
  }

  public formatCondRight(node: any): string {
    if (!node) return '0';
    if (node.type === 'Literal') return JSON.stringify(node.value);
    if (node.type === 'Identifier') return node.name;
    return '...';
  }

  /**
   * Evalúa recursivamente un nodo de expresión del AST y devuelve su valor computado.
   * Por ejemplo: evalúa `2 + 2` y devuelve `4`.
   * 
   * @param expr El nodo de expresión a evaluar.
   * @param context El contexto de simulación (acceso a memoria y funciones).
   * @param nodesMap (Opcional) Mapa para buscar IDs de nodos visuales vinculados.
   * @param activeNodeId (Opcional) ID del nodo activo actual.
   * @param codeLine (Opcional) Línea de código actual.
   * @returns El valor resultante de la evaluación (número, string, booleano, array, objeto, etc).
   */
  public evaluate(expr: any, context: ISimulationContext, nodesMap?: Map<string, string>, activeNodeId?: string, codeLine?: number): any {
    if (!expr) return 0;
    const memory = context.getMemory();

    if (expr.type === 'ChainExpression') {
      return this.evaluate(expr.expression, context, nodesMap, activeNodeId, codeLine);
    }

    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'Identifier') {
      if (expr.name === 'undefined') return undefined;
      if (expr.name === 'NaN') return NaN;
      if (expr.name === 'Infinity') return Infinity;
      if (memory[expr.name] !== undefined) return memory[expr.name];
      if (expr.name === 'Math') return Math;
      if (expr.name === 'Date') return Date;
      if (expr.name === 'JSON') return JSON;
      if (expr.name === 'Number') return Number;
      if (expr.name === 'String') return String;
      if (expr.name === 'Boolean') return Boolean;
      if (expr.name === 'Array') return Array;
      if (expr.name === 'Object') return Object;
      if (expr.name === 'parseInt') return parseInt;
      if (expr.name === 'parseFloat') return parseFloat;
      if (expr.name === 'isNaN') return isNaN;
      return 0;
    }

    if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
      const fn = (...args: any[]) => {
        const params = expr.params || [];
        if (context.pushScope && context.popScope) {
          context.pushScope('Callback');
          try {
            params.forEach((p: any, idx: number) => {
              if (p?.name) context.declareVariable(p.name, args[idx]);
            });
            if (expr.body?.type === 'BlockStatement' && Array.isArray(expr.body.body)) {
              for (const s of expr.body.body) {
                if (s.type === 'ReturnStatement') {
                  return s.argument ? this.evaluate(s.argument, context, nodesMap, activeNodeId, codeLine) : undefined;
                }
                if (s.type === 'ExpressionStatement') {
                  this.evaluate(s.expression, context, nodesMap, activeNodeId, codeLine);
                }
              }
              return undefined;
            }
            return this.evaluate(expr.body, context, nodesMap, activeNodeId, codeLine);
          } finally {
            context.popScope();
          }
        }
        return undefined;
      };
      Object.defineProperty(fn, 'toString', { value: () => '[Función]' });
      return fn;
    }

    if (expr.type === 'ArrayExpression') {
      return (expr.elements || []).map((e: any) => this.evaluate(e, context, nodesMap, activeNodeId, codeLine));
    }

    if (expr.type === 'ObjectExpression') {
      const obj: Record<string, any> = {};
      (expr.properties || []).forEach((prop: any) => {
        if (prop.type === 'Property') {
          const key = prop.key?.name || prop.key?.value;
          if (key != null) {
            obj[key] = this.evaluate(prop.value, context, nodesMap, activeNodeId, codeLine);
          }
        }
      });
      return obj;
    }

    if (expr.type === 'TemplateLiteral') {
      let result = '';
      const quasis = expr.quasis || [];
      const expressions = expr.expressions || [];
      for (let i = 0; i < quasis.length; i++) {
        result += quasis[i].value?.cooked || '';
        if (i < expressions.length) {
          result += String(this.evaluate(expressions[i], context, nodesMap, activeNodeId, codeLine));
        }
      }
      return result;
    }

    if (expr.type === 'MemberExpression') {
      const objVal = this.evaluate(expr.object, context, nodesMap, activeNodeId, codeLine);
      if (objVal == null) return undefined;
      const propName = expr.computed
        ? this.evaluate(expr.property, context, nodesMap, activeNodeId, codeLine)
        : expr.property?.name;
      if (propName != null) {
        const val = objVal[propName];
        if (typeof val === 'function') {
          return val.bind(objVal);
        }
        return val;
      }
      return undefined;
    }

    if (expr.type === 'UnaryExpression') {
      const argVal = this.evaluate(expr.argument, context, nodesMap, activeNodeId, codeLine);
      if (expr.operator === '!') return !argVal;
      if (expr.operator === 'typeof') return typeof argVal;
      if (expr.operator === '-') return -argVal;
      if (expr.operator === '+') return +argVal;
      return argVal;
    }

    if (expr.type === 'ConditionalExpression') {
      const testVal = this.evaluate(expr.test, context, nodesMap, activeNodeId, codeLine);
      return testVal
        ? this.evaluate(expr.consequent, context, nodesMap, activeNodeId, codeLine)
        : this.evaluate(expr.alternate, context, nodesMap, activeNodeId, codeLine);
    }

    if (expr.type === 'LogicalExpression') {
      const left = this.evaluate(expr.left, context, nodesMap, activeNodeId, codeLine);
      if (expr.operator === '&&') return left ? this.evaluate(expr.right, context, nodesMap, activeNodeId, codeLine) : left;
      if (expr.operator === '||') return left ? left : this.evaluate(expr.right, context, nodesMap, activeNodeId, codeLine);
      if (expr.operator === '??') return left !== null && left !== undefined ? left : this.evaluate(expr.right, context, nodesMap, activeNodeId, codeLine);
    }

    if (expr.type === 'CallExpression') {
      if (expr.callee?.type === 'Identifier' && context.getFunctionsMap().has(expr.callee.name) && nodesMap) {
        return context.invokeFunctionCall(expr, activeNodeId || `node_${expr.loc?.start?.line || 1}`, nodesMap);
      }

      const calleeObj = expr.callee?.type === 'MemberExpression' || expr.callee?.type === 'Identifier' 
        ? this.evaluate(expr.callee, context, nodesMap, activeNodeId, codeLine) 
        : null;

      if (typeof calleeObj === 'function') {
        const args = (expr.arguments || []).map((arg: any) => this.evaluate(arg, context, nodesMap, activeNodeId, codeLine));
        const res = calleeObj(...args);
        
        if (activeNodeId) {
          const funcName = expr.callee?.property?.name || expr.callee?.name || 'nativa';
          context.pushStep({
            activeNodeId,
            codeLine: codeLine || 1,
            cpuOperation: `ALU Función nativa: ${funcName}() ➔ Retornó: ${JSON.stringify(res)}`,
            memory: { ...context.getMemory() },
          });
        }
        
        return res;
      }
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evaluate(expr.left, context, nodesMap, activeNodeId, codeLine);
      const right = this.evaluate(expr.right, context, nodesMap, activeNodeId, codeLine);

      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '**': return Math.pow(left, right);
        case '/': return right !== 0 ? left / right : 0;
        case '%': return right !== 0 ? left % right : 0;
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': case '===': return left === right;
        case '!=': case '!==': return left !== right;
      }
    }

    if (expr.type === 'UpdateExpression') {
      const name = expr.argument?.name;
      if (name) {
        const oldVal = Number(memory[name] || 0);
        const newVal = expr.operator === '++' ? oldVal + 1 : oldVal - 1;
        context.updateVariable(name, newVal);
        return newVal;
      }
    }

    return 0;
  }
}
