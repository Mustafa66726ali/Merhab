import CheckInView from "@/components/checkin/CheckInView";

export default function EntryManagerCheckInPage() {
  return (
    <CheckInView
      redirectPath="/entry-manager/account"
      description="امسح رمز QR الخاص بدعوة الضيف لاعتماد وصوله إلى البوابة."
    />
  );
}
