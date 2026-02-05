import { Request } from 'express';
import { City, WebServiceClient } from '@maxmind/geoip2-node';
import { ServerLogger } from '../utils/logger/index.js';
import { settings } from '../config.js';
export interface LocationData {
  ip: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}
class GeolocationService {
  private ipCache: Map<string, City>;

  constructor() {
    this.ipCache = new Map();
  }

  getClientIp(request: Request): string {
    const xff = request.headers['x-forwarded-for'];
    if (xff && typeof xff === 'string') {
      return xff.split(',')[0].trim();
    }

    return request.ip || request.connection.remoteAddress || 'unknown';
  }

  getClientLocationFromCache(ipAddress: string) {
    const cachedLocationData = this.ipCache.get(ipAddress);
    ServerLogger.debug('Retrieved cached location data', {
      component: 'geolocation-service',
      operation: 'get-from-cache',
      ipAddress,
    });
    if (!cachedLocationData) {
      return null;
    }

    let requestLocationData: LocationData = {
      ip: ipAddress,
      city: null,
      state: null,
      country: null,
      postal_code: null,
    };
    if (cachedLocationData) {
      requestLocationData = {
        ...requestLocationData,
        city: cachedLocationData?.city?.names.en ?? null,
        state:
          cachedLocationData?.subdivisions?.[
            cachedLocationData.subdivisions.length - 1
          ]?.names.en ?? null,
        country: cachedLocationData?.country?.isoCode ?? null,
        postal_code: cachedLocationData?.postal?.code ?? null,
      };

      ServerLogger.debug('Client location resolved', {
        component: 'geolocation-service',
        operation: 'resolve-location',
        ...requestLocationData,
      });
    }
    return requestLocationData;
  }

  async getClientLocation(ipAddress: string): Promise<City | null> {
    ServerLogger.debug('Getting client location', {
      component: 'geolocation-service',
      operation: 'get-location',
      ipAddress,
    });

    if (
      ipAddress === 'unknown' ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1'
    ) {
      return null;
    }

    const cached = this.ipCache.get(ipAddress);
    if (cached) {
      ServerLogger.debug('Using cached location response', {
        component: 'geolocation-service',
        operation: 'get-location',
        ipAddress,
      });
      return cached;
    }

    // MaxMind API call with built-in timeout
    if (!settings.MAXMIND_ACCOUNT_ID || !settings.MAXMIND_LICENSE_KEY) {
      ServerLogger.warn('MaxMind account ID or license key not configured', {
        component: 'geolocation-service',
        operation: 'initialization',
      });
      return null;
    }

    try {
      const client = new WebServiceClient(
        settings.MAXMIND_ACCOUNT_ID,
        settings.MAXMIND_LICENSE_KEY,
        { timeout: 3000 } // 3 second timeout
      );

      const response = await client.city(ipAddress);
      this.ipCache.set(ipAddress, response);
      ServerLogger.debug('Cached location response', {
        component: 'geolocation-service',
        operation: 'cache-set',
        ipAddress,
      });
      return response;
    } catch (error) {
      ServerLogger.error('Error geolocating IP', error as Error, {
        component: 'geolocation-service',
        operation: 'get-location',
        ipAddress,
      });
      return null;
    }
  }
}

const geolocationService = new GeolocationService();

export { geolocationService, GeolocationService };
