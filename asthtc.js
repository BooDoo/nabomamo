#!/usr/bin/env node

'use strict';

// override node random with Mersenne Twister
// const MersenneTwister = require('mersenne-twister');
// const rng = new MersenneTwister();
// Math.random = rng.random;

const _ = require('lodash');
const os = require('os');
const P = require('bluebird');
const g = require('glitch');
const GlitchedStream = g.GlitchedStream;
const path = require('path');
const fs = P.promisifyAll(require('fs'));
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);
const Flickr = require('node-flickr');
let flickr = new Flickr(creds.flickr);
flickr = P.promisifyAll(flickr);

const gm = require('gm').subClass({imageMagick: true});

const WORDS = require('./assets/words/positive');
const COLORS = require('./assets/words/colors-im').colors;
let colorWords = _.sampleSize(WORDS, 5).map(w=> [_.sample(COLORS), w]);
const TMP_PATH = path.join(os.tmpdir(), 'asthtc.jpg');
// const OUT_PATH = './testout.jpg'; 
const OUT_PATH = TMP_PATH

// for use with IM convert -annotate
const skewPairs = [
  '0x0',      '45x0',     '180x0',    '315x0',
  '0x45',     '45x45',    '90x45',    '225x45',
  '45x90',    '90x90',    '315x90',   '135x135',
  '315x135',  '135x180',  '225x180',  '225x225',
  '270x225',  '135x270',  '227x270',  '315x270',
  '0x315',    '180x315',  '270x315',  '315x315'
];

// Some streams for glitching/saving
// semi-arbitrary values, here
let gstream = new GlitchedStream({
  probability: 0.0010,
  deviation: 1
});

let outStream = fs.createWriteStream(OUT_PATH).
  on('error', err => console.dir(err));

const flickrSearchOpts = {
  "tags": "landscape",
  "media": "photos",
  "safe_search": 1,
  "content_type": 1,
  "license": "2,3,4,5,6,9",
  "orientation": "landscape",
  "media": "photos",
  "e,tras": "url_o",
  "format": "json",
  "nojsoncallback": 1
};

// I can probably tap into gm() call instead of fetching meta?
let flickrGetOpts = {
  "format": "json",
  "nojsoncallback": 1
};

flickr.getAsync('photos.search', flickrSearchOpts).
  then(res=>res.photos.photo).
  map(photo=>{
    return {
      imgUrl: photo.url_o,
      altUrl: `https://flickr.com/${photo.owner}/${photo.id}`,
      photoId: photo.id
    }
  }).
  then(photos=> _.sample(photos)).
  then(photo => flickr.getAsync('photos.getSizes', _.assign(flickrGetOpts, {photo_id: photo.photoId})) ).
  then(photo => {
    let meta = _.find(photo.sizes.size, {label: "Original"});
    let fontPoints = _.ceil((meta.width * meta.height) / 150000);

    console.log(`working with ${meta.source}\t${meta.url}`);
    // let img_stream = new Stream.PassThrough();
    let cmd = gm(request(meta.source)).
      density(300).
      font('Droid-Sans-Bold').
      pointSize(fontPoints);

    colorWords.forEach(cw=> {
      cmd.
        fill(cw[0]).
        out('-annotate').
        out(`${_.sample(skewPairs)}+${_.random(meta.width*.75)}+${_.random(meta.height*.75)}`).
        out(cw[1]);
    });
    
    cmd.resize(2048, 2048, '>').stream().pipe(gstream).pipe(outStream);
    outStream.on('finish', () => {
      REST.postMediaChunkedAsync({file_path: OUT_PATH}).
        then(r=>REST.post('statuses/update', {
          status: colorWords.
            map(cw=>cw[1]).
            map(w=>new Array(_.random(16)).join(' ')+w).
            join("\n"),
          media_ids: [r.media_id_string]
        })).
        then(res=>console.log(`ASTHTC twote:${res.data.status}\n\t${res.data.id_str}`)).
        catch(console.error)
    });
  }).
  catch(console.error)
