import { redirect } from 'next/navigation';

/**
 * Pricing moved into the catalogue screen, as its "Price list" tab — a test
 * and what it costs are the same fact, and used to live in two screens with
 * two save models. This keeps the old bookmark working.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/admin/tests?tab=prices`);
}
