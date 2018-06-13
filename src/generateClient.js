const fetch = require('node-fetch');
const parser = require('json-schema-ref-parser');
import deserializeJsonApi from './deserializeJsonApi';
import serializeJsonApi from './serializeJsonApi';
import pluralize from 'pluralize';
import { decamelize } from 'humps';
import ClientClass from './Client';

export default function generateClient(subdomain) {
  return function Client(token, extraHeaders = {}, baseUrl = `https://${subdomain}.datocms.com`) {
    let schemaPromise;

    const client = new ClientClass(token, extraHeaders, baseUrl)

    return new Proxy({}, {
      get(obj1, namespace) {
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
                  throw "Non esiste " + namespace;
                }

                const methodNames = {
                  "instances": "all",
                  "self": "find",
                };

                const identityRegexp = /\{\(.*?definitions%2F(.*?)%2Fdefinitions%2Fidentity\)}/g;

                const link = sub.links.find(
                  l => (methodNames[l.rel] || l.rel) == apiCall
                );

                if (!link) {
                  throw "Non esiste " + apiCall;
                }

                let lastUrlId;
                let url = link.href;

                url = url.replace(identityRegexp, function(match) {
                  if (match) {
                    lastUrlId = args.shift();
                    return lastUrlId
                  }
                });

                let body = {};

                if ( link.schema ) {
                  const unserializedBody = args.shift();
                  body = serializeJsonApi(
                    singularized,
                    unserializedBody,
                    link,
                    lastUrlId
                  );
                }

                if (link.method == "POST") {
                  return client.post(`${url}`, body)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == "PUT") {
                  return client.put(`${url}`, body)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == "DELETE") {
                  return client.delete(url)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                } else if (link.method == "GET") {
                  // query_string = args.shift
                  //
                  // all_pages = (args[0] || {}).
                  //   symbolize_keys.
                  //   fetch(:all_pages, false)
                  //
                  // is_paginated_endpoint = link.schema &&
                  //   link.schema.properties.has_key?("page[limit]")
                  //
                  // if is_paginated_endpoint && all_pages
                  //   Paginator.new(client, url, query_string).response
                  return client.get(url)
                  .then(response => Promise.resolve(deserializeJsonApi(response)));
                }
                else {
                  // client.request(:get, url, query_string)

                }

              })
            };
          }
        });
      }
    });
  }
}
