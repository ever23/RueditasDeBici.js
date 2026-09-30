import { ScopeManager } from '../ScopeManager';

describe('ScopeManager Unit Tests', () => {
  let manager: ScopeManager;

  beforeEach(() => {
    manager = new ScopeManager();
  });

  it('should initialize with Global scope', () => {
    const stack = manager.getCallStack();
    expect(stack.length).toBe(1);
    expect(stack[0].name).toBe('Global');
    expect(manager.getMemory()).toEqual({});
  });

  it('should declare and update variables in Global scope', () => {
    manager.declareVariable('x', 10);
    expect(manager.getMemory()['x']).toBe(10);

    manager.updateVariable('x', 25);
    expect(manager.getMemory()['x']).toBe(25);
  });

  it('should push and pop nested scopes correctly', () => {
    manager.declareVariable('a', 1);
    manager.pushScope('FunctionScope');

    manager.declareVariable('b', 2);
    expect(manager.getMemory()).toEqual({ a: 1, b: 2 });

    // Modificar variable en ámbito superior
    manager.updateVariable('a', 100);
    expect(manager.getMemory()['a']).toBe(100);

    manager.popScope();
    expect(manager.getMemory()['a']).toBe(100);
    expect(manager.getMemory()['b']).toBeUndefined();
  });

  it('should not allow popping the Global scope', () => {
    manager.popScope();
    manager.popScope();
    expect(manager.getCallStack().length).toBe(1);
    expect(manager.getCallStack()[0].name).toBe('Global');
  });

  it('should create deep clones of memory and call stack', () => {
    manager.declareVariable('obj', { count: 5 });
    const cloned = manager.cloneMemory();

    expect(cloned).toEqual({ obj: { count: 5 } });
    cloned.obj.count = 99;
    expect(manager.getMemory().obj.count).toBe(5);
  });
});
