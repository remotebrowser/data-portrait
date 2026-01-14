import { useEffect, useRef, useState } from 'react';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';
import { transformData } from '../modules/DataTransformSchema.js';
import { Button } from '@/components/ui/button.js';

type SignInDialogProps = {
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

export function SignInDialog({
  isOpen,
  onClose,
  onSuccessSignin,
  brandConfig,
}: SignInDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const [signinData, setSigninData] = useState<SigninData | null>(null);

  const loadPurchaseDataStream = async () => {
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
    } catch (error) {
      console.error('Error loading purchase data stream', error);
      setPollingError(
        error instanceof Error ? error.message : 'Failed to load purchase data'
      );
      setLoadingState(null);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }

    setSigninData(null);
    setPollingError(null);
    setLoadingState(null);
    setCredentials({ email: '', password: '' });
  }, [isOpen]);

  const pollSigninStatus = async () => {
    if (!signinData) return;

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

          setLoadingState('RETRIEVING_DATA');
          onClose();
          onSuccessSignin(purchaseHistory);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Polling error', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  const submitCredentials = async () => {
    if (!signinData) return;

    setLoadingState('SIGNING_IN');

    try {
      const response = await fetch(signinData.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const responseText = await response.text();
      const isFinished = responseText.includes(
        'Finished! You can close this window now'
      );

      if (!response.ok) {
        setPollingError(`Sign in failed: ${responseText}`);
        setLoadingState(null);
      } else if (!isFinished) {
        setLoadingState('SIGNING_IN');
        pollSigninStatus();
      } else {
        pollSigninStatus();
      }
    } catch (error) {
      console.error('Error submitting credentials', error);
      setPollingError(
        error instanceof Error ? error.message : 'Failed to submit credentials'
      );
      setLoadingState(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingState('CONNECTING');

    try {
      await loadPurchaseDataStream();
    } catch (error) {
      console.error('Error starting connection', error);
      setPollingError('Failed to start connection. Please try again.');
      setLoadingState(null);
    }
  };

  useEffect(() => {
    if (!signinData || loadingState !== 'CONNECTING') return;
    submitCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signinData, loadingState]);

  return (
    <dialog
      onClose={onClose}
      ref={dialogRef}
      className="m-0 p-0 bg-transparent w-full h-full max-w-full max-h-full backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={onClose}
        style={{ zIndex: 0 }}
      >
        <div
          className="w-full max-w-md bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 shadow-xl"
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

          <h3 className="text-xl font-semibold text-center leading-6 text-white mb-6">
            Connect to {brandConfig.brand_name}
          </h3>

          {pollingError ? (
            <div className="text-center">
              <p className="text-red-400 mb-4">{pollingError}</p>
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
          ) : loadingState ? (
            <div className="text-center">
              <p className="text-gray-200 mb-4 font-medium">
                {loadingState === 'CONNECTING'
                  ? 'Establishing connection...'
                  : loadingState === 'SIGNING_IN'
                    ? 'Signing in...'
                    : 'Retrieving your data...'}
              </p>
              <div className="mt-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter your email"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-base text-white placeholder-gray-500 autofill:shadow-[inset_0_0_0px_1000px_rgb(31,41,55)] autofill:[-webkit-text-fill-color:white]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      password: e.target.value,
                    })
                  }
                  placeholder="Enter your password"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-base text-white placeholder-gray-500 autofill:shadow-[inset_0_0_0px_1000px_rgb(31,41,55)] autofill:[-webkit-text-fill-color:white]"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!credentials.email || !credentials.password}
                  className="flex-1"
                >
                  Connect
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
