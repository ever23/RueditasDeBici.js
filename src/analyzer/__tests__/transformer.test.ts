import { parseCode } from '../parser';
import { transformAstToFlowchart } from '../transformer';

describe('Transformer (transformAstToFlowchart)', () => {
  it('should transform sequential variable declarations and console.log', () => {
    const code = `
      let a = 10;
      let b = 20;
      console.log(a + b);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    expect(flowchart.nodes.length).toBeGreaterThanOrEqual(4); // start, grouped var, output, end
    expect(flowchart.nodes[0].id).toBe('start');
    expect(flowchart.nodes[flowchart.nodes.length - 1].id).toBe('end');

    const outputNode = flowchart.nodes.find((n) => n.type === 'output');
    expect(outputNode).toBeDefined();
    expect(outputNode?.data.label).toContain('Escribir: a + b');
  });

  it('should detect prompt-sync calls and generate input nodes', () => {
    const code = `
      const prompt = require('prompt-sync')();
      let nombre = prompt("Ingrese su nombre: ");
      let edad = parseInt(prompt("Ingrese su edad: "));
      console.log(nombre, edad);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const inputNodes = flowchart.nodes.filter((n) => n.type === 'input');
    expect(inputNodes.length).toBe(2);
    expect(inputNodes[0].data.label).toBe('Leer: nombre');
    expect(inputNodes[1].data.label).toBe('Leer: edad');
  });

  it('should transform if-else branches correctly', () => {
    const code = `
      let x = 5;
      if (x > 0) {
        console.log("Positivo");
      } else {
        console.log("No positivo");
      }
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const decisionNode = flowchart.nodes.find((n) => n.type === 'decision');
    expect(decisionNode).toBeDefined();
    expect(decisionNode?.data.label).toBe('¿x > 0?');

    const endIfNode = flowchart.nodes.find((n) => n.data.label === 'Fin If');
    expect(endIfNode).toBeDefined();
  });

  it('should transform loops with back edges', () => {
    const code = `
      let i = 0;
      while (i < 5) {
        i++;
      }
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const loopNode = flowchart.nodes.find((n) => n.type === 'loop');
    expect(loopNode).toBeDefined();
    expect(loopNode?.data.label).toBe('Bucle (i < 5)');

    const loopBackEdge = flowchart.edges.find((e) => e.label === 'Repetir');
    expect(loopBackEdge).toBeDefined();
  });

  it('should transform function declarations with functionGroup and parameters', () => {
    const code = `
      function sumar(a, b) {
        let res = a + b;
        return res;
      }
      sumar(1, 2);
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const groupNode = flowchart.nodes.find((n) => n.type === 'functionGroup');
    expect(groupNode).toBeDefined();
    expect(groupNode?.data.label).toBe('Función: sumar(a, b)');

    const returnNode = flowchart.nodes.find((n) => n.data.label.startsWith('Retornar:'));
    expect(returnNode).toBeDefined();
    expect(returnNode?.parentNode).toBe(groupNode?.id);
  });

  it('should support loops inside functions (bonus fix)', () => {
    const code = `
      function contarHasta(n) {
        let c = 0;
        while (c < n) {
          c++;
        }
        return c;
      }
    `;
    const parseResult = parseCode(code);
    expect(parseResult.error).toBeNull();

    const flowchart = transformAstToFlowchart(parseResult.ast);
    const loopNode = flowchart.nodes.find((n) => n.type === 'loop');
    expect(loopNode).toBeDefined();
    const groupNode = flowchart.nodes.find((n) => n.type === 'functionGroup');
    expect(loopNode?.parentNode).toBe(groupNode?.id);
  });
});
