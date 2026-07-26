import * as acorn from 'acorn';

export function parseCode(source: string): acorn.Node | null {
  try {
    return acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
  } catch (error) {
    return null;
  }
}
