export default function PlatformLoading() {
  return (
    <div className="flex justify-center py-24">
      <span
        className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full"
        aria-label="جاري التحميل"
      />
    </div>
  );
}
