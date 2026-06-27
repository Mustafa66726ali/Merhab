import PlatformMemberProfileView from "@/components/platform-panel/PlatformMemberProfileView";

export default function PlatformUserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const userId = Number(params.id);
  return <PlatformMemberProfileView userId={userId} />;
}
