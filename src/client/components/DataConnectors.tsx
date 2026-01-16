import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { DataSource } from './DataSource.js';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';

type DataConnectorsProps = {
  brands: BrandConfig[];
  connectedBrands: string[];
  onSuccessConnect: (brandName: string, data: PurchaseHistory[]) => void;
  onOpenSignInDialog: (brandConfig: BrandConfig) => void;
};

export function DataConnectors({
  brands,
  connectedBrands,
  onSuccessConnect,
  onOpenSignInDialog,
}: DataConnectorsProps) {
  return (
    <>
      {/* Data Connection Status Alert */}
      {connectedBrands.length > 0 ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Live Data Connected!</strong> {connectedBrands.length}{' '}
            {connectedBrands.length === 1 ? 'account' : 'accounts'} actively
            feeding real data.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Data Connector Ready!</strong> Connect to major consumer
            apps to unlock AI portraits powered by what you buy and read!.
          </AlertDescription>
        </Alert>
      )}

      {/* Data Connectors Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Live Data Connectors</h2>
            {connectedBrands.length > 0 && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <Badge
            variant={connectedBrands.length > 0 ? 'default' : 'secondary'}
            className={
              connectedBrands.length > 0
                ? 'bg-green-100 text-green-800 border-green-200'
                : ''
            }
          >
            {connectedBrands.length} Active
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {brands.map((brandConfig) => (
            <DataSource
              key={brandConfig.brand_id}
              brandConfig={brandConfig}
              onSuccessConnect={(data) =>
                onSuccessConnect(brandConfig.brand_name, data)
              }
              onOpenSignInDialog={onOpenSignInDialog}
              isConnected={connectedBrands.includes(brandConfig.brand_name)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
