import { ClientLogger } from '../../utils/logger/client.js';

export type PurchaseHistory = {
  brand: string;
  order_date?: Date | null;
  order_total: string;
  order_id: string;
  product_names: string[];
  image_urls: string[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type DataFieldMapping = {
  /** The key name in the output object */
  outputKey: string;
  /** JSONPath-like string to extract value from source data */
  sourcePath: string;
  /** Optional transformation function name */
  transform?: 'currency' | 'date' | 'image' | 'string' | 'array';
  /** Default value if source path is not found or is undefined */
  defaultValue?: string;
  /** Format template for currency transform */
  formatTemplate?: string;
  /** Convert the value to an array */
  convertToArray?: boolean;
};

export type DataTransformSchema = {
  /** JSONPath to the array of items to transform */
  dataPath: string;
  /** Field mappings for transformation */
  fieldMappings: DataFieldMapping[];
};

/**
 * Get nested property value using dot notation path with numeric array indexing
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check if key is numeric and current is an array
    const numericIndex = parseInt(key, 10);
    if (!isNaN(numericIndex) && Array.isArray(current)) {
      return current[numericIndex];
    }

    if (isNaN(numericIndex) && Array.isArray(current)) {
      return current.map((item) => item[key]);
    }

    // Get the property value
    let value = current[key];

    // Auto-parse JSON strings when they look like JSON
    if (
      typeof value === 'string' &&
      (value.startsWith('{') || value.startsWith('['))
    ) {
      try {
        value = JSON.parse(value);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // If parsing fails, return the string as-is
      }
    }

    return value !== undefined ? value : undefined;
  }, obj);
}

export function parseOrderDate(orderDateStr: string) {
  // Match pattern like "Ordered On: June 4, 2025Wayfair Order #4325262636"
  const orderMatch = orderDateStr.match(/Ordered On:\s*(\w+ \d+, \d+)/i);
  if (orderMatch) {
    return new Date(orderMatch[1]);
  }

  return null;
}

function parseReturnDate(returnDateStr: string) {
  const match = returnDateStr.match(/closed on (\w+ \d+, \d+)/);
  if (match) {
    return new Date(match[1]);
  }
  return null;
}

/**
 * Apply transformation based on transform type
 */
function applyTransform(
  value: any,
  mapping: DataFieldMapping
): string | (string | Date)[] | Date {
  if (value === undefined || value === null) {
    if (mapping.convertToArray) {
      return [mapping.defaultValue || ''];
    }
    return mapping.defaultValue || '';
  }

  const getValue = () => {
    switch (mapping.transform) {
      case 'currency':
        if (typeof value === 'object' && value.currency && value.amount) {
          const template = mapping.formatTemplate || '{symbol}{amount}';
          return template
            .replace('{symbol}', value.currency.symbol || '$')
            .replace('{amount}', value.amount || '0.00');
        }
        return String(value);

      case 'string':
        if (mapping.formatTemplate) {
          if (mapping.formatTemplate.includes('{value}')) {
            return mapping.formatTemplate.replace('{value}', String(value));
          }
          if (mapping.formatTemplate.includes('${value}')) {
            return mapping.formatTemplate.replace('${value}', String(value));
          }
        }
        return String(value);

      case 'image':
        // Handle array of images
        if (Array.isArray(value)) {
          return value
            .filter((img) => img && typeof img === 'string')
            .map(String);
        }
        return String(value);

      case 'date':
        if (Array.isArray(value)) {
          return value.map((v) => {
            if (typeof v === 'string') {
              const orderDateParsed = parseOrderDate(v);
              if (orderDateParsed) {
                return orderDateParsed;
              }

              const returnDateParsed = parseReturnDate(v);
              if (returnDateParsed) {
                return returnDateParsed;
              }

              return new Date(v);
            }
            return v;
          });
        }

        if (typeof value === 'string') {
          const orderDateParsed = parseOrderDate(value);
          if (orderDateParsed) {
            return orderDateParsed;
          }

          const returnDateParsed = parseReturnDate(value);
          if (returnDateParsed) {
            return returnDateParsed;
          }

          return new Date(value);
        }

        if (typeof value === 'object' && value.displayDate) {
          return String(value.displayDate);
        }
        return new Date(value);
      case 'array':
        if (Array.isArray(value)) {
          return value.map(String);
        }
        return [String(value)];
      default:
        if (Array.isArray(value)) {
          return value.map(String);
        }
        return String(value);
    }
  };

  const result = getValue();

  if (mapping.convertToArray) {
    return Array.isArray(result) ? result : [result];
  }

  return result;
}

/**
 * Transform raw data using schema configuration
 */
export function transformData(
  rawData: Array<object> | object,
  schema: DataTransformSchema
): { [key: string]: string | (string | Date)[] | Date }[] {
  try {
    const logger = new ClientLogger();
    // Handle both pre-processed arrays and raw objects that need path extraction.
    // Some data sources (like MCP calls) return pre-processed arrays,
    // while others (like Wayfair GraphQL) require extracting data using schema.dataPath
    let dataArray: Array<any>;
    if (Array.isArray(rawData)) {
      dataArray = rawData;
    } else {
      dataArray = getNestedValue(rawData, schema.dataPath);
    }

    if (!Array.isArray(dataArray)) {
      // Log warning for data transformation issues
      logger.warn('Data path does not resolve to an array', {
        component: 'data-transform-schema',
        dataPath: schema.dataPath,
      });
      return [];
    }

    // Transform each item according to field mappings
    return dataArray.map((item: any) => {
      const transformedItem: {
        [key: string]: string | (string | Date)[] | Date;
      } = {};
      schema.fieldMappings.forEach((mapping) => {
        const rawValue = getNestedValue(item, mapping.sourcePath);
        transformedItem[mapping.outputKey] = applyTransform(rawValue, mapping);
      });
      return transformedItem;
    });
  } catch (error) {
    // Log error for data transformation issues
    logger.error('Error transforming data', error as Error, {
      component: 'data-transform-schema',
    });
    return [];
  }
}
