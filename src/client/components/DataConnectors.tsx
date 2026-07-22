import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { DataSource } from './DataSource.js';
import type { RetailerConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';

type DataConnectorsProps = {
  retailers: RetailerConfig[];
  connectedRetailers: string[];
  onSuccessConnect: (retailerName: string, data: PurchaseHistory[]) => void;
  onOpenSignInDialog: (retailerConfig: RetailerConfig) => void;
};

const ITEMS_PER_ROW = 3;

export function DataConnectors({
  retailers,
  connectedRetailers,
  onSuccessConnect,
  onOpenSignInDialog,
}: DataConnectorsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleRetailers = isExpanded ? retailers : retailers.slice(0, ITEMS_PER_ROW);
  const hasMoreRetailers = retailers.length > ITEMS_PER_ROW;

  const onToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Data Connection Status Alert */}
      {connectedRetailers.length > 0 ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Live Data Connected!</strong> {connectedRetailers.length}{' '}
            {connectedRetailers.length === 1 ? 'account' : 'accounts'} actively
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
            {connectedRetailers.length > 0 && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <Badge
            variant={connectedRetailers.length > 0 ? 'default' : 'secondary'}
            className={
              connectedRetailers.length > 0
                ? 'bg-green-100 text-green-800 border-green-200'
                : ''
            }
          >
            {connectedRetailers.length} Active
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {visibleRetailers.map((retailerConfig) => (
            <DataSource
              key={retailerConfig.retailer_id}
              retailerConfig={retailerConfig}
              onSuccessConnect={(data) =>
                onSuccessConnect(retailerConfig.retailer_name, data)
              }
              onOpenSignInDialog={onOpenSignInDialog}
              isConnected={connectedRetailers.includes(retailerConfig.retailer_name)}
            />
          ))}
        </div>

        {hasMoreRetailers && (
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="flex items-center gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Less Connectors
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show More Connectors ({retailers.length - ITEMS_PER_ROW} more)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
