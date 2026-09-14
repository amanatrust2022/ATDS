/**
 * Subscript and superscript in the rich-text editor.
 *
 * Two marks, two toolbar buttons, the shortcuts Word and Google Docs use
 * (Ctrl+. and Ctrl+,), and the part that matters most in a laboratory:
 * the editor *recognises* what a technologist types. Finish "x10^9/L",
 * "H_2O" or "CO2" with a space or punctuation and it becomes what it means,
 * without a button being pressed. The rules are the ones the printed report
 * already applies (lib/scriptNotation.ts), so the screen and the paper
 * agree.
 *
 * Nothing is installed for this: the two marks are a few lines each, and
 * the @tiptap/extension-subscript and -superscript packages would add a
 * dependency for the same result.
 */

import { Mark, Extension, InputRule, mergeAttributes } from '@tiptap/core';
import { parseScripts } from '@/lib/scriptNotation';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    superscript: { toggleSuperscript: () => ReturnType };
    subscript: { toggleSubscript: () => ReturnType };
  }
}

export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML() {
    return [
      { tag: 'sup' },
      {
        style: 'vertical-align',
        getAttrs: (value) => (value === 'super' ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSuperscript: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-.': () => this.editor.commands.toggleSuperscript() };
  },
});

export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML() {
    return [
      { tag: 'sub' },
      {
        style: 'vertical-align',
        getAttrs: (value) => (value === 'sub' ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSubscript: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-,': () => this.editor.commands.toggleSubscript() };
  },
});

/**
 * The word just finished, if it holds anything to mark. Fires on the
 * character that ends a word — a space or punctuation — so "x10^9/L" is
 * converted once it is complete, not while "x10^1" is on its way to
 * "x10^10". The ending character is written back as typed.
 */
const WORD_END = /(\S+)([\s,;:)\]])$/;

export const ScriptRecognition = Extension.create({
  name: 'scriptRecognition',
  addInputRules() {
    return [
      new InputRule({
        find: WORD_END,
        handler: ({ state, range, match }) => {
          const [, word, terminator] = match;
          const segments = parseScripts(word);
          if (!segments.some((s) => s.level !== 'normal')) return null;

          const { tr, schema } = state;
          const sup = schema.marks['superscript'];
          const sub = schema.marks['subscript'];
          if (!sup || !sub) return null;

          // Any marks already on the word (bold, a colour) are kept.
          const inherited = state.doc.resolve(range.from).marks();
          const nodes = segments.map((s) => {
            const marks =
              s.level === 'sup' ? [...inherited, sup.create()]
              : s.level === 'sub' ? [...inherited, sub.create()]
              : inherited;
            return schema.text(s.text, marks);
          });
          nodes.push(schema.text(terminator, inherited));

          tr.replaceWith(range.from, range.to, nodes);
          // Whatever follows is typed plain, not as a script.
          tr.removeStoredMark(sup);
          tr.removeStoredMark(sub);
          return;
        },
      }),
    ];
  },
});
