import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { router } from './routes.js';

import './styles.css';

async function getSentryConfig(): Promise<{
  dsn?: string;
  environment?: string;
} | null> {
  try {
    const response = await fetch('/getgather/config');
    if (response.ok) {
      const data = await response.json();
      return { dsn: data.sentry?.dsn, environment: data.sentry?.environment };
    }
  } catch {
    // Silently fail - Sentry is optional
  }
  return null;
}

async function initializeSentry() {
  const sentryConfig = await getSentryConfig();

  Sentry.init({
    dsn: sentryConfig?.dsn || import.meta.env.VITE_SENTRY_DSN,
    environment: sentryConfig?.environment || import.meta.env.MODE,
    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration(),
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
    ],
    debug: import.meta.env.MODE !== 'production',
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (import.meta.env.MODE !== 'production') {
        if (
          event.exception?.values?.[0]?.value?.includes(
            'Failed to retrieve data'
          )
        ) {
          return null;
        }
      }
      return event;
    },
  });
}

async function initializeApp() {
  await initializeSentry();
}

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp().then(() => {
      setIsInitialized(true);
    });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Sentry.ErrorBoundary
      fallback={() => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              We have been notified about this error.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload page
            </button>
          </div>
        </div>
      )}
    >
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
