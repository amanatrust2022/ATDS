import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { version } from '../../package.json';
import DownloadScreen from './DownloadScreen';

/**
 * Characterisation tests for the Local Hub download page.
 *
 * One job: hand a clinic the right installer. Everything else on the page is
 * there to make them comfortable clicking it. So what matters is that the link
 * is a real link, that it names the version actually being built, and that
 * nothing on the page says something about the product that is not true.
 *
 * Written before the rebuild. See decision #28.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => push.mockClear());

describe('The download page', () => {
  /**
   * The download was a <button> calling window.open(). A download is a link:
   * it should survive a popup blocker, be copyable from a right-click, and be
   * a download when the browser is asked to save it rather than a new tab.
   */
  it('offers the installer as a real link', () => {
    render(<DownloadScreen />);

    const links = screen.getAllByRole('link', { name: /download.*\.exe/i });
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a).toHaveAttribute('href', expect.stringMatching(/\.exe$/));
    }
  });

  /**
   * The version was typed into this file by hand — '1.2.20' — with nothing
   * keeping it in step with the build. The first release after that would have
   * sent every new clinic an old installer, from a page saying it was current.
   */
  it('links to the version that is actually being built', () => {
    render(<DownloadScreen />);

    const [exe] = screen.getAllByRole('link', { name: /download.*\.exe/i });
    expect(exe).toHaveAttribute('href', expect.stringContaining(`v${version}/`));
    expect(screen.getAllByText(new RegExp(version.replace(/\./g, '\\.'))).length).toBeGreaterThan(0);
  });

  it('offers the MSI as well', () => {
    render(<DownloadScreen />);
    const [msi] = screen.getAllByRole('link', { name: /\.msi/i });
    expect(msi).toHaveAttribute('href', expect.stringMatching(/\.msi$/));
  });

  /**
   * "All records stored on-site in an encrypted SQLite database." They are
   * not encrypted. There is no SQLCipher, no key, no at-rest encryption
   * anywhere in the codebase. Telling a clinic their patient records are
   * encrypted when they are a plain file on the desk is not marketing copy.
   */
  it('does not claim the database is encrypted', () => {
    render(<DownloadScreen />);
    expect(screen.queryByText(/encrypt/i)).not.toBeInTheDocument();
  });

  it('reaches the cloud sign-up from a real link, not a span', () => {
    render(<DownloadScreen />);

    // The one at the bottom was a <span onClick> with an underline drawn on.
    expect(screen.getByRole('link', { name: /create a free workspace/i })).toHaveAttribute('href', '/signup');
  });

  it('gets back to the landing page', () => {
    render(<DownloadScreen />);
    expect(screen.getAllByRole('link', { name: /home/i })[0]).toHaveAttribute('href', '/');
  });

  it('tells the reader the steps in order', () => {
    render(<DownloadScreen />);

    const list = screen.getByRole('list', { name: /install/i });
    expect(list.tagName).toBe('OL');
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });
});
