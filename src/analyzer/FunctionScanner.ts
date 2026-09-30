/**
 * Resultado del escaneo estático de funciones y librerías en el AST.
 */
export interface ScanFunctionsResult {
  /** Mapa de funciones registradas por nombre (FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) */
  functionsMap: Map<string, any>;
  /** Lista ordenada de nodos FunctionDeclaration para el procesamiento de Hoisting */
  functionDeclarations: any[];
  /** Nombres de variables asignadas a librerías de teclado (prompt-sync) */
  promptVars: Set<string>;
}

/**
 * Escanea recursivamente el AST para registrar todas las funciones disponibles
 * y detectar variables asignadas a utilidades de entrada por teclado.
 * 
 * @param ast Nodo raíz del AST
 * @returns ScanFunctionsResult
 */
export function scanFunctions(ast: any): ScanFunctionsResult {
  const functionsMap = new Map<string, any>();
  const functionDeclarations: any[] = [];
  const promptVars = new Set<string>(['prompt', 'leer']);

  const scan = (node: any) => {
    if (!node) return;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      functionsMap.set(node.id.name, node);
      functionDeclarations.push(node);
    } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
      if (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') {
        functionsMap.set(node.id.name, node.init);
      } else if (node.init.type === 'CallExpression') {
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

  return {
    functionsMap,
    functionDeclarations,
    promptVars,
  };
}
