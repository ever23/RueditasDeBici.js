import { ExpressionEvaluator } from '../expressionEvaluator';
import { ISimulationContext, SimulationStepPayload } from '../../shared/types';

class MockContext implements ISimulationContext {
  private memory: Record<string, any> = {};
  private functions: Map<string, any> = new Map();
  public steps: SimulationStepPayload[] = [];

  getMemory() { return this.memory; }
  setMemory(key: string, value: any) { this.memory[key] = value; }
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
    context.setMemory('x', 99);
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
    context.setMemory('x', 5);
    const testNode = {
      left: { type: 'Identifier', name: 'x' },
      operator: '>',
      right: { type: 'Literal', value: 3 }
    };
    const formatted = evaluator.formatConditionText(testNode, context);
    expect(formatted).toBe('x(5) > 3');
  });
});
