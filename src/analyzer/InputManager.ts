/**
 * Gestor de Entradas de Usuario (Consola/Prompt).
 * Encapsula la cola de inputs simulados y la detección/desenvolvimiento
 * de expresiones de lectura de datos mediante librerías como prompt-sync.
 */
export class InputManager {
  private inputQueue: string[] = [];
  private inputIndex: number = 0;
  private promptVars: Set<string> = new Set(['prompt', 'leer']);

  constructor(providedInputs: string[] = []) {
    this.reset(providedInputs);
  }

  /**
   * Reinicia la cola de entrada con los nuevos datos provistos.
   */
  public reset(providedInputs: string[] = [], initialPromptVars?: Set<string>): void {
    this.inputQueue = [...providedInputs];
    this.inputIndex = 0;
    this.promptVars = initialPromptVars
      ? new Set(initialPromptVars)
      : new Set(['prompt', 'leer']);
  }

  public addPromptVar(name: string): void {
    this.promptVars.add(name);
  }

  public getPromptVars(): Set<string> {
    return this.promptVars;
  }

  /**
   * Consume y avanza al siguiente elemento de la cola de inputs,
   * o retorna null si la cola se ha agotado.
   */
  public consumeNextInput(): string | null {
    if (this.inputIndex < this.inputQueue.length) {
      return this.inputQueue[this.inputIndex++];
    }
    return null;
  }

  /**
   * Desenvuelve recursivamente llamadas de conversión numérica (parseInt, parseFloat, Number, String)
   * y accesos de miembros hasta encontrar la llamada raíz.
   */
  public unwrapExpression(expr: any): any {
    if (!expr) return null;
    if (expr.type === 'CallExpression') {
      const callee = expr.callee;
      if (
        (callee?.name === 'parseInt' ||
          callee?.name === 'parseFloat' ||
          callee?.name === 'Number' ||
          callee?.name === 'String') &&
        expr.arguments &&
        expr.arguments[0]
      ) {
        return this.unwrapExpression(expr.arguments[0]);
      }
      if (callee?.type === 'MemberExpression' && callee.object) {
        return this.unwrapExpression(callee.object);
      }
      return expr;
    }
    return expr;
  }

  /**
   * Verifica si una declaración de variable corresponde a la inicialización de prompt-sync.
   */
  public isPromptRequireDecl(decl: any): boolean {
    if (!decl || !decl.init || decl.init.type !== 'CallExpression') return false;
    const callee = decl.init.callee;
    if (callee?.name === 'PromptSync') return true;
    if (callee?.type === 'CallExpression' && callee.callee?.name === 'require') return true;
    return false;
  }

  /**
   * Determina si una expresión representa una invocación activa de lectura (prompt).
   */
  public isPromptCall(expr: any): boolean {
    const root = this.unwrapExpression(expr);
    if (!root || root.type !== 'CallExpression') return false;
    const name = root.callee?.name;
    return !!name && this.promptVars.has(name);
  }

  /**
   * Extrae el texto del prompt pasado como argumento, evaluándolo si es necesario.
   */
  public extractPromptText(expr: any, evalFn?: (arg: any) => any): string {
    const root = this.unwrapExpression(expr);
    if (!root || root.type !== 'CallExpression') return 'Ingrese dato:';
    const firstArg = root.arguments?.[0];
    if (firstArg) {
      if (evalFn) {
        const val = evalFn(firstArg);
        return val != null ? String(val) : 'Ingrese dato:';
      }
      if (firstArg.type === 'Literal') {
        return String(firstArg.value);
      }
    }
    return 'Ingrese dato:';
  }

  /**
   * Determina si la expresión original envuelve el prompt con una conversión numérica inmediata.
   */
  public wrapsNumericConversion(expr: any): boolean {
    if (!expr || expr.type !== 'CallExpression') return false;
    const name = expr.callee?.name;
    return name === 'parseInt' || name === 'parseFloat' || name === 'Number';
  }
}
