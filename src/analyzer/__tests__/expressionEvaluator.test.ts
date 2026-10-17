import { ExpressionEvaluator } from '../expressionEvaluator';
import { ISimulationContext, SimulationStepPayload } from '../../shared/types';

class MockContext implements ISimulationContext {
  private memory: Record<string, any> = {};
  private functions: Map<string, any> = new Map();
  public steps: SimulationStepPayload[] = [];

  getMemory() { return this.memory; }
  declareVariable(key: string, value: any) { this.memory[key] = value; }
  updateVariable(key: string, value: any) { this.memory[key] = value; }
  getFunctionsMap() { return this.functions; }
  pushStep(step: SimulationStepPayload) { this.steps.push(step); }
  invokeFunctionCall(callExpr: any, callerNodeId: string, nodesMap: Map<string, string>) { return undefined; }
}

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;
  let context: MockContext;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
    context = new MockContext();
  });

  test('should evaluate literals correctly', () => {
    const literalNode = { type: 'Literal', value: 42 };
    expect(evaluator.evaluate(literalNode, context)).toBe(42);
  });

  test('should evaluate basic arithmetic', () => {
    const expr = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'Literal', value: 5 },
      right: { type: 'Literal', value: 10 }
    };
    expect(evaluator.evaluate(expr, context)).toBe(15);
  });

  test('should read variables from context memory', () => {
    context.updateVariable('x', 99);
    const idNode = { type: 'Identifier', name: 'x' };
    expect(evaluator.evaluate(idNode, context)).toBe(99);
  });

  test('should evaluate logical expressions', () => {
    const expr = {
      type: 'LogicalExpression',
      operator: '&&',
      left: { type: 'Literal', value: true },
      right: { type: 'Literal', value: false }
    };
    expect(evaluator.evaluate(expr, context)).toBe(false);
  });

  test('should format condition text', () => {
    context.declareVariable('x', 5);
    const testNode = {
      left: { type: 'Identifier', name: 'x' },
      operator: '>',
      right: { type: 'Literal', value: 3 }
    };
    const formatted = evaluator.formatConditionText(testNode, context);
    expect(formatted).toBe('x(5) > 3');
  });

  test('should format compound logical condition text', () => {
    context.declareVariable('x', 5);
    context.declareVariable('y', 10);
    const testNode = {
      type: 'LogicalExpression',
      operator: '&&',
      left: {
        type: 'BinaryExpression',
        left: { type: 'Identifier', name: 'x' },
        operator: '>',
        right: { type: 'Literal', value: 3 }
      },
      right: {
        type: 'BinaryExpression',
        left: { type: 'Identifier', name: 'y' },
        operator: '<',
        right: { type: 'Literal', value: 20 }
      }
    };
    expect(evaluator.formatConditionText(testNode, context)).toBe('x(5) > 3 && y(10) < 20');
  });

  test('should evaluate nullish coalescing (??) and exponentiation (**)', () => {
    const nullishExpr = {
      type: 'LogicalExpression',
      operator: '??',
      left: { type: 'Literal', value: null },
      right: { type: 'Literal', value: 'por defecto' }
    };
    expect(evaluator.evaluate(nullishExpr, context)).toBe('por defecto');

    const powExpr = {
      type: 'BinaryExpression',
      operator: '**',
      left: { type: 'Literal', value: 2 },
      right: { type: 'Literal', value: 4 }
    };
    expect(evaluator.evaluate(powExpr, context)).toBe(16);
  });
});
