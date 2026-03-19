import { Request } from 'express';

class GeolocationService {
  getClientIp(request: Request): string {
    const xff = request.headers['x-forwarded-for'];
    if (xff && typeof xff === 'string') {
      return xff.split(',')[0].trim();
    }

    return request.ip || request.connection.remoteAddress || 'unknown';
  }
}

const geolocationService = new GeolocationService();

export { geolocationService, GeolocationService };
