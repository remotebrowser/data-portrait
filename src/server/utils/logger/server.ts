import * as Sentry from '@sentry/node';

export type LogContext = {
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
  }

  static warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  }

  static error(message: string, error?: Error, context?: LogContext) {
    console.error(
      `[ERROR] ${message}`,
      error?.message || '',
      context ? JSON.stringify(context) : ''
    );

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
    }
  }
}
