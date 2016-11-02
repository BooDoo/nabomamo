#!/usr/bin/env node

const _ = require('lodash');
const mime = require('mime');

const path = require('path');
const P = require('bluebird');
const jsdom = P.promisifyAll(require('jsdom'));
const request = P.promisifyAll(require('request'));
const fs = P.promisifyAll(require('fs'));

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const REUTERS_IMAGES_URI = 'https://pictures.reuters.com';

jsdom.envAsync(REUTERS_IMAGES_URI).
then(w => {
  let imgs = w.document.querySelectorAll('img');
  let srcs = _.map(imgs, img=>img.src);
  // remove AJAX circle and nav arrows:
  srcs = srcs.filter(src => !~src.indexOf('RTR/Images') && !~src.indexOf('TRMisc'));
  let uris = _.sampleSize(srcs, 4);
  return uris;
}).
map(uri => {
  let basename = path.basename(uri);
  return request.getAsync({uri: uri, encoding: null})
}).
map(res => {
  let media_data = res.body.toString('base64');
  return REST.post('media/upload',  {media_data: media_data});
}).
map(reply => reply.data.media_id_string).
then(media_ids => {
  console.log(`media_ids: ${media_ids}`);
  let status = "we live in a world of contrasts";
  let params = {status: status, media_ids: media_ids};
  return REST.post('statuses/update', params);
})
.then(res => {
  console.log(`I twote:\n${res.data.id_str}, ${res.data.text}`);
}).
catch(console.error);
