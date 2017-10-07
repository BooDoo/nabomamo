#!/usr/bin/env node

const _ = require('lodash');
const P = require('bluebird');
const path = require('path');
const fs = P.promisifyAll(require('fs'));

const gm = require('gm').subClass({imageMagick: true});
const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.test);

const ANIME_DIRS = [path.join('assets', 'shaft', 'char'), path.join('assets', 'bbcf', 'char'), path.join('assets', 'pripri'), path.join('assets', 'imas', 'char')]
const ANIME_PATH = _(ANIME_DIRS.map(d=>fs.readdirSync(d).map(b=>`${d}/${b}`))).flatten().sample();
const TEMPLATE_PATH = path.join('assets', 'base', 'miyazaki-mistake_720.png');

let compBuffer = gm(TEMPLATE_PATH).composite(ANIME_PATH).resize(1280, 720).gravity('NorthEast')
//give me a promise!
compBuffer.__proto__.toBufferAsync = P.promisify(compBuffer.__proto__.toBuffer);

compBuffer.toBufferAsync().then(buffer => {
  let media_data = buffer.toString('base64');
  return REST.post('media/upload',  {media_data: media_data});
}).
then(reply => reply.data.media_id_string).
then(media_id => {
  let status = '';
  let params = {status: status, media_ids: [media_id]};
  return REST.post('statuses/update', params);
}).
then(res => {
  console.log(`ANIME twote:\n${res.data.id_str} using ${path.basename(ANIME_PATH)}`);
}).
catch(console.error);
