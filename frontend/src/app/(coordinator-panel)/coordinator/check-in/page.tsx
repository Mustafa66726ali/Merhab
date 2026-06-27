import CheckInView from "@/components/checkin/CheckInView";

export default function CoordinatorCheckInPage() {
  return (
    <CheckInView
      redirectPath="/coordinator/seating"
      description="امسح رمز QR الخاص بالضيف لاعتماد وصوله، أو سجّل الحضور يدوياً."
    />
  );
}
