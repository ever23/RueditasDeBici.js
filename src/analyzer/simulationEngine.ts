import { SimulationStepPayload } from '../shared/types';

export class SimulationEngine {
  private memory: Record<string, any> = {};
  private steps: SimulationStepPayload[] = [];
  private inputQueue: string[] = [];
  private inputIndex: number = 0;
  private functionsMap: Map<string, any> = new Map();
  private lastReturnValue: any = undefined;
  private _insideFunction: boolean = false;
  private _breakSignal: boolean = false;
  private _continueSignal: boolean = false;
  private _maxLoopIterations: number = 100;
  private promptVars: Set<string> = new Set(['prompt', 'leer']);

  public setMaxIterations(n: number) {
    this._maxLoopIterations = Math.max(1, Math.min(n, 10000));
  }

  /** Resuelve el ID del nodo visual según si estamos dentro de una función o en el flujo principal */
  private resolveNodeId(line: number, nodesMap: Map<string, string>): string {
    if (this._insideFunction) {
      const funcNodeId = nodesMap.get(`func:${line}`);
      if (funcNodeId) return funcNodeId;
    }
    return nodesMap.get(String(line)) || `hidden_${line}`;
  }

  private cloneMemory(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.memory));
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
    this.promptVars = new Set(['prompt', 'leer']);
    this.lastReturnValue = undefined;
    this._insideFunction = false;
    this._breakSignal = false;
    this._continueSignal = false;

    // 1. Escanear y mapear todas las funciones (declaraciones y expresiones asignadas)
    const scanFunctions = (node: any) => {
      if (!node) return;
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        this.functionsMap.set(node.id.name, node);
      } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
        if (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') {
          this.functionsMap.set(node.id.name, node.init);
        } else if (node.init.type === 'CallExpression' && (node.init.callee?.name === 'PromptSync' || node.init.callee?.name === 'require')) {
          this.promptVars.add(node.id.name);
        }
      } else if (Array.isArray(node)) {
        node.forEach(scanFunctions);
      } else if (typeof node === 'object') {
        for (const key in node) {
          if (node.hasOwnProperty(key)) scanFunctions(node[key]);
        }
      }
    };
    scanFunctions(ast);

    this.steps.push({
      activeNodeId: 'start',
      codeLine: 1,
      cpuOperation: 'CPU Lista ➔ Inicializando Registro de Instrucciones',
      memory: this.cloneMemory(),
    });

    if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
      this.evaluateStatements(ast.body, nodesMap);
    }

    this.steps.push({
      activeNodeId: 'end',
      codeLine: ast?.loc?.end?.line || 1,
      cpuOperation: 'CPU Halt ➔ Ejecución de Programa Finalizada',
      memory: this.cloneMemory(),
    });

    return this.steps;
  }

  /** Revisa si una declaración es const prompt = require('prompt-sync')() */
  private isPromptRequireDecl(d: any): boolean {
    const name = d.id?.name;
    if (name !== 'prompt' && name !== 'leer' && name !== 'PromptSync') return false;
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
    return !!name && this.promptVars.has(name);
  }

  private extractPromptText(expr: any, nodesMap?: Map<string, string>): string {
    const root = this.unwrapExpression(expr);
    if (!root || root.type !== 'CallExpression') return 'Ingrese dato:';
    const firstArg = root.arguments?.[0];
    if (firstArg) {
      return String(this.evalExpr(firstArg, nodesMap)) || 'Ingrese dato:';
    }
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
      if (this._breakSignal || this._continueSignal) return;
    }
  }

  private evaluateStatement(stmt: any, nodesMap: Map<string, string>) {
    if (!stmt) return;
    const line = stmt.loc?.start?.line || 1;
    const targetNodeId = this.resolveNodeId(line, nodesMap);

    // ImportDeclaration (librerías externas)
    if (stmt.type === 'ImportDeclaration') {
      const source = stmt.source?.value || 'unknown';
      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `Sistema ➔ Cargando librería externa: '${source}'`,
        memory: this.cloneMemory(),
      });
      return;
    }

    // Declaración de función (se omite en el flujo principal, pues se ejecuta al llamarse)
    if (stmt.type === 'FunctionDeclaration') return;

    // BreakStatement — Señal de salida de bucle o switch
    if (stmt.type === 'BreakStatement') {
      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: 'SALTO DE CONTROL ➜ BREAK: Salir del Bucle',
        memory: this.cloneMemory(),
      });
      this._breakSignal = true;
      return;
    }

    // ContinueStatement — Señal de salto a siguiente iteración
    if (stmt.type === 'ContinueStatement') {
      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: 'SALTO DE CONTROL ➜ CONTINUE: Siguiente Iteración',
        memory: this.cloneMemory(),
      });
      this._continueSignal = true;
      return;
    }

    // Retorno de Función (ReturnStatement)
    if (stmt.type === 'ReturnStatement') {
      const retVal = stmt.argument ? this.evalExpr(stmt.argument, nodesMap) : undefined;
      this.lastReturnValue = retVal;

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `CPU Retorno de Subrutina ➔ Valor devuelto: ${JSON.stringify(retVal)}`,
        memory: this.cloneMemory(),
      });
      return;
    }

    // Declaraciones de Variables (let/const/var)
    if (stmt.type === 'VariableDeclaration') {
      stmt.declarations.forEach((d: any) => {
        if (this.isPromptRequireDecl(d)) {
          this.memory[d.id?.name] = '[Interfaz de Teclado]';
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `Sistema ➔ Instanciando librería de teclado ➔ RAM [${d.id?.name}]`,
            memory: this.cloneMemory(),
          });
          return;
        }

        // Desestructuración de Objetos
        if (d.id?.type === 'ObjectPattern') {
          const initVal = this.evalExpr(d.init, nodesMap, targetNodeId, line);
          const keys: string[] = [];
          d.id.properties.forEach((prop: any) => {
            if (prop.type === 'Property' && prop.value.type === 'Identifier') {
              const propName = prop.key.name || prop.key.value;
              const targetName = prop.value.name;
              const val = initVal ? initVal[propName] : undefined;
              this.memory[targetName] = val;
              keys.push(`${targetName}: ${val}`);
            }
          });
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `CPU Desestructuración {} ➔ RAM [${keys.join(', ')}]`,
            memory: this.cloneMemory(),
          });
          return;
        }

        // Desestructuración de Arreglos
        if (d.id?.type === 'ArrayPattern') {
          const initVal = this.evalExpr(d.init, nodesMap, targetNodeId, line);
          const keys: string[] = [];
          d.id.elements.forEach((elem: any, idx: number) => {
            if (elem && elem.type === 'Identifier') {
              const val = Array.isArray(initVal) ? initVal[idx] : undefined;
              this.memory[elem.name] = val;
              keys.push(`${elem.name}: ${val}`);
            } else if (elem && elem.type === 'RestElement' && elem.argument.type === 'Identifier') {
              const val = Array.isArray(initVal) ? initVal.slice(idx) : [];
              this.memory[elem.argument.name] = val;
              keys.push(`...${elem.argument.name}: [${val.length} items]`);
            }
          });
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `CPU Desestructuración [] ➔ RAM [${keys.join(', ')}]`,
            memory: this.cloneMemory(),
          });
          return;
        }

        const name = d.id?.name || 'var';

        if (d.init && this.isPromptCall(d.init)) {
          const promptMsg = this.extractPromptText(d.init, nodesMap);
          const providedValue = this.consumeNextInput();

          if (providedValue !== null) {
            const isNumeric = this.wrapsNumericConversion(d.init);
            const parsedVal = isNumeric ? Number(providedValue) : providedValue;
            this.memory[name] = parsedVal;

            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: this.cloneMemory(),
              needsInput: false,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: this.cloneMemory(),
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
            opDesc = `CPU Cargar valor literal ${val} ➔ Asignar a RAM [${name}]`;
          } else if (d.init.type === 'CallExpression' && this.functionsMap.has(d.init.callee?.name)) {
            // Llamada a función en inicialización
            val = this.invokeFunctionCall(d.init, targetNodeId, nodesMap);
            opDesc = `CPU Asignar retorno de subrutina ${d.init.callee.name}() ➔ RAM [${name}] = ${JSON.stringify(val)}`;
          } else {
            val = this.evalExpr(d.init, nodesMap, targetNodeId, line);
            opDesc = `CPU Evaluar Expresión ➔ RAM [${name}] = ${JSON.stringify(val)}`;
          }
        }

        this.memory[name] = val;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: opDesc,
          memory: this.cloneMemory(),
        });
      });
    }
    // Asignaciones / Expresiones
    else if (stmt.type === 'ExpressionStatement') {
      const expr = stmt.expression;

      // console.log, warn, error, info
      if (
        expr.type === 'CallExpression' &&
        expr.callee?.type === 'MemberExpression' &&
        expr.callee.object?.name === 'console' &&
        ['log', 'warn', 'error', 'info'].includes(expr.callee.property?.name)
      ) {
        const method = expr.callee.property.name;
        const printedText = expr.arguments.map((arg: any) => {
          return String(this.evalExpr(arg, nodesMap, targetNodeId, line));
        }).join(' ');

        let prefix = '';
        if (method === 'warn') prefix = '⚠️ ';
        else if (method === 'error') prefix = '❌ ';
        else if (method === 'info') prefix = 'ℹ️ ';

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `E/S Imprimir en Consola (Escribir): "${printedText}"`,
          memory: this.cloneMemory(),
          outputLog: prefix + printedText,
        });
        return;
      }

      if (expr.type === 'AssignmentExpression') {
        const isMember = expr.left?.type === 'MemberExpression';
        const name = isMember ? (expr.left.object?.name || 'obj') : (expr.left?.name || 'var');

        if (this.isPromptCall(expr.right)) {
          const promptMsg = this.extractPromptText(expr.right, nodesMap);
          const providedValue = this.consumeNextInput();

          if (providedValue !== null) {
            const isNumeric = this.wrapsNumericConversion(expr.right);
            const parsedVal = isNumeric ? Number(providedValue) : providedValue;
            
            if (isMember) {
              const objVal = this.evalExpr(expr.left.object, nodesMap);
              const propName = expr.left.computed ? this.evalExpr(expr.left.property, nodesMap) : expr.left.property?.name;
              if (objVal != null && propName != null) objVal[propName] = parsedVal;
            } else {
              this.memory[name] = parsedVal;
            }

            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: this.cloneMemory(),
              needsInput: false,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
              memory: this.cloneMemory(),
              needsInput: true,
              inputVarName: name,
              inputPromptText: promptMsg,
            });
          }
          return;
        }

        let rightVal: any = 0;
        if (expr.right?.type === 'CallExpression' && this.functionsMap.has(expr.right.callee?.name)) {
          rightVal = this.invokeFunctionCall(expr.right, targetNodeId, nodesMap);
        } else {
          rightVal = this.evalExpr(expr.right, nodesMap, targetNodeId, line);
        }

        let currentVal: any = 0;
        let objVal: any = null;
        let propName: any = null;

        if (isMember) {
          objVal = this.evalExpr(expr.left.object, nodesMap);
          propName = expr.left.computed ? this.evalExpr(expr.left.property, nodesMap) : expr.left.property?.name;
          if (objVal != null && propName != null) {
            currentVal = objVal[propName];
          }
        } else {
          currentVal = this.memory[name];
        }

        let val = rightVal;
        if (expr.operator === '+=') val = currentVal + rightVal;
        else if (expr.operator === '-=') val = currentVal - rightVal;
        else if (expr.operator === '*=') val = currentVal * rightVal;
        else if (expr.operator === '/=') val = currentVal / rightVal;
        else if (expr.operator === '%=') val = currentVal % rightVal;

        if (isMember) {
          if (objVal != null && propName != null) objVal[propName] = val;
        } else {
          this.memory[name] = val;
        }

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Cálculo: ${name} = ${JSON.stringify(val)} ➔ Guardar en RAM`,
          memory: this.cloneMemory(),
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
          memory: this.cloneMemory(),
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
              memory: this.cloneMemory(),
              needsInput: false,
              inputVarName: 'datos',
              inputPromptText: promptMsg,
            });
          } else {
            this.steps.push({
              activeNodeId: targetNodeId,
              codeLine: line,
              cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${promptMsg}`,
              memory: this.cloneMemory(),
              needsInput: true,
              inputVarName: 'datos',
              inputPromptText: promptMsg,
            });
          }
        } else if (this.functionsMap.has(expr.callee?.name)) {
          this.invokeFunctionCall(expr, targetNodeId, nodesMap);
        } else {
          const callee = expr.callee?.property?.name || expr.callee?.name || '';
          this.evalExpr(expr, nodesMap, targetNodeId, line); // Ejecutar nativamente (ej: array.push)
          
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `E/S Ejecución de Subrutina nativa: ${callee}()`,
            memory: this.cloneMemory(),
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
        memory: this.cloneMemory(),
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

      while (loopCount < this._maxLoopIterations) {
        const condVal = stmt.test ? Boolean(this.evalExpr(stmt.test, nodesMap)) : true;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Condición de Bucle (Iteración #${loopCount + 1}): ¿Continuar? ➔ ${condVal ? 'SÍ (Repetir)' : 'NO (Salir)'}`,
          memory: this.cloneMemory(),
        });

        if (!condVal) break;

        const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        this.evaluateStatements(body, nodesMap);

        // Manejar señales de break/continue
        if (this._breakSignal) {
          this._breakSignal = false;
          break;
        }
        if (this._continueSignal) {
          this._continueSignal = false;
          // Continúa a la siguiente iteración (skip update NO, el update sí se ejecuta)
        }

        if (stmt.update) {
          this.evaluateExpr(stmt.update, nodesMap);
        }

        loopCount++;
      }
    }
    // Bucle DO...WHILE
    else if (stmt.type === 'DoWhileStatement') {
      let loopCount = 0;
      let condVal = true;

      do {
        const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        this.evaluateStatements(body, nodesMap);

        // Manejar señales de break/continue
        if (this._breakSignal) {
          this._breakSignal = false;
          break;
        }
        if (this._continueSignal) {
          this._continueSignal = false;
        }
        
        condVal = stmt.test ? Boolean(this.evalExpr(stmt.test, nodesMap)) : true;
        
        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Condición de Do...While (Iteración #${loopCount + 1}): ¿Continuar? ➔ ${condVal ? 'SÍ (Repetir)' : 'NO (Salir)'}`,
          memory: this.cloneMemory(),
        });

        loopCount++;
      } while (condVal && loopCount < this._maxLoopIterations);
    }
    // SwitchStatement
    else if (stmt.type === 'SwitchStatement') {
      const discriminantVal = this.evalExpr(stmt.discriminant, nodesMap);

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `ALU Evaluación: Según (${JSON.stringify(discriminantVal)}) ...`,
        memory: this.cloneMemory(),
      });

      let matched = false;
      let fellThrough = false;

      if (Array.isArray(stmt.cases)) {
        for (const caseClause of stmt.cases) {
          const caseLine = caseClause.loc?.start?.line || line;
          const caseNodeId = this.resolveNodeId(caseLine, nodesMap);

          if (!matched && !fellThrough) {
            if (caseClause.test) {
              const caseVal = this.evalExpr(caseClause.test, nodesMap);
              const isMatch = discriminantVal === caseVal;

              this.steps.push({
                activeNodeId: caseNodeId,
                codeLine: caseLine,
                cpuOperation: `ALU Comparar: ${JSON.stringify(discriminantVal)} === ${JSON.stringify(caseVal)} ➔ ${isMatch ? 'COINCIDE' : 'No coincide'}`,
                memory: this.cloneMemory(),
              });

              if (!isMatch) continue;
              matched = true;
            } else {
              // case default
              matched = true;
              this.steps.push({
                activeNodeId: caseNodeId,
                codeLine: caseLine,
                cpuOperation: `ALU Caso Por Defecto (default) ➔ Ejecutar`,
                memory: this.cloneMemory(),
              });
            }
          }

          if (matched || fellThrough) {
            if (Array.isArray(caseClause.consequent)) {
              this.evaluateStatements(caseClause.consequent, nodesMap);
            }

            if (this._breakSignal) {
              this._breakSignal = false;
              break;
            }
            // Si no hubo break, fall-through al siguiente case
            fellThrough = true;
          }
        }
      }
    }
    // ForInStatement: for (const key in obj)
    else if (stmt.type === 'ForInStatement') {
      const objVal = this.evalExpr(stmt.right, nodesMap);
      const varName = stmt.left?.declarations?.[0]?.id?.name || stmt.left?.name || 'key';
      const keys = objVal != null ? Object.keys(objVal) : [];

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `ALU Bucle For...In: Iterar propiedades de ${stmt.right?.name || 'objeto'} (${keys.length} propiedades)`,
        memory: this.cloneMemory(),
      });

      let loopCount = 0;
      for (const key of keys) {
        if (loopCount >= this._maxLoopIterations) break;
        this.memory[varName] = key;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Iteración #${loopCount + 1}: ${varName} = "${key}"`,
          memory: this.cloneMemory(),
        });

        const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        this.evaluateStatements(body, nodesMap);

        if (this._breakSignal) { this._breakSignal = false; break; }
        if (this._continueSignal) { this._continueSignal = false; }
        loopCount++;
      }
    }
    // ForOfStatement: for (const item of array)
    else if (stmt.type === 'ForOfStatement') {
      const iterableVal = this.evalExpr(stmt.right, nodesMap);
      const varName = stmt.left?.declarations?.[0]?.id?.name || stmt.left?.name || 'item';
      const items = Array.isArray(iterableVal) ? iterableVal : (typeof iterableVal === 'string' ? [...iterableVal] : []);

      this.steps.push({
        activeNodeId: targetNodeId,
        codeLine: line,
        cpuOperation: `ALU Bucle For...Of: Iterar elementos de ${stmt.right?.name || 'iterable'} (${items.length} elementos)`,
        memory: this.cloneMemory(),
      });

      let loopCount = 0;
      for (const item of items) {
        if (loopCount >= this._maxLoopIterations) break;
        this.memory[varName] = item;

        this.steps.push({
          activeNodeId: targetNodeId,
          codeLine: line,
          cpuOperation: `ALU Iteración #${loopCount + 1}: ${varName} = ${JSON.stringify(item)}`,
          memory: this.cloneMemory(),
        });

        const body = stmt.body?.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        this.evaluateStatements(body, nodesMap);

        if (this._breakSignal) { this._breakSignal = false; break; }
        if (this._continueSignal) { this._continueSignal = false; }
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
      cpuOperation: `SALTO DE CONTROL ➜ Invocando Subrutina ${funcName}(${argsValues.map((v: any) => JSON.stringify(v)).join(', ')})`,
      memory: this.cloneMemory(),
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
      memory: this.cloneMemory(),
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
      memory: this.cloneMemory(),
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

  private evalExpr(expr: any, nodesMap?: Map<string, string>, activeNodeId?: string, codeLine?: number): any {
    if (!expr) return 0;
    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'Identifier') {
      if (this.memory[expr.name] !== undefined) return this.memory[expr.name];
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
      return (expr.elements || []).map((e: any) => this.evalExpr(e, nodesMap, activeNodeId, codeLine));
    }

    if (expr.type === 'ObjectExpression') {
      const obj: Record<string, any> = {};
      (expr.properties || []).forEach((prop: any) => {
        if (prop.type === 'Property') {
          const key = prop.key?.name || prop.key?.value;
          if (key != null) {
            obj[key] = this.evalExpr(prop.value, nodesMap, activeNodeId, codeLine);
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
          result += String(this.evalExpr(expressions[i], nodesMap));
        }
      }
      return result;
    }

    if (expr.type === 'MemberExpression') {
      const objVal = this.evalExpr(expr.object, nodesMap);
      const propName = expr.computed ? this.evalExpr(expr.property, nodesMap) : expr.property?.name;
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
      const argVal = this.evalExpr(expr.argument, nodesMap);
      if (expr.operator === '!') return !argVal;
      if (expr.operator === 'typeof') return typeof argVal;
      if (expr.operator === '-') return -argVal;
      if (expr.operator === '+') return +argVal;
      return argVal;
    }

    if (expr.type === 'ConditionalExpression') {
      const testVal = this.evalExpr(expr.test, nodesMap);
      return testVal ? this.evalExpr(expr.consequent, nodesMap) : this.evalExpr(expr.alternate, nodesMap);
    }

    if (expr.type === 'LogicalExpression') {
      const left = this.evalExpr(expr.left, nodesMap);
      if (expr.operator === '&&') return left ? this.evalExpr(expr.right, nodesMap) : left;
      if (expr.operator === '||') return left ? left : this.evalExpr(expr.right, nodesMap);
    }

    if (expr.type === 'CallExpression') {
      const calleeObj = expr.callee?.type === 'MemberExpression' || expr.callee?.type === 'Identifier' 
        ? this.evalExpr(expr.callee, nodesMap) 
        : null;

      if (typeof calleeObj === 'function') {
        const args = expr.arguments.map((arg: any) => this.evalExpr(arg, nodesMap, activeNodeId, codeLine));
        const res = calleeObj(...args);
        
        if (activeNodeId) {
          const funcName = expr.callee?.property?.name || expr.callee?.name || 'nativa';
          this.steps.push({
            activeNodeId,
            codeLine: codeLine || 1,
            cpuOperation: `ALU Función nativa: ${funcName}() ➔ Retornó: ${JSON.stringify(res)}`,
            memory: { ...this.memory },
          });
        }
        
        return res;
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
