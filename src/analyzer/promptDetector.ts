/**
 * Módulo de detección de prompts y lecturas de entrada del usuario en el AST.
 * Identifica llamadas a librerías como prompt-sync, wrappers comunes (prompt, leer)
 * y llamadas anidadas (parseInt, parseFloat, etc.).
 */

/**
 * Escanea el AST para detectar variables asignadas a `prompt-sync` o imports equivalentes.
 * Por defecto incluye 'prompt' y 'leer' como nombres estándar.
 * 
 * @param ast Nodo raíz del AST
 * @returns Conjunto con los nombres de variables que actúan como funciones de prompt
 */
export function scanForPromptVars(ast: any): Set<string> {
  const promptVars = new Set<string>(['prompt', 'leer']);

  const scan = (node: any) => {
    if (!node) return;
    if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
      if (node.init.type === 'CallExpression') {
        const callee = node.init.callee;
        if (callee?.name === 'PromptSync') {
          promptVars.add(node.id.name);
        } else if (callee?.type === 'CallExpression' && callee.callee?.name === 'require') {
          promptVars.add(node.id.name);
        }
      }
    }
    if (Array.isArray(node)) {
      node.forEach(scan);
    } else if (typeof node === 'object') {
      for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          scan(node[key]);
        }
      }
    }
  };

  scan(ast);
  return promptVars;
}

/**
 * Determina si una expresión AST representa una invocación de lectura (prompt).
 * Reconoce llamadas directas, transformaciones como parseInt(prompt(...)) y
 * accesos a miembros.
 * 
 * @param expr Nodo AST de expresión
 * @param promptVars Conjunto de nombres de variables reconocidas como prompt
 */
export function isPromptCall(expr: any, promptVars: Set<string>): boolean {
  if (!expr) return false;

  if (expr.type === 'CallExpression') {
    const callee = expr.callee;
    if (callee?.name && promptVars.has(callee.name)) return true;

    if (
      (callee?.name === 'parseInt' || callee?.name === 'parseFloat') &&
      expr.arguments &&
      expr.arguments[0] &&
      isPromptCall(expr.arguments[0], promptVars)
    ) {
      return true;
    }

    if (callee?.type === 'MemberExpression') {
      return isPromptCall(callee.object, promptVars);
    }
  }

  return false;
}
