import { defineComponent, h } from 'vue';
import { Handle, Position } from '@vue-flow/core';

export const StartEndNode = defineComponent({
  name: 'StartEndNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-start-end',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
        ]
      );
  },
});

export const ProcessNode = defineComponent({
  name: 'ProcessNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-process',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const SubroutineNode = defineComponent({
  name: 'SubroutineNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-subroutine',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const DecisionNode = defineComponent({
  name: 'DecisionNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-decision',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h(
            'div',
            { class: 'decision-content' },
            props.data.label
          ),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const LoopNode = defineComponent({
  name: 'LoopNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-loop',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const InputNode = defineComponent({
  name: 'InputNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-input',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const OutputNode = defineComponent({
  name: 'OutputNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-output',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const VariableNode = defineComponent({
  name: 'VariableNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-variable',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const ConstantNode = defineComponent({
  name: 'ConstantNode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-constant',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const FunctionGroupNode = defineComponent({
  name: 'FunctionGroupNode',
  props: ['data', 'style'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'function-group-box',
          style: {
            backgroundColor: props.style?.backgroundColor || 'rgba(168, 85, 247, 0.15)',
            borderColor: props.style?.borderColor || '#a855f7',
          },
        },
        [
          h('div', { class: 'function-group-header', style: { color: props.style?.borderColor || '#a855f7' } }, [
            h('span', { class: 'icon' }, '📦 '),
            h('strong', {}, props.data.label),
          ]),
        ]
      );
  },
});
