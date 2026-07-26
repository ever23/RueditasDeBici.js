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
          h(Handle, { type: 'target', position: Position.Right, id: 'target-right' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Left, id: 'source-left' }),
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
          h(
            'div',
            { class: 'decision-content' },
            props.data.label
          ),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Left, id: 'source-left' }),
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
          h(Handle, { type: 'target', position: Position.Right, id: 'target-right' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Left, id: 'source-left' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});

export const IONode = defineComponent({
  name: 'IONode',
  props: ['data'],
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'flowchart-node node-io',
        },
        [
          h(Handle, { type: 'target', position: Position.Top, id: 'target-top' }),
          h(Handle, { type: 'target', position: Position.Left, id: 'target-left' }),
          h(Handle, { type: 'target', position: Position.Right, id: 'source-right' }),
          h('span', { class: 'node-label' }, props.data.label),
          h(Handle, { type: 'source', position: Position.Bottom, id: 'source-bottom' }),
          h(Handle, { type: 'source', position: Position.Left, id: 'source-left' }),
          h(Handle, { type: 'source', position: Position.Right, id: 'source-right' }),
        ]
      );
  },
});
