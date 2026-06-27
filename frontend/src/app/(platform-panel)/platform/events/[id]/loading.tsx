export default function EventLoading() {
  return (
    <div className="flex justify-center py-20">
      <span
        className="animate-spin w-9 h-9 border-4 border-primary-container border-t-transparent rounded-full"
        aria-label="جاري التحميل"
      />
    </div>
  );
}
