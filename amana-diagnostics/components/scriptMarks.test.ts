import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Superscript, Subscript, ScriptRecognition } from './scriptMarks';

/** Types `text` one character at a time, the way a keyboard reaches the editor, so input rules fire. */
function type(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch, () => editor.state.tr.insertText(ch, from, to)));
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

const make = (content = '<p></p>') =>
  new Editor({
    extensions: [StarterKit, Superscript, Subscript, ScriptRecognition],
    content,
    element: document.createElement('div'),
  });

describe('sub- and superscript in the editor', () => {
  it('round-trips <sup> and <sub> from a saved template', () => {
    const editor = make('<p>x10<sup>9</sup>/L and H<sub>2</sub>O</p>');
    expect(editor.getHTML()).toBe('<p>x10<sup>9</sup>/L and H<sub>2</sub>O</p>');
  });

  it('recognises the notation as it is typed', () => {
    const editor = make();
    type(editor, 'Count x10^9/L is normal, PaCO2 low.');
    expect(editor.getHTML()).toBe('<p>Count x10<sup>9</sup>/L is normal, PaCO<sub>2</sub> low.</p>');
  });

  it('does not touch what it does not know', () => {
    const editor = make();
    type(editor, 'L4/L5 disc, HbA1c 6.2% ');
    expect(editor.getHTML()).toBe('<p>L4/L5 disc, HbA1c 6.2% </p>');
  });

  it('types plain text after a recognised word, not more script', () => {
    const editor = make();
    type(editor, 'CO2 retained');
    expect(editor.getHTML()).toBe('<p>CO<sub>2</sub> retained</p>');
  });

  it('has a button-style toggle for each', () => {
    const editor = make('<p>E=mc2</p>');
    editor.commands.setTextSelection({ from: 5, to: 6 });
    editor.commands.toggleSuperscript();
    expect(editor.getHTML()).toBe('<p>E=mc<sup>2</sup></p>');
    editor.commands.toggleSubscript();
    expect(editor.getHTML()).toBe('<p>E=mc<sub>2</sub></p>');
  });
});
