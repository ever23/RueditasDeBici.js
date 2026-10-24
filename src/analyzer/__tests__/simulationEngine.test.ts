import { parseCode } from '../parser';
import { transformAstToFlowchart } from '../transformer';
import { SimulationEngine } from '../simulationEngine';

describe('SimulationEngine Hoisting & Function Types', () => {
  it('should hoist function declarations into RAM as Function type with line and node info', () => {
    const code = `
      function sumar(a, b) {
        return a + b;
      }
      function restar(a, b) {
        return a - b;
      }
      let x = sumar(10, 20);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const nodesMap = new Map<string, string>();
    flowchart.nodes.forEach((n) => {
      if (!n.parentNode && n.type !== 'functionGroup') {
        nodesMap.set(String(n.data.codeLine), n.id);
      }
      if (n.parentNode) {
        nodesMap.set(`func:${n.data.codeLine}`, n.id);
      }
      if (n.type === 'functionGroup') {
        nodesMap.set(`group:${n.data.codeLine}`, n.id);
      }
    });

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, nodesMap);

    // Step 0: start
    expect(steps[0].activeNodeId).toBe('start');

    // Step 1: Hoisting de sumar
    const hoistingStepSumar = steps.find(
      (s) => s.cpuOperation && s.cpuOperation.includes("Almacenando tipo Function: sumar")
    );
    expect(hoistingStepSumar).toBeDefined();
    expect(hoistingStepSumar?.codeLine).toBe(2);
    expect(hoistingStepSumar?.memory['sumar']).toBeDefined();
    expect(hoistingStepSumar?.memory['sumar'].__type).toBe('Function');
    expect(hoistingStepSumar?.memory['sumar'].signature).toBe('ƒ(a, b)');

    // Step 2: Hoisting de restar
    const hoistingStepRestar = steps.find(
      (s) => s.cpuOperation && s.cpuOperation.includes("Almacenando tipo Function: restar")
    );
    expect(hoistingStepRestar).toBeDefined();
    expect(hoistingStepRestar?.codeLine).toBe(5);
    expect(hoistingStepRestar?.memory['restar'].__type).toBe('Function');
  });

  it('should assign function expressions to RAM on their line of execution', () => {
    const code = `
      const multiplicar = (a, b) => a * b;
      let res = multiplicar(3, 4);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const nodesMap = new Map<string, string>();
    flowchart.nodes.forEach((n) => {
      nodesMap.set(String(n.data.codeLine), n.id);
    });

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, nodesMap);

    // Before line 2 runs, multiplicar should NOT be hoisted
    expect(steps[0].memory['multiplicar']).toBeUndefined();

    // After line 2 runs, multiplicar is in RAM as Function
    const assignStep = steps.find(
      (s) => s.cpuOperation && s.cpuOperation.includes("Asignar tipo Function (expresión)")
    );
    expect(assignStep).toBeDefined();
    expect(assignStep?.memory['multiplicar'].__type).toBe('Function');
    // Verify the arrow function expression actually executed when called on line 3
    const endStep = steps[steps.length - 1];
    expect(endStep.memory['res']).toBe(12);
  });

  it('should stop function execution on early return inside an if statement', () => {
    const code = `
      function clasificar(n) {
        if (n < 0) {
          return "Negativo";
        }
        return "Positivo";
      }
      let r1 = clasificar(-5);
      let r2 = clasificar(10);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, new Map());
    const endStep = steps[steps.length - 1];

    expect(endStep.memory['r1']).toBe('Negativo');
    expect(endStep.memory['r2']).toBe('Positivo');
  });

  it('should handle recursive function calls accurately without corrupting return values', () => {
    const code = `
      function factorial(n) {
        if (n <= 1) {
          return 1;
        }
        return n * factorial(n - 1);
      }
      let resultado = factorial(4);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, new Map());
    const endStep = steps[steps.length - 1];

    expect(endStep.memory['resultado']).toBe(24);
  });

  it('should support higher-order array methods with arrow functions', () => {
    const code = `
      let numeros = [1, 2, 3, 4];
      let dobles = numeros.map(x => x * 2);
      let mayores = dobles.filter(x => x > 4);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, new Map());
    const endStep = steps[steps.length - 1];

    expect(endStep.memory['dobles']).toEqual([2, 4, 6, 8]);
    expect(endStep.memory['mayores']).toEqual([6, 8]);
  });

  it('should debug Hanoi tower simulation steps and callStack', () => {
    const code = `
      let torres = { A: [], B: [], C: [] };
      let totalDiscos = 0;
      let paso = 0;

      function mostrarTorres() {
          console.log(torres.A.join(", "));
      }

      function moverDisco(origen, destino) {
          let disco = torres[origen].pop();
          torres[destino].push(disco);
          paso++;
          mostrarTorres();
      }

      function resolverHanoi(n, origen, auxiliar, destino) {
          if (n === 1) {
              moverDisco(origen, destino);
              return;
          }

          resolverHanoi(n - 1, origen, destino, auxiliar);
          moverDisco(origen, destino);
          resolverHanoi(n - 1, auxiliar, origen, destino);
      }

      totalDiscos = 4;
      for (let i = totalDiscos; i >= 1; i--) {
          torres.A.push(i);
      }
      mostrarTorres();
      resolverHanoi(totalDiscos, "A", "B", "C");
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const engine = new SimulationEngine();
    const steps = engine.buildSimulationSteps(parseResult.ast, new Map());

    const emptyCallStackSteps = steps
      .map((s, idx) => ({ idx: idx + 1, callStack: s.callStack, cpuOp: s.cpuOperation }))
      .filter((s) => !s.callStack || s.callStack.length === 0);

    expect(emptyCallStackSteps.length).toBe(0);
  });
});
