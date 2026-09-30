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
  });
});
