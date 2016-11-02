#!/usr/bin/env node

const _ = require('lodash');
const P = require('bluebird');
const path = require('path');
const fs = P.promisifyAll(require('fs'));

const imagemagick = P.promisifyAll(require('imagemagick-native'));
const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const ANIME_DIR = path.join('assets', 'shaft', 'char');
const ANIME_BASENAME = _.sample(fs.readdirSync(ANIME_DIR));
const ANIME_PATH = path.join(ANIME_DIR, ANIME_BASENAME);
const TEMPLATE_PATH = path.join('assets', 'base', 'miyazaki-mistake_720.png');

P.all([fs.readFileAsync(ANIME_PATH), fs.readFileAsync(TEMPLATE_PATH)]).
then(data => {
  let animeData = data[0],
      templateData = data[1],
      animeOptions = {srcData: animeData, height: 720, width: 500, resizeStyle: 'aspectfit'};
  if (!!_.random()) {
    animeOptions.flip = true;
    animeOptions.rotate = 180;
  }

  animeData = imagemagick.convert(animeOptions);
  let compData = imagemagick.composite({srcData: templateData, compositeData: animeData, gravity: 'NorthEastGravity'});
  let media_data = compData.toString('base64');
  return REST.post('media/upload',  {media_data: media_data});
}).
then(reply => reply.data.media_id_string).
then(media_id => {
  let status = '';
  let params = {status: status, media_ids: [media_id]};
  return REST.post('statuses/update', params);
}).
then(res => {
  console.log(`I twote:\n${res.data.id_str}`);
}).
catch(console.error);
