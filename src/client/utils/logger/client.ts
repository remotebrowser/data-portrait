import * as Sentry from '@sentry/react';

type LogContext = {
  [key: string]: unknown;
};

export class ClientLogger {
  sessionId: string | null = null;

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  info(message: string, context?: LogContext) {
    Sentry.logger.info(`[INFO][${this.sessionId}] ${message}`, {
      context: context ? JSON.stringify(context) : '',
    });
  }

  warn(message: string, context?: LogContext) {
    Sentry.logger.warn(`[WARN][${this.sessionId}] ${message}`, {
      context: context ? JSON.stringify(context) : '',
    });
  }

  error(message: string, error?: Error, context?: LogContext) {
    Sentry.logger.error(`[ERROR][${this.sessionId}] ${message}`, {
      error: error?.message || '',
      context: context ? JSON.stringify(context) : '',
    });

    Sentry.withScope((scope: Sentry.Scope) => {
      if (context?.sessionId || this.sessionId) {
        scope.setTag(
          'browser_session_id',
          (context?.sessionId as string) || this.sessionId
        );
      }
      scope.setExtras({
        ...context,
        originalMessage: message,
      });

      if (error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(message, 'error');
      }
    });
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      Sentry.logger.debug(`[DEBUG] ${message}`, {
        context: context ? JSON.stringify(context) : '',
      });
    }
  }
}

export const logger = new ClientLogger();
