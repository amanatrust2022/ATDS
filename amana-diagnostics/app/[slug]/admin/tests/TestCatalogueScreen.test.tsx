import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

/**
 * Characterisation tests for the test catalogue screen — the frame around
 * TestManager. Written before the rebuild (decision #28).
 */

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/TestManager', () => ({
  default: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="test-manager">{organizationId}</div>
  ),
}));

import TestCatalogueScreen from './TestCatalogueScreen';

describe('Test catalogue screen', () => {
  /**
   * Decision #30. The screen drew its own <h1> under the shell's, so the page
   * announced two headings — and it stretched itself to minHeight 100vh inside
   * a shell that already fills the window, which put a second scrollbar on the
   * admin area.
   */
  it('does not draw its own page heading (decision #30)', () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  /**
   * While the workspace was still resolving, the screen showed a line of grey
   * text that no screen reader was told about.
   */
  it('announces that it is still waiting for the workspace', () => {
    authState = { organization: null };
    render(<TestCatalogueScreen />);

    expect(screen.getByRole('status')).toHaveTextContent(/workspace/i);
  });

  // A behaviour guard: the catalogue editor gets the workspace it belongs to.
  // This held before.
  it('hands the workspace to the catalogue editor', () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.getByTestId('test-manager')).toHaveTextContent('org-1');
  });
});
