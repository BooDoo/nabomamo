#!/usr/bin/env node

const _ = require('lodash');
const mime = require('mime');

const path = require('path');
const P = require('bluebird');
const jsdom = P.promisifyAll(require('jsdom'));
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const pithyText = [
  "You can't be happy unless you're unhappy sometimes",
  "Never to suffer would never to have been blessed",
  "What good is the warmth of summer, without the cold of winter to give it sweetness",
  "Perhaps without the lows, the highs could not be reached",
  "It takes darkness to be aware of the light",
  "Nothing exists without its opposite",
  "A fish will not truly learn to enjoy water, without gasping for air",
  "'What is evil?' asked the Fiend",
  "Some of your most powerful intentions are born in your moments of greatest contrast",
  "There are dark shadows on the earth, but its lights are stronger in the contrast",
  "Contrast is what makes photography interesting",
  "There's a rule of writing: if everything is funny, nothing is funny; if everything is sad, nothing is sad",
  "Stories hold conflict and contrast, highs and lows, life and death, and the human struggle and all kinds of things",
  "There is no quality in this world that is not what it is merely by contrast",
  "Sublime upon sublime scarcely presents a contrast, and we need a little rest from everything, even the beautiful",
  "If you want the beautiful moments to shine, you have to contrast that with dark and gruesome moments",
  "As a means of contrast with the sublime, the grotesque is, in our view, the richest source that nature can offer",
  "I try to contrast; life today is full of contrast…we have to change",
  "A true revolution of values will soon look uneasily on the glaring contrast of poverty and wealth",
  "Simultaneous contrast is not just a curious optical phenomenon - it is the very heart of painting",
  "There is plenty of dissonance, but it's used as a contrast."
]

const REUTERS_IMAGES_URI = 'https://pictures.reuters.com';

jsdom.envAsync(REUTERS_IMAGES_URI).
then(w => {
  // get src URI for each <IMG>
  let imgs = w.document.querySelectorAll('img');
  let srcs = _.map(imgs, img=>img.src);
  // remove AJAX circle and nav arrows:
  srcs = srcs.filter(src => !~src.indexOf('RTR/Images') && !~src.indexOf('TRMisc'));
  // take 4 at (pseudo)random
  let uris = _.sampleSize(srcs, 4);
  return uris;
}).
// fetch binary data for each URI via request
map(uri => request.getAsync({uri: uri, encoding: null}) ).
map(res => {
  // interpret the Buffer from request into base64, upload to twimg.com
  let media_data = res.body.toString('base64');
  return REST.post('media/upload',  {media_data: media_data});
}).
map(reply => reply.data.media_id_string).
then(media_ids => {
  // tweet with the 4 images uploaded above attached.
  let status = _.sample(pithyText);
  let params = {status: status, media_ids: media_ids};
  return REST.post('statuses/update', params);
})
.then(res => {
  console.log(`I twote:\n${res.data.id_str}, ${res.data.text}`);
}).
catch(console.error);
