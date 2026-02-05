import { ClientLogger } from '@/utils/logger/client.js';

const logger = new ClientLogger();

export function log({
  message,
  data,
  type = 'client',
}: {
  message: string;
  data: any;
  type?: 'client' | 'server';
}) {
  if (type === 'client') {
    logger.info(message, data);
  } else {
    fetch('/getgather/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, data, type }),
    });
  }
}
