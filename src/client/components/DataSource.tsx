import { useAnalytics } from '../hooks/useAnalytics.js';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';

interface DataSourceProps {
  onSuccessConnect: (data: PurchaseHistory[]) => void;
  onOpenSignInDialog: (brandConfig: BrandConfig) => void;
  disabled?: boolean;
  brandConfig: BrandConfig;
  isConnected?: boolean;
}

export function DataSource({
  onOpenSignInDialog,
  disabled,
  brandConfig,
  isConnected,
}: DataSourceProps) {
  const { trackEvent } = useAnalytics();

  const handleConnect = () => {
    trackEvent('connection_attempt', {
      brand_name: brandConfig.brand_name,
    });
    onOpenSignInDialog(brandConfig);
  };

  return (
    <div
      className={`flex flex-col items-center justify-between w-20 min-h-32 p-3 space-y-1 relative`}
    >
      <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 flex-shrink-0">
        <img
          src={brandConfig.logo_url}
          alt={`${brandConfig.brand_name} logo`}
          className="w-8 h-8 object-contain"
        />
      </div>

      <div className="text-center h-9 flex flex-col justify-center flex-shrink-0">
        <h3 className="text-xs font-medium text-gray-900 leading-tight line-clamp-2">
          {brandConfig.brand_name}
        </h3>
        {brandConfig.is_mandatory && (
          <span className="text-xs text-gray-500 leading-tight">Required</span>
        )}
      </div>

      <div className="flex-shrink-0">
        {isConnected ? (
          <Badge variant="secondary" className="text-xs px-2 py-1">
            Connected
          </Badge>
        ) : (
          <Button
            disabled={disabled}
            onClick={handleConnect}
            size="sm"
            variant="outline"
            className="text-xs px-3 py-1 h-7"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
