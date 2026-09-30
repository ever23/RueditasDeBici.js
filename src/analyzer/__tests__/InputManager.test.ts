import { InputManager } from '../InputManager';

describe('InputManager Unit Tests', () => {
  it('should consume inputs sequentially and return null when empty', () => {
    const manager = new InputManager(['42', 'texto']);
    expect(manager.consumeNextInput()).toBe('42');
    expect(manager.consumeNextInput()).toBe('texto');
    expect(manager.consumeNextInput()).toBeNull();
  });

  it('should recognize prompt identifiers and custom prompt names', () => {
    const manager = new InputManager();
    expect(manager.getPromptVars().has('prompt')).toBe(true);
    expect(manager.getPromptVars().has('leer')).toBe(true);

    manager.addPromptVar('miLectura');
    expect(manager.getPromptVars().has('miLectura')).toBe(true);
  });

  it('should detect numeric conversion wrapping', () => {
    const manager = new InputManager();
    const callExpr = {
      type: 'CallExpression',
      callee: { name: 'parseInt' },
      arguments: [],
    };
    expect(manager.wrapsNumericConversion(callExpr)).toBe(true);

    const nonNumericCall = {
      type: 'CallExpression',
      callee: { name: 'trim' },
      arguments: [],
    };
    expect(manager.wrapsNumericConversion(nonNumericCall)).toBe(false);
  });
});
