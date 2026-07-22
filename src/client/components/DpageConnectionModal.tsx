import { useEffect, useRef, useState } from 'react';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';
import { toPurchaseHistory } from '../modules/DataTransformSchema.js';
import { logger } from '@/utils/logger/index.js';
import { Button } from '@/components/ui/button.js';

type DpageConnectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccessConnect: (data: PurchaseHistory[]) => void;
  brandConfig: BrandConfig;
};

type BrowserTarget = { browserId: string; pageId: string };

const POLL_INTERVAL_MS = 3000;

export function DpageConnectionModal({
  isOpen,
  onClose,
  onSuccessConnect,
  brandConfig,
}: DpageConnectionModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<BrowserTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guard against React StrictMode's double-invoked effect creating two browsers.
  const connectStartedRef = useRef(false);

  // Keep latest callbacks without retriggering the poll effect.
  const callbacks = useRef({ onClose, onSuccessConnect });
  callbacks.current = { onClose, onSuccessConnect };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) dialog.showModal();
    else dialog.close();
  }, [isOpen]);

  // Create the remote browser + open the review list once per open.
  useEffect(() => {
    if (!isOpen) return;
    // StrictMode invokes effects twice on mount; the ref guard ensures we POST
    // /connect exactly once (no orphaned second browser). We deliberately do NOT
    // gate the result on a per-run "cancelled" flag — StrictMode's cleanup would
    // set it and then swallow the sole fetch's result, leaving the modal stuck
    // on "Establishing connection...". setState setters are stable across the
    // remount, so the result reaches the live instance.
    if (connectStartedRef.current) return;
    connectStartedRef.current = true;

    (async () => {
      try {
        const res = await fetch(
          `/getgather/dpage/${brandConfig.brand_id}/connect`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BrowserTarget;
        setTarget(data);
      } catch (err) {
        logger.error('Failed to start connection', err as Error, {
          component: 'dpage-connection-modal',
          brandId: brandConfig.brand_id,
        });
        setError('Failed to start connection. Please try again.');
      }
    })();
  }, [isOpen, brandConfig.brand_id]);

  // Poll for the distilled book list until sign-in completes.
  useEffect(() => {
    if (!target) return;
    let stopped = false;
    const { browserId, pageId } = target;

    (async () => {
      while (!stopped) {
        try {
          const res = await fetch(
            `/getgather/dpage/${brandConfig.brand_id}/poll`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ browser_id: browserId, page_id: pageId }),
            }
          );
          if (res.ok) {
            const data = (await res.json()) as {
              status?: string;
              content?: unknown[];
            };
            if (data.status === 'SUCCESS') {
              const purchaseHistory = toPurchaseHistory(
                (data.content ?? []) as object[],
                brandConfig
              );
              stopped = true;
              callbacks.current.onSuccessConnect(purchaseHistory);
              callbacks.current.onClose();
              void fetch(
                `/getgather/dpage/${brandConfig.brand_id}/finalize`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    browser_id: browserId,
                    page_id: pageId,
                  }),
                }
              );
              return;
            }
          }
        } catch (err) {
          logger.error('dpage poll error', err as Error, {
            component: 'dpage-connection-modal',
            brandId: brandConfig.brand_id,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    })();

    return () => {
      stopped = true;
    };
    // brandConfig comes from parent state and is stable for the modal's lifetime.
  }, [target, brandConfig]);

  return (
    <dialog
      onClose={onClose}
      ref={dialogRef}
      className="m-0 p-0 bg-transparent w-full h-full max-w-full max-h-full backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl p-8 border border-gray-200 shadow-xl"
          onClick={(e) => e.stopPropagation()}
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

          {error ? (
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          ) : target ? (
            <iframe
              src={`/getgather/dpage/frame/${target.browserId}/${target.pageId}`}
              sandbox="allow-same-origin allow-scripts allow-forms"
              title={`${brandConfig.brand_name} sign in`}
              className="w-full h-[420px] rounded-xl border border-gray-200"
            />
          ) : (
            <div className="text-center">
              <p className="text-gray-700 mb-4 font-medium">
                Establishing connection...
              </p>
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
