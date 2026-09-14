import { redirect } from 'next/navigation';

/**
 * The facilities list has moved to the unified Referrers screen.
 *
 * Any bookmark or external link to /admin/referrals/facilities still works —
 * Next.js will serve this redirect before the browser renders anything.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/admin/referrals`);
}
