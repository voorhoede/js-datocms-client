// import * as repos from './repos';
// import Client from '../Client';
// import parser from 'json-schema-ref-parser';

import uploadFile from '../upload/uploadFile';
import generateClient from '../generateClient'


export default generateClient('site-api');


// export default class SiteClient extends Client {
//   uploadFile(source) {
//     return uploadFile(this, source);
//   }
//
//   uploadImage(source) {
//     return uploadFile(this, source);
//   }
// }
