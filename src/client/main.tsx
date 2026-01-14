import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { router } from './routes.js';

import './styles.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.PROD ? 'production' : 'development',
  tracesSampleRate: 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({
        error,
        resetError,
      }: {
        error: unknown;
        componentStack: string;
        eventId: string;
        resetError: () => void;
      }) => (
        <div className="p-4">
          <h1>Something went wrong</h1>
          <pre className="text-sm mt-2">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={resetError}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Try again
          </button>
        </div>
      )}
    >
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
