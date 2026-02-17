import { useCallback, useEffect, useRef, useState } from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';
import { transformData } from '../modules/DataTransformSchema.js';
import { logger } from '@/utils/logger/index.js';
import { Button } from '@/components/ui/button.js';

type SignInDialogResourceProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccessSignin: (data: PurchaseHistory[]) => void;
  brandConfig: BrandConfig;
};

type LoadingState = 'CONNECTING' | 'SIGNING_IN' | 'RETRIEVING_DATA' | null;

type SigninData = {
  url: string;
  link_id: string;
};

type MCPResourceDetail = {
  uri?: string;
  mimeType?: string;
  text?: string;
  blob?: Blob;
  content?: unknown;
};

type MCPResourceItem = {
  type: string;
  resource: MCPResourceDetail;
};

export function SignInDialogResource({
  isOpen,
  onClose,
  onSuccessSignin,
  brandConfig,
}: SignInDialogResourceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loadedBrandIdRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const [signinData, setSigninData] = useState<SigninData | null>(null);
  const [resource, setResource] = useState<MCPResourceDetail | null>(null);

  const loadPurchaseDataStream = useCallback(async () => {
    try {
      const response = await fetch(
        `/getgather/dpage-url/${brandConfig.brand_id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setSigninData({
        url: data.hosted_link_url,
        link_id: data.link_id,
      });

      if (
        data.content &&
        Array.isArray(data.content) &&
        data.content.length > 0
      ) {
        const resourceItem = data.content.find(
          (item: MCPResourceItem) => item && item.type === 'resource'
        );
        if (resourceItem) {
          setResource(resourceItem.resource);
          setLoadingState(null);
        } else {
          setPollingError('No valid resource found in response');
          setLoadingState(null);
        }
      } else {
        setPollingError('No resource content found in response');
        setLoadingState(null);
      }
    } catch (error) {
      logger.error('Error loading purchase data stream', error as Error, {
        component: 'signin-dialog-resource',
        brandId: brandConfig.brand_id,
      });
      setPollingError(
        error instanceof Error ? error.message : 'Failed to load purchase data'
      );
      setLoadingState(null);
    }
  }, [brandConfig.brand_id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      const currentBrandId = brandConfig.brand_id;
      const shouldLoad = loadedBrandIdRef.current !== currentBrandId;
      if (shouldLoad) {
        setSigninData(null);
        setPollingError(null);
        setLoadingState('CONNECTING');
        setResource(null);
        loadPurchaseDataStream();
        loadedBrandIdRef.current = currentBrandId;
      }
    } else {
      dialog.close();
      setSigninData(null);
      setPollingError(null);
      setLoadingState(null);
      setResource(null);
      loadedBrandIdRef.current = null;
      isPollingRef.current = false;
    }
  }, [isOpen, brandConfig.brand_id, loadPurchaseDataStream]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      if (loadingState) {
        e.preventDefault();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [loadingState]);

  const pollSigninStatus = useCallback(async () => {
    if (!signinData) return;

    isPollingRef.current = true;

    while (true) {
      try {
        const pollResult = await fetch(
          `/getgather/dpage-signin-check/${brandConfig.brand_id}/${signinData.link_id}`
        );

        if (!pollResult.ok) {
          throw new Error(`HTTP error! status: ${pollResult.status}`);
        }

        const data = await pollResult.json();

        if (data.auth_completed) {
          const transformedData = transformData(
            data.content,
            brandConfig.dataTransform
          );
          const purchaseHistory = transformedData.map(
            (item: Record<string, unknown>) => ({
              brand: brandConfig.brand_name,
              order_date: (item.order_date as Date) || null,
              order_total: item.order_total as string,
              order_id: item.order_id as string,
              product_names: item.product_names as string[],
              image_urls: item.image_urls as string[],
            })
          );

          isPollingRef.current = false;
          setLoadingState('RETRIEVING_DATA');
          onClose();
          onSuccessSignin(purchaseHistory);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Polling error', error as Error, {
          component: 'signin-dialog-resource',
          brandId: brandConfig.brand_id,
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }, [signinData, brandConfig, onClose, onSuccessSignin]);

  useEffect(() => {
    if (isOpen && signinData) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }

      pollTimeoutRef.current = setTimeout(() => {
        pollSigninStatus();
      }, 3000);

      return () => {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
      };
    } else {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      isPollingRef.current = false;
    }
  }, [isOpen, signinData, pollSigninStatus]);

  return (
    <dialog
      onClose={onClose}
      ref={dialogRef}
      className="m-0 p-0 bg-transparent w-full h-full max-w-full max-h-full backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={
          loadingState || isPollingRef.current || resource
            ? undefined
            : onClose
        }
        style={{ zIndex: 0 }}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl p-8 border border-gray-200 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          style={{ zIndex: 1 }}
        >
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white rounded-lg p-2 w-12 h-12 flex items-center justify-center">
              <img
                src={brandConfig.logo_url}
                alt={`${brandConfig.brand_name} logo`}
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          <h3 className="text-xl font-semibold text-center leading-6 text-gray-900 mb-6">
            Connect to {brandConfig.brand_name}
          </h3>

          {pollingError ? (
            <div className="text-center">
              <p className="text-red-600 mb-4">{pollingError}</p>
              <Button
                onClick={() => {
                  setPollingError(null);
                  onClose();
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          ) : loadingState === 'RETRIEVING_DATA' ? (
            <div className="text-center">
              <p className="text-gray-700 mb-4 font-medium">
                Retrieving your data...
              </p>
              <div className="mt-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            </div>
          ) : loadingState === 'CONNECTING' || !resource ? (
            <div className="text-center">
              <p className="text-gray-700 mb-4 font-medium">
                Establishing connection...
              </p>
              <div className="mt-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <UIResourceRenderer
                resource={resource}
                htmlProps={{
                  sandboxPermissions:
                    'allow-same-origin allow-scripts allow-forms',
                }}
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
