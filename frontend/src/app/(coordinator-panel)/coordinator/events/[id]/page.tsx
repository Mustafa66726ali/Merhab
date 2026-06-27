import { redirect } from "next/navigation";

export default async function CoordinatorEventRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/coordinator/events/${id}/seating`);
}
