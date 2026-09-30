import { ScopePayload } from '../shared/types';

/**
 * Gestor de Memoria RAM y Call Stack para la simulación.
 * Administra los ámbitos (scopes), visibilidad léxica de variables
 * y el aplanado de memoria para el visor en tiempo real.
 */
export class ScopeManager {
  private memory: Record<string, any> = {};
  private callStack: ScopePayload[] = [{ name: 'Global', variables: {} }];

  constructor() {
    this.reset();
  }

  /**
   * Reinicia la memoria y restablece el call stack únicamente con el ámbito Global.
   */
  public reset(): void {
    this.memory = {};
    this.callStack = [{ name: 'Global', variables: {} }];
  }

  /**
   * Retorna el estado actual de la memoria aplanada.
   */
  public getMemory(): Record<string, any> {
    return this.memory;
  }

  /**
   * Genera una copia profunda e inmutable del estado de la memoria actual.
   */
  public cloneMemory(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.memory));
  }

  /**
   * Retorna la referencia actual del call stack.
   */
  public getCallStack(): ScopePayload[] {
    return this.callStack;
  }

  /**
   * Genera una copia profunda e inmutable del call stack actual.
   */
  public cloneCallStack(): ScopePayload[] {
    return JSON.parse(JSON.stringify(this.callStack));
  }

  /**
   * Sincroniza la memoria global/activa combinando las variables
   * de cada ámbito en orden desde el Global hasta el más anidado.
   */
  private syncMemory(): void {
    this.memory = {};
    for (const scope of this.callStack) {
      Object.assign(this.memory, scope.variables);
    }
  }

  /**
   * Apila un nuevo ámbito de ejecución en el call stack.
   */
  public pushScope(name: string): void {
    this.callStack.push({ name, variables: {} });
  }

  /**
   * Desapila el ámbito actual, asegurando nunca remover el ámbito 'Global'.
   */
  public popScope(): void {
    if (this.callStack.length > 1) {
      this.callStack.pop();
      this.syncMemory();
    }
  }

  /**
   * Declara una variable en el ámbito más reciente (tope de la pila).
   */
  public declareVariable(key: string, value: any): void {
    if (this.callStack.length > 0) {
      this.callStack[this.callStack.length - 1].variables[key] = value;
    }
    this.syncMemory();
  }

  /**
   * Actualiza el valor de una variable buscando desde el ámbito más interno hacia el Global.
   * Si no existe en ningún ámbito, se asigna al ámbito Global por compatibilidad.
   */
  public updateVariable(key: string, value: any): void {
    let found = false;
    for (let i = this.callStack.length - 1; i >= 0; i--) {
      if (key in this.callStack[i].variables) {
        this.callStack[i].variables[key] = value;
        found = true;
        break;
      }
    }
    if (!found && this.callStack.length > 0) {
      this.callStack[0].variables[key] = value;
    }
    this.syncMemory();
  }
}
