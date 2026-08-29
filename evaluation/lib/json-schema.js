'use strict';

const fs = require('fs');
const path = require('path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function escapeLocationSegment(segment) {
  return /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(segment)
    ? `.${segment}`
    : `[${JSON.stringify(segment)}]`;
}

function calendarDateValid(year, month, day) {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function rfc3339DateValid(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  return Boolean(match && calendarDateValid(Number(match[1]), Number(match[2]), Number(match[3])));
}

function rfc3339DateTimeValid(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u);
  if (!match || !calendarDateValid(Number(match[1]), Number(match[2]), Number(match[3]))) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  // Leap seconds are intentionally rejected: the evaluator needs deterministic
  // ordering through JavaScript Date parsing, which does not represent :60.
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[7] !== 'Z' && (Number(match[9]) > 23 || Number(match[10]) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

function resolvePointer(document, fragment, source) {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) {
    throw new Error(`${source}: unsupported JSON Schema fragment ${fragment}`);
  }

  return decodeURIComponent(fragment.slice(2)).split('/').reduce((value, segment) => {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || !Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${source}: unresolved JSON pointer ${fragment}`);
    }
    return value[key];
  }, document);
}

class SchemaRegistry {
  constructor(schemaFiles = []) {
    this.documents = new Map();
    this.identifiers = new Map();
    for (const file of schemaFiles) this.add(file);
  }

  add(file) {
    const resolved = path.resolve(file);
    if (this.documents.has(resolved)) return this.documents.get(resolved);
    const document = readJson(resolved);
    this.documents.set(resolved, document);
    if (document.$id) {
      if (this.identifiers.has(document.$id) && this.identifiers.get(document.$id) !== resolved) {
        throw new Error(`duplicate JSON Schema identifier ${document.$id}`);
      }
      this.identifiers.set(document.$id, resolved);
    }
    return document;
  }

  get(file) {
    return this.add(file);
  }

  resolve(reference, currentFile) {
    const separator = reference.indexOf('#');
    const resource = separator === -1 ? reference : reference.slice(0, separator);
    const fragment = separator === -1 ? '' : reference.slice(separator);
    let targetFile = path.resolve(currentFile);

    if (resource) {
      if (this.identifiers.has(resource)) {
        targetFile = this.identifiers.get(resource);
      } else if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(resource)) {
        throw new Error(`${currentFile}: unregistered JSON Schema identifier ${resource}`);
      } else {
        targetFile = path.resolve(path.dirname(currentFile), resource);
      }
    }

    const document = this.get(targetFile);
    return {
      file: targetFile,
      schema: resolvePointer(document, fragment, targetFile)
    };
  }
}

function validateInstance(instance, schema, schemaFile, registry, location = '$') {
  if (schema === true) return [];
  if (schema === false) return [`${location}: is rejected by the false schema`];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`${schemaFile}: JSON Schema node at ${location} must be an object or boolean`);
  }

  const errors = [];

  if (schema.$ref) {
    const target = registry.resolve(schema.$ref, schemaFile);
    errors.push(...validateInstance(instance, target.schema, target.file, registry, location));
  }

  for (const child of schema.allOf || []) {
    errors.push(...validateInstance(instance, child, schemaFile, registry, location));
  }

  if (schema.anyOf) {
    const matches = schema.anyOf.filter(child =>
      validateInstance(instance, child, schemaFile, registry, location).length === 0
    ).length;
    if (matches === 0) errors.push(`${location}: must match at least one anyOf branch`);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter(child =>
      validateInstance(instance, child, schemaFile, registry, location).length === 0
    ).length;
    if (matches !== 1) errors.push(`${location}: must match exactly one oneOf branch (matched ${matches})`);
  }

  if (schema.if) {
    const conditionMatches = validateInstance(instance, schema.if, schemaFile, registry, location).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateInstance(instance, schema.then, schemaFile, registry, location));
    }
    if (!conditionMatches && schema.else) {
      errors.push(...validateInstance(instance, schema.else, schemaFile, registry, location));
    }
  }

  if (schema.not && validateInstance(instance, schema.not, schemaFile, registry, location).length === 0) {
    errors.push(`${location}: must not match the forbidden schema`);
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !deepEqual(instance, schema.const)) {
    errors.push(`${location}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some(item => deepEqual(instance, item))) {
    errors.push(`${location}: must be one of ${schema.enum.map(JSON.stringify).join(', ')}`);
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = valueType(instance);
    const matches = allowed.some(type => type === actual || (type === 'number' && actual === 'integer'));
    if (!matches) {
      errors.push(`${location}: expected ${allowed.join('|')}, got ${actual}`);
      return errors;
    }
  }

  if (typeof instance === 'string') {
    if (schema.minLength !== undefined && instance.length < schema.minLength) {
      errors.push(`${location}: string is shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
      errors.push(`${location}: string is longer than ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(instance)) {
      errors.push(`${location}: does not match ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && !rfc3339DateTimeValid(instance)) {
      errors.push(`${location}: is not an RFC 3339 date-time`);
    }
    if (schema.format === 'date' && !rfc3339DateValid(instance)) {
      errors.push(`${location}: is not an ISO 8601 date`);
    }
    if (schema.format === 'uri') {
      try {
        new URL(instance);
      } catch {
        errors.push(`${location}: is not an absolute URI`);
      }
    }
  }

  if (typeof instance === 'number') {
    if (schema.minimum !== undefined && instance < schema.minimum) {
      errors.push(`${location}: is below ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && instance > schema.maximum) {
      errors.push(`${location}: is above ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && instance <= schema.exclusiveMinimum) {
      errors.push(`${location}: is not greater than ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined && instance >= schema.exclusiveMaximum) {
      errors.push(`${location}: is not less than ${schema.exclusiveMaximum}`);
    }
  }

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) {
      errors.push(`${location}: has fewer than ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
      errors.push(`${location}: has more than ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const serialized = instance.map(item => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        errors.push(`${location}: items are not unique`);
      }
    }
    if (schema.items) {
      instance.forEach((item, index) => {
        errors.push(...validateInstance(item, schema.items, schemaFile, registry, `${location}[${index}]`));
      });
    }
  }

  if (instance && typeof instance === 'object' && !Array.isArray(instance)) {
    const properties = schema.properties || {};
    const patternProperties = schema.patternProperties || {};
    const keys = Object.keys(instance);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push(`${location}: has fewer than ${schema.minProperties} properties`);
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push(`${location}: has more than ${schema.maxProperties} properties`);
    }
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(instance, required)) {
        errors.push(`${location}: missing required property ${required}`);
      }
    }

    for (const key of keys) {
      const matchingPatterns = Object.entries(patternProperties)
        .filter(([pattern]) => new RegExp(pattern, 'u').test(key));
      const declared = Object.prototype.hasOwnProperty.call(properties, key);
      if (!declared && matchingPatterns.length === 0) {
        if (schema.additionalProperties === false) {
          errors.push(`${location}: unknown property ${key}`);
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          errors.push(...validateInstance(
            instance[key],
            schema.additionalProperties,
            schemaFile,
            registry,
            `${location}${escapeLocationSegment(key)}`
          ));
        }
      }
      for (const [, childSchema] of matchingPatterns) {
        errors.push(...validateInstance(
          instance[key],
          childSchema,
          schemaFile,
          registry,
          `${location}${escapeLocationSegment(key)}`
        ));
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(instance, key)) {
        errors.push(...validateInstance(
          instance[key],
          childSchema,
          schemaFile,
          registry,
          `${location}${escapeLocationSegment(key)}`
        ));
      }
    }
  }

  return errors;
}

module.exports = {
  SchemaRegistry,
  readJson,
  validateInstance
};
