import WorkspaceFrame from './WorkspaceFrame';

/**
 * A server component, so the workspace subtree has a static shell that renders
 * before any of its JavaScript arrives, and so each screen below can name
 * itself in the browser tab. Every route in the product used to carry the same
 * title, which made the back button and a row of pinned tabs useless.
 */
export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
