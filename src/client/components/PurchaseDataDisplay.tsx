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
  connectedBrands: string[];
  expandedOrders: Set<string>;
  onToggleOrderExpansion: (orderId: string, productName: string) => void;
  onClearData: () => void;
};

export function PurchaseDataDisplay({
  orders,
  connectedBrands,
  expandedOrders,
  onToggleOrderExpansion,
  onClearData,
}: PurchaseDataDisplayProps) {
  const groupedOrdersByBrand = useMemo(() => {
    const grouped = orders.reduce(
      (acc, order) => {
        const brand = order.brand;
        if (!acc[brand]) {
          acc[brand] = [];
        }
        acc[brand].push(order);
        return acc;
      },
      {} as Record<string, PurchaseHistory[]>
    );

    // Sort orders within each brand by date (newest first)
    Object.keys(grouped).forEach((brand) => {
      grouped[brand].sort((a, b) => {
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
              products extracted from {connectedBrands.length}{' '}
              {connectedBrands.length === 1 ? 'data source' : 'data sources'} •
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
          {Object.entries(groupedOrdersByBrand).map(([brand, brandOrders]) => {
            const totalItems = brandOrders.reduce(
              (total, order) => total + order.product_names.length,
              0
            );
            const brandKey = `${brand}__brand`;
            const isExpanded = expandedOrders.has(brandKey);

            return (
              <div key={brand}>
                <div className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => onToggleOrderExpansion(brand, 'brand')}
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
                          {brand}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {totalItems} {totalItems === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {brandOrders.flatMap((order) =>
                          order.product_names.map((productName, index) => (
                            <div
                              key={`${order.order_id}_${productName}_${index}`}
                              className="flex items-start gap-2 py-2 px-1 bg-gray-50 rounded"
                            >
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
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>🛍️ {order.brand}</span>
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
                          ))
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
            💡 Your data helps us understand your style preferences for creating
            personalized AI portraits.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
