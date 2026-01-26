import { Button } from '@/components/ui/button.js';

type EmptyStateProps = {
  onLoadSampleData: () => void;
  onOpenSidebar: () => void;
};

export function EmptyState({
  onLoadSampleData,
  onOpenSidebar,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center">
        <svg
          className="w-12 h-12 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <div className="space-y-3 max-w-md">
        <h2 className="text-2xl font-bold text-gray-900">
          Create Your Data Portrait
        </h2>
        <p className="text-gray-600 leading-relaxed">
          Connect your accounts to generate personalized AI images based on what
          you read and buy.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-lg">
        <h3 className="font-semibold text-blue-900 mb-3">Get Started:</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>Connect to Amazon, Wayfair, GoodReads, or GoFood</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>Your data helps create personalized portraits</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>Generate unique AI images based on your style</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={onOpenSidebar} className="lg:hidden" size="lg">
          Connect Your Data
        </Button>
        <Button onClick={onLoadSampleData} variant="outline" size="lg">
          Try Sample Data
        </Button>
        <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
          <span>👉</span>
          <span>Use the sidebar to connect your accounts</span>
        </div>
      </div>
    </div>
  );
}
