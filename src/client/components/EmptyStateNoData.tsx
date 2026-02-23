import { EmptyStateActions } from './EmptyState.js';

type EmptyStateNoDataProps = {
  visible?: boolean;
  connectedBrands: string[];
  onLoadSampleData: () => void;
  onOpenSidebar: () => void;
};

export function EmptyStateNoData({
  visible = false,
  connectedBrands,
  onLoadSampleData,
  onOpenSidebar,
}: EmptyStateNoDataProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-amber-50 to-orange-100 rounded-full flex items-center justify-center">
        <svg
          className="w-12 h-12 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>

      <div className="space-y-3 max-w-lg">
        <h2 className="text-2xl font-bold text-gray-900">No data yet</h2>
        <p className="text-gray-600 leading-relaxed">
          We don&apos;t see any data from your connected accounts. Connect
          another account or try sample data to generate your portrait.
        </p>
      </div>

      {connectedBrands.length > 0 && (
        <p className="text-sm text-gray-500">
          Connected: {connectedBrands.join(', ')}
        </p>
      )}

      <EmptyStateActions
        onOpenSidebar={onOpenSidebar}
        onLoadSampleData={onLoadSampleData}
      />
    </div>
  );
}
