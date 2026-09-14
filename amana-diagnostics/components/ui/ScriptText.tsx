'use client';

import { parseScripts } from '@/lib/scriptNotation';

/**
 * Plain text with its sub- and superscripts shown.
 *
 * "x10^9/L", "mm3", "CO2", "Ca2+" — typed flat, because a unit field is a
 * plain input — render here the way they print on the report
 * (lib/scriptNotation.ts holds the one set of rules). Anything the rules do
 * not recognise is shown exactly as typed.
 */
export function ScriptText({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  const segments = parseScripts(children);
  if (!segments.some((s) => s.level !== 'normal')) return <>{children}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.level === 'sup' ? <sup key={i}>{s.text}</sup>
        : s.level === 'sub' ? <sub key={i}>{s.text}</sub>
        : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}
