export default function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 lg:p-10 border border-outline-variant/10 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-primary-container/15 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-primary text-3xl">construction</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">{title}</h1>
        <p className="text-on-surface-variant text-sm">{description}</p>
      </div>
    </div>
  );
}
