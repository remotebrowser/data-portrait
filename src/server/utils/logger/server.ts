import * as Sentry from '@sentry/node';

type LogContext = {
  component?: string;
  operation?: string;
  brandId?: string;
  browserSessionId?: string;
  signinId?: string;
  mcpSessionId?: string;
  [key: string]: unknown;
};

export class ServerLogger {
  static info(message: string, context?: LogContext) {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');

    try {
      // Check if logfire is available
      if (process.env.LOGFIRE_TOKEN) {
        const logfire = require('@pydantic/logfire-node');
        logfire.info(message, context || {});
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Logger.info] Logfire error:', error);
      }
    }
  }

  static warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');

    try {
      if (process.env.LOGFIRE_TOKEN) {
        const logfire = require('@pydantic/logfire-node');
        logfire.warning(message, context || {});
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Logger.warn] Logfire error:', error);
      }
    }
  }

  static error(message: string, error?: Error, context?: LogContext) {
    console.error(
      `[ERROR] ${message}`,
      error?.message || '',
      context ? JSON.stringify(context) : ''
    );

    try {
      if (process.env.LOGFIRE_TOKEN) {
        const logfire = require('@pydantic/logfire-node');
        logfire.error(message, { ...context, error: error?.message });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Logger.error] Logfire error:', err);
      }
    }

    Sentry.withScope((scope: Sentry.Scope) => {
      if (context?.component) scope.setTag('component', context.component);
      if (context?.operation) scope.setTag('operation', context.operation);
      if (context?.brandId) scope.setTag('brand_id', context.brandId);
      if (context?.browserSessionId)
        scope.setTag('browser_session_id', context.browserSessionId);
      if (context?.signinId) scope.setTag('sign_id', context.signinId);
      if (context?.mcpSessionId)
        scope.setTag('mcp_session_id', context.mcpSessionId);

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

  static debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[DEBUG] ${message}`,
        context ? JSON.stringify(context, null, 2) : ''
      );

      try {
        if (process.env.LOGFIRE_TOKEN) {
          const logfire = require('@pydantic/logfire-node');
          logfire.debug(message, context || {});
        }
      } catch (error) {
        // Silently fail if logfire is not configured
      }
    }
  }
}
