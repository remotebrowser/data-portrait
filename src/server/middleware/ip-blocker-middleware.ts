import { Request, Response, NextFunction } from 'express';
import { ServerLogger } from '../utils/logger/index.js';
import { GeolocationService } from '../services/geolocation-service.js';

const blockedDomains = [
  // Amazon
  'amazonaws.com',
  'compute.amazonaws.com',

  // Google Cloud
  'google.com',
  'googleusercontent.com',
  'cloud.google.com',
  'gcp.gvt2.com',

  // Microsoft Azure
  'microsoft.com',
  'azure.com',
  'cloudapp.net',

  // Alibaba Cloud
  'alibaba.com',
  'aliyun.com',
  'alibabacloud.com',

  // DigitalOcean
  'digitalocean.com',

  // Oracle Cloud
  'oracle.com',
  'oraclecloud.com',

  // OVH
  'ovh.net',
  'ovhcloud.com',

  // Linode
  'linode.com',

  // Hetzner
  'hetzner.com',
  'hetzner.de',

  // Vultr
  'vultr.com',

  // Tencent Cloud
  'tencent.com',
  'tencentcloud.com',

  // IBM Cloud
  'ibm.com',
  'softlayer.com',

  'choopa.com', // Sometimes associated with scanning activity
  'leaseweb.com',
  'contabo.com',
  'cloudsigma.com',
];

export class IPBlockerMiddleware {
  private geolocationService: GeolocationService;

  constructor(geolocationService: GeolocationService) {
    this.geolocationService = geolocationService;
  }

  middleware = async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    ServerLogger.debug('IPBlockerMiddleware middleware called', {
      component: 'ip-blocker',
    });
    try {
      const clientIp = this.geolocationService.getClientIp(request);
      const locationData =
        await this.geolocationService.getClientLocation(clientIp);

      ServerLogger.debug('IPBlockerMiddleware checking domain', {
        component: 'ip-blocker',
        domain: locationData?.traits?.domain,
      });
      if (locationData?.traits?.domain) {
        const domain = locationData?.traits?.domain;

        if (
          blockedDomains.some((cloudDomain) =>
            domain.toLowerCase().includes(cloudDomain)
          )
        ) {
          const delay = 3000 + Math.random() * 5000;
          ServerLogger.warn(
            'IPBlockerMiddleware blocked cloud provider domain',
            {
              component: 'ip-blocker',
              domain,
              delay,
              operation: 'block-domain',
            }
          );
          setTimeout(() => {
            response.status(403).send('Access denied.');
          }, delay);
          return;
        }
      }

      next();
    } catch (error) {
      ServerLogger.error(
        'IPBlockerMiddleware middleware error',
        error as Error,
        {
          component: 'ip-blocker',
        }
      );
      next();
    }
  };
}
