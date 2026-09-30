import { FlowchartNodeType } from '../shared/types';
import { isPromptCall } from './promptDetector';


/**
 * Formatea un literal, identificador o template literal a texto legible.
 * Usado principalmente para argumentos simples.
 */
export function formatLiteralOrId(node: any): string {
  if (!node) return '';
  if (node.type === 'Literal') return JSON.stringify(node.value);
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'TemplateLiteral') return formatExpr(node);
  return '...';
}

/**
 * Convierte un nodo AST de expresión a su representación en texto legible.
 * Soporta identificadores, literales, template literals, member expressions,
 * operaciones binarias, llamadas a funciones, actualizaciones, asignaciones,
 * destructuring de objetos/arreglos y rest elements.
 */
export function formatExpr(node: any): string {
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

/**
 * Inspecciona una expresión y retorna su etiqueta semántica y tipo de nodo
 * para el diagrama de flujo.
 * 
 * Ejemplos de transformaciones:
 * - `i++` → "Contador: i = i + 1" (process)
 * - `total += 5` → "Acumulador: total = total + 5" (process)
 * - `x = prompt("dato")` → "Leer: x" (input)
 * - `console.log(x)` → "Escribir: x" (output)
 * - `miFuncion()` → "Llamada: miFuncion()" (subroutine)
 * 
 * @param expr El nodo AST de la expresión a inspeccionar.
 * @param promptVars Conjunto de nombres de variables que son instancias de prompt-sync.
 * @param isPromptCall Función que determina si una expresión es una llamada a prompt.
 * @returns Objeto con label y type, o null si no es una expresión reconocida.
 */
export function inspectExpression(
  expr: any,
  promptVars: Set<string>
): { label: string; type: FlowchartNodeType } | null {
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
    
    if (isPromptCall(expr.right, promptVars)) {
      return { label: `Leer: ${targetVar}`, type: 'input' };
    }

    if (expr.right?.type === 'CallExpression') {
      const funcName = formatExpr(expr.right.callee);
      if (funcName && !promptVars.has(funcName) && funcName !== 'parseInt' && funcName !== 'parseFloat') {
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

    if (isPromptCall(expr, promptVars)) {
      return { label: `Leer: datos`, type: 'input' };
    }

    const funcName = formatExpr(expr.callee);
    return { label: `Llamada: ${funcName}()`, type: 'subroutine' };
  }

  return null;
}
