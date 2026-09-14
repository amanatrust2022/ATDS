import { describe, it, expect } from 'vitest';
import { parseScripts, scriptsToHtml, scriptsToPdfRuns, hasScripts, scriptsToNotation } from './scriptNotation';

describe('recognising sub- and superscripts in plain text', () => {
  it.each([
    ['x10^9/L', 'x10<sup>9</sup>/L'],
    ['x10^6/ml', 'x10<sup>6</sup>/ml'],
    ['10^-3', '10<sup>-3</sup>'],
    ['10^{-3}', '10<sup>-3</sup>'],
    ['H_2O', 'H<sub>2</sub>O'],
    ['C_{6}H_{12}O_6', 'C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>'],
    ['cells/mm3', 'cells/mm<sup>3</sup>'],
    ['1.73 m2', '1.73 m<sup>2</sup>'],
    ['H2O', 'H<sub>2</sub>O'],
    ['PaCO2 and HCO3-', 'PaCO<sub>2</sub> and HCO<sub>3</sub><sup>-</sup>'],
    ['Ca2+', 'Ca<sup>2+</sup>'],
    ['Na+ K+ Cl-', 'Na<sup>+</sup> K<sup>+</sup> Cl<sup>-</sup>'],
    ['Free T4', 'Free T<sub>4</sub>'],
    ['Vitamin B12', 'Vitamin B<sub>12</sub>'],
  ])('%s → %s', (input, html) => {
    expect(scriptsToHtml(input)).toBe(html);
  });

  it.each([
    'ATD/20260911/0002',
    '08068929197',
    'L4/L5 disc',
    'T2-weighted',
    'HbA1c 6.2%',
    'CD4 count 350',
    'khaleed@example.com',
    'Room A2',
    'mg/dL',
    '3.50-9.50',
  ])('leaves "%s" alone', (input) => {
    expect(hasScripts(input)).toBe(false);
    expect(parseScripts(input).map((s) => s.text).join('')).toBe(input);
  });

  it('escapes HTML in the text it marks up', () => {
    expect(scriptsToHtml('<b>x10^9</b>')).toBe('&lt;b&gt;x10<sup>9</sup>&lt;/b&gt;');
  });

  it('renders pdfmake runs, and a plain string where nothing changes', () => {
    expect(scriptsToPdfRuns('mmol/L')).toBe('mmol/L');
    expect(scriptsToPdfRuns('x10^9/L')).toEqual([{ text: 'x10' }, { text: '9', sup: true }, { text: '/L' }]);
    expect(scriptsToPdfRuns('CO2')).toEqual([{ text: 'CO' }, { text: '2', sub: true }]);
  });

  it('writes segments back as the notation a person can type', () => {
    expect(scriptsToNotation(parseScripts('x10^9/L and H2O'))).toBe('x10^{9}/L and H_{2}O');
  });
});
