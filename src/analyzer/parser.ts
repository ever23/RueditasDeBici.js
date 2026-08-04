import * as acorn from 'acorn';

/**
 * Resultado exitoso al convertir el código fuente a AST.
 */
export interface ParseSuccess {
  ast: acorn.Node;
  error: null;
}

/**
 * Resultado de error al intentar convertir el código fuente (error de sintaxis).
 */
export interface ParseError {
  ast: null;
  error: string;
  line: number;
}

export type ParseResult = ParseSuccess | ParseError;

/**
 * Toma el código fuente JavaScript y utiliza Acorn para convertirlo en un Árbol de Sintaxis Abstracta (AST).
 * El AST es la estructura fundamental que los demás módulos usarán para analizar la lógica.
 * 
 * @param source El código fuente en texto plano escrito por el usuario.
 * @returns ParseResult Un objeto que contiene el AST o el mensaje de error de sintaxis y su línea.
 */
export function parseCode(source: string): ParseResult {
  try {
    const ast = acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
    return { ast, error: null };
  } catch (err: any) {
    const line = err.loc?.line || 1;
    const message = err.message || 'Error de sintaxis desconocido';
    return { ast: null, error: message, line };
  }
}
