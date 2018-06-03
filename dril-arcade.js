#!/usr/bin/env node

'use strict';

// Replace Math.random() with MT-based substitute:
Math.random = require('./lib/mt-rng');

const _ = require('lodash');
const os = require('os');
const path = require('path');
const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const exec = require('child-process-promise').exec;

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);

const TMP_FILE = path.join(os.tmpdir(), 'dril_arcade.jpg');

// let padToTwo = number => number <= 99 ? ("0"+number).slice(-2) : number;
// let getMonth = () => padToTwo(_.random(11)+1);
// let getDay = () => padToTwo(_.random(27)+1);

function getDrilTweet() {
  // let limitDate = `until:201${_.random(7)}-${getMonth()}-${getDay()}`;
  return REST.get('search/tweets', { q: `from:dril -filter:replies`, count: 100 });
}

let getTweet = getDrilTweet;

let noMeta = (status) => !(status.entities.user_mentions.length || status.entities.urls.length);

getDrilTweet().
  then(res => res.data.statuses.filter(status=>noMeta)).
  then(statuses => _.sample(statuses).text).
  tap(console.log).
  then(tweetText => `composite -geometry +118+28 -font "Ubuntu-Bold" -pointsize 27 -size 490x220 -background none caption:"${tweetText.replace(/(["$])/g,'\\$1')}" ./assets/base/tycho.jpg "${TMP_FILE}"`).
  then(imCall => exec(imCall)).
  then(ret=>REST.postMediaChunkedAsync({file_path: TMP_FILE})).
  // tap(console.log).
  then(r=>REST.post('statuses/update', {
          status: '',
          media_ids: [r.media_id_string]
        })).
  then(res=>console.log(`DRILARCADE twote:${res.data.id_str}`)).
  catch(console.error);
