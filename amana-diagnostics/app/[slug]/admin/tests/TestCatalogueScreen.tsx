'use client';
import { useCallback, useEffect, useState } from 'react';
import { RiPriceTag3Line, RiTestTubeLine } from '@remixicon/react';

import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import TestManager from '@/components/TestManager';
import { PriceList } from '@/components/features/catalogue/PriceList';
import { useShellSlot } from '@/components/shell/ShellSlot';
import { TabPanel, Tabs } from '@/components/ui';
import { TEST_CATALOGUE, Test, TestPrice, fetchCustomTests, fetchTestPrices } from '@/lib/store';

import styles from './testCatalogue.module.css';

type ScreenTab = 'catalogue' | 'prices';

/** The tab this route was opened on, from ?tab=prices or ?tab=pending — read
 * once, directly off the URL, so a bookmark or an email link can land on
 * either the price list or the catalogue's "awaiting a price" view without
 * pulling in useSearchParams (and the Suspense boundary it would need) for a
 * value that is only ever read at mount. */
function tabFromLocation(): { screen: ScreenTab; catalogue: 'catalogue' | 'pending' } {
  if (typeof window === 'undefined') return { screen: 'catalogue', catalogue: 'catalogue' };
  const raw = new URLSearchParams(window.location.search).get('tab');
  return {
    screen: raw === 'prices' ? 'prices' : 'catalogue',
    catalogue: raw === 'pending' ? 'pending' : 'catalogue',
  };
}

function AdminTestsPage() {
  const { organization, profile } = useAuth();
  const [initial] = useState(tabFromLocation);
  const [tab, setTab] = useState<ScreenTab>(initial.screen);

  const [catalogue, setCatalogue] = useState<Test[]>([]);
  const [prices, setPrices] = useState<TestPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Owned here rather than by either tab, so a price entered in the
  // Investigations form and a price entered in the Price list grid are
  // always looking at, and writing to, the same numbers.
  const loadPrices = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingPrices(true);
    try {
      const [priceRows, customTests] = await Promise.all([
        fetchTestPrices(organization.id),
        fetchCustomTests(organization.id),
      ]);
      setPrices(priceRows);

      const merged = [...TEST_CATALOGUE];
      customTests.forEach((ct) => {
        const idx = merged.findIndex((t) => t.id === ct.id);
        if (idx !== -1) {
          if (ct.is_active === false) merged.splice(idx, 1);
          else merged[idx] = ct;
        } else if (ct.is_active !== false) {
          merged.push(ct);
        }
      });
      setCatalogue(merged);
    } finally {
      setLoadingPrices(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  // The shell owns the page heading; the sentence under it is the screen's.
  useShellSlot(
    { subtitle: 'What each investigation is called, what it is taken from, what it costs, and what a referrer earns on it.' },
    [],
  );

  return (
    <div className={styles.page}>
      {organization?.id ? (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ScreenTab)}
          ariaLabel="Catalogue sections"
          items={[
            { value: 'catalogue', label: 'Investigations', icon: <RiTestTubeLine size={16} /> },
            { value: 'prices', label: 'Price list', icon: <RiPriceTag3Line size={16} /> },
          ]}
        >
          <TabPanel value="catalogue" keepMounted hidden={tab !== 'catalogue'}>
            <TestManager
              organizationId={organization.id}
              prices={prices}
              onPricesChanged={loadPrices}
              initialTab={initial.catalogue}
            />
          </TabPanel>
          <TabPanel value="prices" keepMounted hidden={tab !== 'prices'}>
            <PriceList
              organizationId={organization.id}
              catalogue={catalogue}
              prices={prices}
              loading={loadingPrices}
              actorId={profile?.id ?? null}
              actorName={profile?.full_name ?? null}
              onSaved={loadPrices}
            />
          </TabPanel>
        </Tabs>
      ) : (
        <p className={styles.waiting} role="status" aria-live="polite">
          Loading workspace details…
        </p>
      )}
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GuardedAdminTestsPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <AdminTestsPage {...props} />
    </RequireRole>
  );
}
