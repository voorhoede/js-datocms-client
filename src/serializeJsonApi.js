import { camelize } from 'humps';
const diff = require('arr-diff');

function serializedAttributes(type, unserializedBody = {}, schema) {
  let attr;
  if (type === 'item') {
    attr = diff(Object.keys(unserializedBody), [
      'itemType', 'id', 'createdAt',
      'updatedAt', 'isValid', 'publishedVersion',
      'currentVersion',
    ]);
  } else {
    attr = attributes(type, schema);
  }
  const result = {};

  attr.forEach((attribute) => {
    if (unserializedBody.hasOwnProperty(camelize(attribute))) {
      result[attribute] = unserializedBody[camelize(attribute)];
    } else if (requiredAttributes(schema).includes(attribute)) {
      throw new Error(`Required attribute: ${attribute}`);
    }
  });
  return result;
}

function serializedRelationships(type, unserializedBody, schema) {
  const result = {};

  return Object.entries(relationships(type, schema)).reduce((acc, [relationship, meta]) => {
    if (unserializedBody.hasOwnProperty(camelize(relationship))) {
      const value = unserializedBody[camelize(relationship)];
      let data = {};

      if (value) {
        if (meta.collection) {
          value.forEach((id) => {
            data.type = meta.type;
            data.id = id;
          });
        } else {
          data.type = meta.type;
          data.id = value;
        }
      } else {
        data = null;
      }
      acc[relationship] = { data };
    } else if (requiredRelationships(schema).includes(relationship)) {
      throw new Error(`Required attribute: ${relationship}`);
    } else {
      acc[relationship] = { data: null };
    }
    return acc;
  }, {});
}

function attributes(type, schema) {
  return Object.keys(linkAttributes(schema).properties);
}

function relationships(type, schema) {
  if (type == 'item') {
    return { item_type: { collection: false, type: 'item_type' } };
  }

  if (!linkRelationships(schema).properties) {
    return {};
  }

  return Object.entries(linkRelationships(schema).properties).reduce((acc, [relationship, relAttributes]) => {
    const isCollection = relAttributes.properties.data.type == 'array';

    const isObject = relAttributes.properties.data.type == 'object';

    let definition;

    if (isCollection) {
      definition = relAttributes.properties.data.items;
    } else if (isObject) {
      definition = relAttributes.properties.data;
    } else {
      definition = relAttributes.properties.data.anyOf
        .find(x => x.type[0] != 'null');
    }

    const relType = definition.properties.type.pattern
      .replace(new RegExp(/(^\^|\$$)/, 'g'), '');

    acc[relationship] = { collection: isCollection, type: relType };
    return acc;
  }, {});
}


function linkAttributes(schema) {
  return schema.properties.data.properties.attributes;
}

function linkRelationships(schema) {
  if (!schema || !schema.properties.data) {
    return {};
  }
  return schema.properties.data.properties.relationships;
}

function requiredAttributes(schema) {
  return linkAttributes(schema).required || [];
}

function requiredRelationships(schema) {
  return linkRelationships(schema).required || [];
}

export default function serializeJsonApi(...args) {
  if (args.length === 4 || args.length === 3) {
    const [type, unserializedBody, link, itemId] = args;
    const data = {};

    data.type = type;

    if (itemId || unserializedBody.id) {
      data.id = itemId || unserializedBody.id;
    }

    data.attributes = serializedAttributes(type, unserializedBody, link.schema);

    if (link.schema.properties && linkRelationships(link.schema)) {
      data.relationships = serializedRelationships(type, unserializedBody, link.schema);
    }

    return { data };
  } else {
    throw new Error('Invalid arguments');
  }
}
