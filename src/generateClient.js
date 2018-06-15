const fetch = require('node-fetch');
const parser = require('json-schema-ref-parser');
import deserializeJsonApi from './deserializeJsonApi';
import serializeJsonApi from './serializeJsonApi';
import pluralize from 'pluralize';
import { decamelize } from 'humps';
import ClientClass from './Client';
import rawUploadFile from './upload/uploadFile';
import fetchAllPages from './fetchAllPages';

export default function generateClient(subdomain) {
  return function Client(token, extraHeaders = {}, baseUrl = `https://${subdomain}.datocms.com`) {
    let schemaPromise;

    const client = new ClientClass(token, extraHeaders, baseUrl);

    return new Proxy({}, {
      get(obj1, namespace) {
        if (namespace === 'uploadFile') {
          return function uploadFile(source) {
            return rawUploadFile(this, source);
          };
        }
        if (namespace === 'uploadImage') {
          return function uploadImage(source) {
            return rawUploadFile(this, source);
          };
        }
        return new Proxy({}, {
          get(obj2, apiCall) {
            return function call(...args) {
              if (!schemaPromise) {
                schemaPromise = fetch(`https://${subdomain}.datocms.com/docs/${subdomain}-hyperschema.json`)
                  .then(res => res.json())
                  .then(schema => parser.dereference(schema));
              }

              return schemaPromise.then((schema) => {
                const singularized = decamelize(pluralize.singular(namespace));
                const sub = schema.properties[singularized];

                if (!sub) {
                  throw `Non esiste ${namespace}`;
                }

                const methodNames = {
                  instances: 'all',
                  self: 'find',
                };

                const identityRegexp = /\{\(.*?definitions%2F(.*?)%2Fdefinitions%2Fidentity\)}/g;

                const link = sub.links.find(
                  l => (methodNames[l.rel] || l.rel) == apiCall
                );

                if (!link) {
                  throw `Non esiste ${apiCall}`;
                }

                let lastUrlId;
                let url = link.href;

                url = url.replace(identityRegexp, (match) => {
                  if (match) {
                    lastUrlId = args.shift();
                    return lastUrlId;
                  }
                });

                let body = {};
                if (link.schema && (link.method == 'PUT' || link.method == 'POST')) {
                  const unserializedBody = args.shift();
                  body = serializeJsonApi(
                    singularized,
                    unserializedBody,
                    link,
                    lastUrlId
                  );
                }

                if (link.method == 'POST') {
                  return client.post(`${url}`, body)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == 'PUT') {
                  return client.put(`${url}`, body)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == 'DELETE') {
                  return client.delete(url)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == 'GET') {
                  const queryString = args.shift();
                  const options = args.shift() || {};

                  const deserializeResponse = Object.prototype.hasOwnProperty.call(options, 'deserializeResponse') ?
                    options.deserializeResponse :
                    true;

                  const allPages = Object.prototype.hasOwnProperty.call(options, 'allPages') ?
                    options.allPages :
                    false;

                  let request;

                  if (allPages) {
                    request = fetchAllPages(client, url, queryString);
                  } else {
                    request = client.get(url, queryString);
                  }

                  return request
                  .then(response => Promise.resolve(
                    deserializeResponse ?
                      deserializeJsonApi(response) :
                      response
                  ));
                }
              });
            };
          },
        });
      },
    });
  };
}
