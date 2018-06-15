// const poly = require('proxy-polyfill/src/proxy')
// const Proxy = poly();

// const repo = require('Repo');
const fetch = require('node-fetch');
const parser = require('json-schema-ref-parser');

function generateClient(subdomain) {
  return function Client(token, extraHeaders = {}, baseUrl = `https://${subdomain}.datocms.com`) {
    let schemaPromise;

    return new Proxy({}, {
      get(obj, namespace) {
        return new Proxy({}, {
          get(obj, apiCall) {
            return function(...args) {
              if (!schemaPromise) {
                schemaPromise = fetch(`${baseUrl}/docs/${subdomain}-hyperschema.json`)
                  .then(res => res.json())
                  .then(schema => parser.dereference(schema));
              }

              return schemaPromise.then((schema) => {
                const sub = schema.properties[namespace];

                if (!sub) {
                  throw "Non esiste " + namespace;
                }

                const link = sub.links.find(l => l.rel == apiCall);

                if (!link) {
                  throw "Non esiste " + apiCall;
                }

                const repoInstances = [];

                Object.defineProperty(
                  this,
                  namespace,
                  {
                    enumerable: true,
                    get() {
                      repoInstances[method] = repoInstances[method] ||
                        new Repo(this, namespace, sub);
                      return repoInstances[method];
                    },
                  }
                );
              })
            };
          }
        });
      }
    });
  }
}

const AccountClient = generateClient('account-api');
const SiteClient = generateClient('site-api');


const client = new SiteClient('XXX');

// client.item.create()
//   .then((item) => console.log(item))
//   .catch(e => console.log(e));

client.stocazzo.questo()
  .then((item) => console.log(item))
  .catch(e => console.log(e));

client.uploadFile('test/fixtures/newTextFileHttps.txt')

const a = new AccountClient('XXX');

a.site.create()
  .then((item) => console.log(item))
  .catch(e => console.log(e));


//
// client.items.create({ title: "CIAO" })
// .then(item => expect(item.id).not_to be_nil)
//
//
// function wait(time) {
//   return new Promise((resolve) => setTimeout(resolve, time));
// }
//
// async function faiCose() {
//   await wait(300);
//   const item = await client.items.create({ title: "CIAO" });
//   return item;
// }
//
// faiCose() -> 1
// faiCose().then
