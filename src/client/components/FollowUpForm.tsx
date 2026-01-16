import { useEffect, useRef, useState } from 'react';

type FollowUpFormProps = {
  signinUrl?: string;
  onFinishSignin?: (signinId: string) => void;
};

export function FollowUpForm({ signinUrl, onFinishSignin }: FollowUpFormProps) {
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !signinUrl) return;

    const handleLoad = () => {
      setIsIframeLoaded(true);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [signinUrl]);

  return (
    <div className="relative bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
      {(!isIframeLoaded || !signinUrl) && (
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            <p className="text-sm text-gray-300">Loading sign in form...</p>
          </div>
        </div>
      )}
      {!!signinUrl && (
        <iframe
          ref={iframeRef}
          src={signinUrl}
          className={`w-full border-0 rounded-lg transition-opacity duration-300 ${
            isIframeLoaded ? 'h-96 opacity-100' : 'h-0 opacity-0'
          }`}
          title="Sign in form"
        />
      )}
    </div>
  );
}
