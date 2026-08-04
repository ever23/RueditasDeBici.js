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

    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'Identifier') {
      if (memory[expr.name] !== undefined) return memory[expr.name];
      if (expr.name === 'Math') return Math;
      if (expr.name === 'Date') return Date;
      if (expr.name === 'JSON') return JSON;
      if (expr.name === 'Number') return Number;
      if (expr.name === 'String') return String;
      if (expr.name === 'Boolean') return Boolean;
      if (expr.name === 'parseInt') return parseInt;
      if (expr.name === 'parseFloat') return parseFloat;
      if (expr.name === 'isNaN') return isNaN;
      return 0;
    }

    if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
      return '[Función]';
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
          result += String(this.evaluate(expressions[i], context, nodesMap));
        }
      }
      return result;
    }

    if (expr.type === 'MemberExpression') {
      const objVal = this.evaluate(expr.object, context, nodesMap);
      const propName = expr.computed ? this.evaluate(expr.property, context, nodesMap) : expr.property?.name;
      if (objVal != null && propName != null) {
        const val = objVal[propName];
        if (typeof val === 'function') {
          return val.bind(objVal);
        }
        return val;
      }
      return undefined;
    }

    if (expr.type === 'UnaryExpression') {
      const argVal = this.evaluate(expr.argument, context, nodesMap);
      if (expr.operator === '!') return !argVal;
      if (expr.operator === 'typeof') return typeof argVal;
      if (expr.operator === '-') return -argVal;
      if (expr.operator === '+') return +argVal;
      return argVal;
    }

    if (expr.type === 'ConditionalExpression') {
      const testVal = this.evaluate(expr.test, context, nodesMap);
      return testVal ? this.evaluate(expr.consequent, context, nodesMap) : this.evaluate(expr.alternate, context, nodesMap);
    }

    if (expr.type === 'LogicalExpression') {
      const left = this.evaluate(expr.left, context, nodesMap);
      if (expr.operator === '&&') return left ? this.evaluate(expr.right, context, nodesMap) : left;
      if (expr.operator === '||') return left ? left : this.evaluate(expr.right, context, nodesMap);
    }

    if (expr.type === 'CallExpression') {
      const calleeObj = expr.callee?.type === 'MemberExpression' || expr.callee?.type === 'Identifier' 
        ? this.evaluate(expr.callee, context, nodesMap) 
        : null;

      if (typeof calleeObj === 'function') {
        const args = expr.arguments.map((arg: any) => this.evaluate(arg, context, nodesMap, activeNodeId, codeLine));
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
      } else if (context.getFunctionsMap().has(expr.callee?.name) && nodesMap) {
        return context.invokeFunctionCall(expr, `node_${expr.loc?.start?.line || 1}`, nodesMap);
      }
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evaluate(expr.left, context, nodesMap);
      const right = this.evaluate(expr.right, context, nodesMap);

      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
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
