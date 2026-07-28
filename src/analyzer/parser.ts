import * as acorn from 'acorn';

export interface ParseSuccess {
  ast: acorn.Node;
  error: null;
}

export interface ParseError {
  ast: null;
  error: string;
  line: number;
}

export type ParseResult = ParseSuccess | ParseError;

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
