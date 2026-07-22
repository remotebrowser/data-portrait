import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';

type PurchaseDataDisplayProps = {
  orders: PurchaseHistory[];
  connectedRetailers: string[];
  expandedOrders: Set<string>;
  selectedItems: Set<string>;
  onToggleOrderExpansion: (orderId: string, productName: string) => void;
  onToggleItemSelection: (orderId: string, productName: string) => void;
  onToggleRetailerSelection: (retailer: string, selectAll: boolean) => void;
  onClearData: () => void;
};

export function PurchaseDataDisplay({
  orders,
  connectedRetailers,
  expandedOrders,
  selectedItems,
  onToggleOrderExpansion,
  onToggleItemSelection,
  onToggleRetailerSelection,
  onClearData,
}: PurchaseDataDisplayProps) {
  const groupedOrdersByRetailer = useMemo(() => {
    const grouped = orders.reduce(
      (acc, order) => {
        const retailer = order.retailer;
        if (!acc[retailer]) {
          acc[retailer] = [];
        }
        acc[retailer].push(order);
        return acc;
      },
      {} as Record<string, PurchaseHistory[]>
    );

    // Sort orders within each retailer by date (newest first)
    Object.keys(grouped).forEach((retailer) => {
      grouped[retailer].sort((a, b) => {
        return (
          (b.order_date ? new Date(b.order_date).getTime() : 0) -
          (a.order_date ? new Date(a.order_date).getTime() : 0)
        );
      });
    });

    return grouped;
  }, [orders]);

  if (orders.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Live Data Analysis</CardTitle>
            <CardDescription className="text-sm">
              {orders.reduce(
                (total, order) => total + order.product_names.length,
                0
              )}{' '}
              products extracted from {connectedRetailers.length}{' '}
              {connectedRetailers.length === 1 ? 'data source' : 'data sources'} •
              Analyzed for AI personalization patterns
            </CardDescription>
          </div>
          {orders.some((order) => order.order_id.startsWith('demo-')) && (
            <Button
              onClick={onClearData}
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear Demo Data
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {Object.entries(groupedOrdersByRetailer).map(([retailer, retailerOrders]) => {
            const totalItems = retailerOrders.reduce(
              (total, order) => total + order.product_names.length,
              0
            );
            const selectedCount = retailerOrders.reduce((count, order) => {
              return (
                count +
                order.product_names.filter((productName) =>
                  selectedItems.has(`${order.order_id}__${productName}`)
                ).length
              );
            }, 0);
            const allSelected = selectedCount === totalItems && totalItems > 0;
            const retailerKey = `${retailer}__retailer`;
            const isExpanded = expandedOrders.has(retailerKey);

            return (
              <div key={retailer}>
                <div className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => onToggleOrderExpansion(retailer, 'retailer')}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-gray-500" />
                      )}
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {retailer}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleRetailerSelection(retailer, !allSelected);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedCount}/{totalItems}{' '}
                        {totalItems === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {retailerOrders.flatMap((order) =>
                          order.product_names.map((productName, index) => {
                            const itemKey = `${order.order_id}__${productName}`;
                            const isSelected = selectedItems.has(itemKey);

                            return (
                              <div
                                key={`${order.order_id}_${productName}_${index}`}
                                onClick={() =>
                                  onToggleItemSelection(
                                    order.order_id,
                                    productName
                                  )
                                }
                                className={`flex items-start gap-2 py-2 px-1 rounded cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  <div
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                      isSelected
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && (
                                      <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 w-8 h-8 bg-white rounded overflow-hidden border">
                                  {order.image_urls?.[index] ? (
                                    <img
                                      src={order.image_urls[index]}
                                      alt={productName}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                      <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={1.5}
                                          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                        />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">
                                    {productName}
                                  </p>
                                  {order.product_description && (
                                    <p
                                      className="text-xs text-gray-600 mb-1 line-clamp-2"
                                      title={order.product_description}
                                    >
                                      {order.product_description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>🛍️ {order.retailer}</span>
                                    {!!order.order_date && (
                                      <span>
                                        📅{' '}
                                        {typeof order.order_date === 'string'
                                          ? order.order_date
                                          : order.order_date.toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            💡 Click items to select/deselect them. Only selected items will be
            used for portrait generation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
