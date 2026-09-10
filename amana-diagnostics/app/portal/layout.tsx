import type { Metadata } from 'next';

export const metadata: Metadata = {
  /**
   * Portal screens name themselves inside the portal, not inside the product:
   * a patient's tab should read "Your results · Patient portal", not the name
   * of the software their clinic happens to run.
   */
  title: {
    default: 'Patient portal',
    template: '%s · Patient portal',
  },
  description: 'Securely access your diagnostic results and medical history.',
  /** A patient's results are not something a search engine should hold. */
  robots: { index: false, follow: false },
};

/**
 * The portal used to inject a <style> block here: a second `* { margin: 0 }`
 * reset that globals.css already does, a `body { background: #f4f6fb }` that
 * overrode the theme, an `input:focus` rule with `!important` that fought the
 * design system's focus ring, and a `button:hover { transform }` that lifted
 * every button in the component library by a pixel. All four are gone; the
 * portal screens style themselves through tokens like everything else.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
