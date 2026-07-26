import { SimulationStepPayload } from '../shared/types';

export class SimulationEngine {
  private memory: Record<string, any> = {};
  private steps: SimulationStepPayload[] = [];

  public buildSimulationSteps(ast: any, nodesMap: Map<string, string>): SimulationStepPayload[] {
    this.memory = {};
    this.steps = [];

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

  /** Revisa si una declaración es la típica const prompt = require('prompt-sync')() */
  private isPromptRequireDecl(d: any): boolean {
    const name = d.id?.name;
    if (name !== 'prompt') return false;
    const init = d.init;
    if (!init) return false;
    // require('prompt-sync')()
    if (init.type === 'CallExpression' && init.callee?.type === 'CallExpression') return true;
    // require('prompt-sync')
    if (init.type === 'CallExpression' && init.callee?.name === 'require') return true;
    return false;
  }

  /** Desenvuelve cadenas de métodos y conversiones hasta la llamada raíz */
  private unwrapExpression(expr: any): any {
    if (!expr) return null;
    if (expr.type === 'CallExpression') {
      // parseInt(prompt(...)) / parseFloat(prompt(...)) / Number(prompt(...))
      const callee = expr.callee;
      if (
        (callee?.name === 'parseInt' || callee?.name === 'parseFloat' || callee?.name === 'Number' || callee?.name === 'String') &&
        expr.arguments[0]
      ) {
        return this.unwrapExpression(expr.arguments[0]);
      }
      // prompt("...").toLowerCase() / .trim() / etc
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

  private evaluateStatements(statements: any[], nodesMap: Map<string, string>) {
    for (const stmt of statements) {
      this.evaluateStatement(stmt, nodesMap);
    }
  }

  private evaluateStatement(stmt: any, nodesMap: Map<string, string>) {
    if (!stmt) return;
    const line = stmt.loc?.start?.line || 1;
    const targetNodeId = nodesMap.get(String(line)) || `node_${line}`;

    // Declaraciones de Variables (let/const/var)
    if (stmt.type === 'VariableDeclaration') {
      stmt.declarations.forEach((d: any) => {
        const name = d.id?.name || 'var';

        // Saltar const prompt = require('prompt-sync')()
        if (this.isPromptRequireDecl(d)) return;

        if (d.init && this.isPromptCall(d.init)) {
          const promptMsg = this.extractPromptText(d.init);
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
            memory: { ...this.memory },
            needsInput: true,
            inputVarName: name,
            inputPromptText: promptMsg,
          });
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
          } else {
            val = this.evalExpr(d.init);
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
          if (arg.type === 'BinaryExpression') return String(this.evalExpr(arg));
          if (arg.type === 'TemplateLiteral') {
            return arg.quasis.map((q: any, i: number) => {
              const txt = q.value.cooked || '';
              const exprVal = arg.expressions[i] ? String(this.evalExpr(arg.expressions[i])) : '';
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
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `ENTRADA TECLADO: Leer [${name}] ➔ ${promptMsg}`,
            memory: { ...this.memory },
            needsInput: true,
            inputVarName: name,
            inputPromptText: promptMsg,
          });
          return;
        }

        const val = this.evalExpr(expr.right);
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
        // Verificar si es un prompt suelto (sin asignación)
        if (this.isPromptCall(expr)) {
          this.steps.push({
            activeNodeId: targetNodeId,
            codeLine: line,
            cpuOperation: `ENTRADA TECLADO: Leer [datos] ➔ ${this.extractPromptText(expr)}`,
            memory: { ...this.memory },
            needsInput: true,
            inputVarName: 'datos',
            inputPromptText: this.extractPromptText(expr),
          });
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
      const condVal = Boolean(this.evalExpr(stmt.test));
      const condText = `${stmt.test?.left?.name || 'val'} ${stmt.test?.operator || '=='} ${this.formatCondRight(stmt.test?.right)}`;

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
        const condVal = stmt.test ? Boolean(this.evalExpr(stmt.test)) : true;

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
          this.evaluateExpr(stmt.update);
        }

        loopCount++;
      }
    }
  }

  private formatCondRight(node: any): string {
    if (!node) return '0';
    if (node.type === 'Literal') return JSON.stringify(node.value);
    if (node.type === 'Identifier') return node.name;
    return '...';
  }

  private evalExpr(expr: any): any {
    if (!expr) return 0;
    if (expr.type === 'Literal') return expr.value;
    if (expr.type === 'Identifier') return this.memory[expr.name] !== undefined ? this.memory[expr.name] : 0;

    if (expr.type === 'CallExpression' && expr.callee?.type === 'MemberExpression') {
      const objVal = String(this.evalExpr(expr.callee.object));
      if (expr.callee.property?.name === 'toLowerCase') return objVal.toLowerCase();
      if (expr.callee.property?.name === 'toUpperCase') return objVal.toUpperCase();
      if (expr.callee.property?.name === 'trim') return objVal.trim();
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evalExpr(expr.left);
      const right = this.evalExpr(expr.right);

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

  private evaluateExpr(expr: any) {
    this.evalExpr(expr);
  }
}
