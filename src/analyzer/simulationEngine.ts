import { SimulationStepPayload } from '../shared/types';

export class SimulationEngine {
  private memory: Record<string, any> = {};
  private steps: SimulationStepPayload[] = [];
  private inputQueue: string[] = [];
  private inputIndex: number = 0;
  private functionsMap: Map<string, any> = new Map();
  private lastReturnValue: any = undefined;
  private _insideFunction: boolean = false;

  /** Resuelve el ID del nodo visual según si estamos dentro de una función o en el flujo principal */
  private resolveNodeId(line: number, nodesMap: Map<string, string>): string {
    if (this._insideFunction) {
      const funcNodeId = nodesMap.get(`func:${line}`);
      if (funcNodeId) return funcNodeId;
    }
    return nodesMap.get(String(line)) || `node_${line}`;
  }

  /**
   * Genera los pasos de simulación.
   * @param providedInputs - Valores de entrada conocidos del usuario.
   */
  public buildSimulationSteps(
    ast: any,
    nodesMap: Map<string, string>,
    providedInputs: string[] = []
  ): SimulationStepPayload[] {
    this.memory = {};
    this.steps = [];
    this.inputQueue = providedInputs;
    this.inputIndex = 0;
    this.functionsMap.clear();
    this.lastReturnValue = undefined;
    this._insideFunction = false;

    // 1. Escanear y mapear todas las declaraciones de funciones
    if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
      ast.body.forEach((stmt: any) => {
        if (stmt && stmt.type === 'FunctionDeclaration' && stmt.id?.name) {
          this.functionsMap.set(stmt.id.name, stmt);
        }
      });
    }

    this.steps.push({
      activeNodeId: 'start',
      codeLine: 1,
      cpuOperation: 'CPU Lista ➔ Inicializando Registro de Instrucciones',
      memory: { ...this.memory },
    });

    if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
      this.evaluateStatements(ast.body, nodesMap);
    }

    this.steps.push({
      activeNodeId: 'end',
      codeLine: ast?.loc?.end?.line || 1,
      cpuOperation: 'CPU Halt ➔ Ejecución de Programa Finalizada',
      memory: { ...this.memory },
    });

    return this.steps;
  }

  /** Revisa si una declaración es const prompt = require('prompt-sync')() */
  private isPromptRequireDecl(d: any): boolean {
    const name = d.id?.name;
    if (name !== 'prompt') return false;
    const init = d.init;
    if (!init) return false;
    if (init.type === 'CallExpression' && init.callee?.type === 'CallExpression') return true;
    if (init.type === 'CallExpression' && init.callee?.name === 'require') return true;
    return false;
  }

  /** Desenvuelve cadenas de métodos y conversiones hasta la llamada raíz */
  private unwrapExpression(expr: any): any {
    if (!expr) return null;
    if (expr.type === 'CallExpression') {
      const callee = expr.callee;
      if (
        (callee?.name === 'parseInt' || callee?.name === 'parseFloat' || callee?.name === 'Number' || callee?.name === 'String') &&
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

  private isPromptCall(expr: any): boolean {
    const root = this.unwrapExpression(expr);
    if (!root || root.type !== 'CallExpression') return false;
    const name = root.callee?.name;
    return name === 'prompt' || name === 'PromptSync' || name === 'leer';
  }

  private extractPromptText(expr: any): string {
    const root = this.unwrapExpression(expr);
    if (!root || root.type !== 'CallExpression') return 'Ingrese dato:';
    const firstArg = root.arguments?.[0];
    if (firstArg?.type === 'Literal') return String(firstArg.value);
    if (firstArg?.type === 'TemplateLiteral') return 'Ingrese datos:';
    return 'Ingrese dato:';
  }

  /** Detecta si la expresión envuelve parseInt/parseFloat/Number alrededor del prompt */
  private wrapsNumericConversion(expr: any): boolean {
    if (!expr || expr.type !== 'CallExpression') return false;
    const name = expr.callee?.name;
    return name === 'parseInt' || name === 'parseFloat' || name === 'Number';
  }

  /** Consume el siguiente input de la cola */
  private consumeNextInput(): string | null {
    if (this.inputIndex < this.inputQueue.length) {
      return this.inputQueue[this.inputIndex++];
    }
    return null;
  }

  private evaluateStatements(statements: any[], nodesMap: Map<string, string>) {
    for (const stmt of statements) {
      this.evaluateStatement(stmt, nodesMap);
    }
  }

  private evaluateStatement(stmt: any, nodesMap: Map<string, string>) {
    if (!stmt) return;
    const line = stmt.loc?.start?.line || 1;
    const targetNodeId = this.resolveNodeId(line, nodesMap);

    // Declaración de función (se omite en el flujo principal, pues se ejecuta al llamarse)
    if (stmt.type === 'FunctionDeclaration') return;

    // Retorno de Función (ReturnStatement)
    if (stmt.type === 'ReturnStatement') {
      const retVal = stmt.argument ? this.evalExpr(stmt.argument, nodesMap) : undefined;
      this.lastReturnValue = retVal;

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `CPU Retorno de Subrutina ➔ Valor devuelto: ${JSON.stringify(retVal)}`,
        memory: { ...this.memory },
      });
      return;
    }

    // Declaraciones de Variables (let/const/var)
    if (stmt.type === 'VariableDeclaration') {
      stmt.declarations.forEach((d: any) => {
        const name = d.id?.name || 'var';

        if (this.isPromptRequireDecl(d)) return;

        if (d.init && this.isPromptCall(d.init)) {
          const promptMsg = this.extractPromptText(d.init);
          const providedValue = this.consumeNextInput();

          if (providedValue !== null) {
            const isNumeric = this.wrapsNumericConversion(d.init);
            const parsedVal = isNumeric ? Number(providedValue) : providedValue;
            this.memory[name] = parsedVal;

            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: false,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: true,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          }
          return;
        }

        let val: any = 0;
        let opDesc = `Declarar variable: ${name}`;

        if (d.init) {
          if (d.init.type === 'Literal') {
            val = d.init.value;
            opDesc = `CPU Cargar constante ${val} ➔ Asignar a RAM [${name}]`;
          } else if (d.init.type === 'ArrayExpression') {
            val = [];
            opDesc = `CPU Asignar Arreglo [] ➔ RAM [${name}]`;
          } else if (d.init.type === 'CallExpression' && this.functionsMap.has(d.init.callee?.name)) {
            // Llamada a función en inicialización
            val = this.invokeFunctionCall(d.init, targetNodeId, nodesMap);
            opDesc = `CPU Asignar retorno de subrutina ${d.init.callee.name}() ➔ RAM [${name}] = ${JSON.stringify(val)}`;
          } else {
            val = this.evalExpr(d.init, nodesMap);
            opDesc = `CPU Evaluar Expresión ➔ RAM [${name}] = ${JSON.stringify(val)}`;
          }
        }

        this.memory[name] = val;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: opDesc,
          memory: { ...this.memory },
        });
      });
    }
    // Asignaciones / Expresiones
    else if (stmt.type === 'ExpressionStatement') {
      const expr = stmt.expression;

      // console.log(...)
      if (
        expr.type === 'CallExpression' &&
        expr.callee?.type === 'MemberExpression' &&
        expr.callee.object?.name === 'console' &&
        expr.callee.property?.name === 'log'
      ) {
        const printedText = expr.arguments.map((arg: any) => {
          if (arg.type === 'Literal') return String(arg.value);
          if (arg.type === 'Identifier') return String(this.memory[arg.name] ?? '');
          if (arg.type === 'BinaryExpression') return String(this.evalExpr(arg, nodesMap));
          if (arg.type === 'TemplateLiteral') {
            return arg.quasis.map((q: any, i: number) => {
              const txt = q.value.cooked || '';
              const exprVal = arg.expressions[i] ? String(this.evalExpr(arg.expressions[i], nodesMap)) : '';
              return txt + exprVal;
            }).join('');
          }
          return '...';
        }).join(' ');

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `E/S Imprimir en Consola (Escribir): "${printedText}"`,
          memory: { ...this.memory },
          outputLog: printedText,
        });
        return;
      }

      if (expr.type === 'AssignmentExpression') {
        const name = expr.left?.name || expr.left?.property?.name || 'var';

        if (this.isPromptCall(expr.right)) {
          const promptMsg = this.extractPromptText(expr.right);
          const providedValue = this.consumeNextInput();

          if (providedValue !== null) {
            const isNumeric = this.wrapsNumericConversion(expr.right);
            const parsedVal = isNumeric ? Number(providedValue) : providedValue;
            this.memory[name] = parsedVal;

            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: false,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: true,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          }
          return;
        }

        let val: any = 0;
        if (expr.right?.type === 'CallExpression' && this.functionsMap.has(expr.right.callee?.name)) {
          val = this.invokeFunctionCall(expr.right, targetNodeId, nodesMap);
        } else {
          val = this.evalExpr(expr.right, nodesMap);
        }

        this.memory[name] = val;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Cálculo: ${name} = ${JSON.stringify(val)} ➔ Guardar en RAM`,
          memory: { ...this.memory },
        });
      } else if (expr.type === 'UpdateExpression') {
        const name = expr.argument?.name || 'var';
        const isInc = expr.operator === '++';
        const oldVal = Number(this.memory[name] || 0);
        const newVal = isInc ? oldVal + 1 : oldVal - 1;
        this.memory[name] = newVal;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Contador: ${name} (${oldVal} ${isInc ? '+' : '-'} 1) ➔ ${newVal}`,
          memory: { ...this.memory },
        });
      } else if (expr.type === 'CallExpression') {
        if (this.isPromptCall(expr)) {
          const promptMsg = this.extractPromptText(expr);
          const providedValue = this.consumeNextInput();

          if (providedValue !== null) {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: false,
              inputVarName: 'datos',
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${promptMsg}`,
              memory: { ...this.memory },
              needsInput: true,
              inputVarName: 'datos',
              inputPromptText: promptMsg,
            });
          }
        } else if (this.functionsMap.has(expr.callee?.name)) {
          this.invokeFunctionCall(expr, targetNodeId, nodesMap);
        } else {
          const callee = expr.callee?.property?.name || expr.callee?.name || '';
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `E/S Ejecución de Subrutina: ${callee}()`,
            memory: { ...this.memory },
          });
        }
      }
    }
    // Condicional IF
    else if (stmt.type === 'IfStatement') {
      const condVal = Boolean(this.evalExpr(stmt.test, nodesMap));
      const condText = this.formatConditionText(stmt.test);

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `ALU Evaluación Lógica: ¿${condText}? ➔ Resultado: ${condVal ? 'VERDADERO (Sí)' : 'FALSO (No)'}`,
        memory: { ...this.memory },
      });

      if (condVal && stmt.consequent) {
        const body = stmt.consequent.type === 'BlockStatement' ? stmt.consequent.body : [stmt.consequent];
        this.evaluateStatements(body, nodesMap);
      } else if (!condVal && stmt.alternate) {
        const body = stmt.alternate.type === 'BlockStatement' ? stmt.alternate.body : [stmt.alternate];
        this.evaluateStatements(body, nodesMap);
      }
    }
    // Bucles FOR / WHILE
    else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement') {
      if (stmt.type === 'ForStatement' && stmt.init) {
        this.evaluateStatement(stmt.init, nodesMap);
      }

      let loopCount = 0;
      const MAX_SAFE_LOOPS = 10;

      while (loopCount < MAX_SAFE_LOOPS) {
        const condVal = stmt.test ? Boolean(this.evalExpr(stmt.test, nodesMap)) : true;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Condición de Bucle (Iteración #${loopCount + 1}): ¿Continuar? ➔ ${condVal ? 'SÍ (Repetir)' : 'NO (Salir)'}`,
          memory: { ...this.memory },
        });

        if (!condVal) break;

        const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        this.evaluateStatements(body, nodesMap);

        if (stmt.update) {
          this.evaluateExpr(stmt.update, nodesMap);
        }

        loopCount++;
      }
    }
  }

  /**
   * Invoca una función registrada:
   * 1. Salto de ejecución al mini-diagrama secundario de la función.
   * 2. Asignación de argumentos a parámetros en la memoria.
   * 3. Evaluación paso a paso dentro del mini-diagrama.
   * 4. Retorno de ejecución de vuelta al diagrama principal.
   */
  private invokeFunctionCall(callExpr: any, callerNodeId: string, nodesMap: Map<string, string>): any {
    const funcName = callExpr.callee?.name;
    const funcDecl = this.functionsMap.get(funcName);
    if (!funcDecl) return 0;

    const callerLine = callExpr.loc?.start?.line || 1;
    const funcStartLine = funcDecl.loc?.start?.line || 1;
    const funcEndLine = funcDecl.loc?.end?.line || funcStartLine;
    const argsValues = (callExpr.arguments || []).map((arg: any) => this.evalExpr(arg, nodesMap));

    // 1. Paso en la llamada (diagrama principal) — nodo del flujo principal
    this.steps.push({
      activeNodeId: callerNodeId,
      codeLine: callerLine,
      cpuOperation: `SALTO DE CONTROL ➜ Invocando Subrutina ${funcName}(${argsValues.map(v => JSON.stringify(v)).join(', ')})`,
      memory: { ...this.memory },
    });

    // 2. Mapear parámetros a la memoria RAM
    const params = funcDecl.params || [];
    params.forEach((param: any, i: number) => {
      const paramName = param.name;
      if (paramName) {
        this.memory[paramName] = argsValues[i] !== undefined ? argsValues[i] : 0;
      }
    });

    // 3. Activar modo función — resolveNodeId usará 'func:LINE'
    const prevInsideFunction = this._insideFunction;
    this._insideFunction = true;

    // Paso visual: Inicio de la función (nodo func_start en el mini-diagrama)
    const funcStartNodeId = this.resolveNodeId(funcStartLine, nodesMap);
    this.steps.push({
      activeNodeId: funcStartNodeId,
      codeLine: funcStartLine,
      cpuOperation: `📦 ENTRADA A SUBRUTINA: ${funcName}(${params.map((p: any) => `${p.name}=${JSON.stringify(this.memory[p.name])}`).join(', ')})`,
      memory: { ...this.memory },
    });

    // 4. Evaluar el cuerpo de la función paso a paso en su mini-diagrama
    this.lastReturnValue = undefined;
    if (funcDecl.body && Array.isArray(funcDecl.body.body)) {
      this.evaluateStatements(funcDecl.body.body, nodesMap);
    }

    const retVal = this.lastReturnValue;

    // Paso visual: Fin de la función (nodo func_end en el mini-diagrama)
    const funcEndNodeId = this.resolveNodeId(funcEndLine, nodesMap);
    this.steps.push({
      activeNodeId: funcEndNodeId,
      codeLine: funcEndLine,
      cpuOperation: `📦 FIN SUBRUTINA: ${funcName}() ➜ Retornó: ${JSON.stringify(retVal)}`,
      memory: { ...this.memory },
    });

    // 5. Restaurar modo y volver al diagrama principal
    this._insideFunction = prevInsideFunction;

    this.steps.push({
      activeNodeId: callerNodeId,
      codeLine: callerLine,
      cpuOperation: `RETORNO DE SUBRUTINA ➜ ${funcName}() completado ➜ Valor: ${JSON.stringify(retVal)}`,
      memory: { ...this.memory },
    });

    return retVal;
  }

  private formatConditionText(test: any): string {
    if (!test) return '?';
    const left = test.left?.name || (test.left?.type === 'Literal' ? JSON.stringify(test.left.value) : '...');
    const op = test.operator || '==';
    const right = this.formatCondRight(test.right);
    
    const leftVal = test.left?.type === 'Identifier' ? this.memory[test.left.name] : left;
    const rightVal = test.right?.type === 'Identifier' ? this.memory[test.right.name] : right;

    return `${left}(${JSON.stringify(leftVal)}) ${op} ${rightVal}`;
  }

  private formatCondRight(node: any): string {
    if (!node) return '0';
    if (node.type === 'Literal') return JSON.stringify(node.value);
    if (node.type === 'Identifier') return node.name;
    return '...';
  }

  private evalExpr(expr: any, nodesMap?: Map<string, string>): any {
    if (!expr) return 0;
    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'Identifier') return this.memory[expr.name] !== undefined ? this.memory[expr.name] : 0;
    if (expr.type === 'UnaryExpression' && expr.operator === '!') return !this.evalExpr(expr.argument, nodesMap);

    if (expr.type === 'LogicalExpression') {
      const left = this.evalExpr(expr.left, nodesMap);
      if (expr.operator === '&&') return left ? this.evalExpr(expr.right, nodesMap) : left;
      if (expr.operator === '||') return left ? left : this.evalExpr(expr.right, nodesMap);
    }

    if (expr.type === 'CallExpression') {
      if (expr.callee?.type === 'MemberExpression') {
        const objVal = String(this.evalExpr(expr.callee.object, nodesMap));
        if (expr.callee.property?.name === 'toLowerCase') return objVal.toLowerCase();
        if (expr.callee.property?.name === 'toUpperCase') return objVal.toUpperCase();
        if (expr.callee.property?.name === 'trim') return objVal.trim();
      } else if (this.functionsMap.has(expr.callee?.name) && nodesMap) {
        return this.invokeFunctionCall(expr, `node_${expr.loc?.start?.line || 1}`, nodesMap);
      }
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evalExpr(expr.left, nodesMap);
      const right = this.evalExpr(expr.right, nodesMap);

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
        const oldVal = Number(this.memory[name] || 0);
        const newVal = expr.operator === '++' ? oldVal + 1 : oldVal - 1;
        this.memory[name] = newVal;
        return newVal;
      }
    }

    return 0;
  }

  private evaluateExpr(expr: any, nodesMap?: Map<string, string>) {
    this.evalExpr(expr, nodesMap);
  }
}
