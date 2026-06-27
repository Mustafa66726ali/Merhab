import PlatformMemberForm from "@/components/platform-panel/PlatformMemberForm";

export default function PlatformUserEditPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = Number(params.id);
  return <PlatformMemberForm mode="edit" userId={userId} />;
}
