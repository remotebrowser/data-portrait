import { useEffect, useRef, useState } from 'react';
import type { BrandConfig } from '../modules/Config.js';
import type { PurchaseHistory } from '../modules/DataTransformSchema.js';
import { transformData } from '../modules/DataTransformSchema.js';
import { Button } from '@/components/ui/button.js';
import { FollowUpForm } from './FollowUpForm.js';

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
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const [signinData, setSigninData] = useState<SigninData | null>(null);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);

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
    setShowFollowUpForm(false);
    const initial: Record<string, string> = {};
    brandConfig.schema
      .filter((field) => field.type !== 'click')
      .forEach((field) => {
        initial[field.name] = '';
      });
    setCredentials(initial);
  }, [isOpen, brandConfig]);

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
        body: new URLSearchParams(credentials),
      });

      const responseText = await response.text();
      const isFinished = responseText.includes(
        'Finished! You can close this window now'
      );

      if (!response.ok) {
        setPollingError(`Sign in failed: ${responseText}`);
        setLoadingState(null);
      } else if (!isFinished) {
        setShowFollowUpForm(true);
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
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={onClose}
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
          ) : showFollowUpForm ? (
            <>
              <h3 className="text-lg font-medium text-center leading-6 text-gray-900 mb-4">
                Additional Verification Required
              </h3>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Please complete the verification process below
              </p>
              <FollowUpForm
                signinUrl={signinData?.url}
                onFinishSignin={(signinId) => {
                  console.log('Follow-up form completed', { signinId });
                }}
              />
            </>
          ) : loadingState ? (
            <div className="text-center">
              <p className="text-gray-700 mb-4 font-medium">
                {loadingState === 'CONNECTING'
                  ? 'Establishing connection...'
                  : loadingState === 'SIGNING_IN'
                    ? 'Signing in...'
                    : 'Retrieving your data...'}
              </p>
              <div className="mt-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {brandConfig.schema
                .filter((field) => field.type !== 'click')
                .map((field) => (
                  <div key={field.name}>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      {field.prompt}
                    </label>
                    <input
                      id={field.name}
                      type={field.type}
                      value={credentials[field.name] || ''}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          [field.name]: e.target.value,
                        })
                      }
                      placeholder={`Enter your ${(field.prompt || '').toLowerCase()}`}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-base text-gray-900 placeholder-gray-400"
                      required
                      autoFocus
                    />
                  </div>
                ))}

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
                  disabled={
                    !brandConfig.schema
                      .filter((f) => f.type !== 'click')
                      .every((f) => credentials[f.name]?.trim())
                  }
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
