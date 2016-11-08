#!/usr/bin/env node

const _ = require('lodash');
const P = require('bluebird');
const path = require('path');
const Stream = require('stream');
const fs = P.promisifyAll(require('fs'));
const os = require('os');
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');

const Flickr = require('node-flickr');
let flickr = new Flickr(creds.flickr);
flickr = P.promisifyAll(flickr);

const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);

const ffmpeg = require('fluent-ffmpeg');

const VID_DIR = path.join('assets', 'flipflappers');
const VID_BASENAME = _.sample(fs.readdirSync(VID_DIR));
const VID_PATH = path.join(VID_DIR, VID_BASENAME);

const TMP_FILE = path.join(os.tmpdir(), 'flipflap_out.gif');
let imgUrl; // get an image file! or stream! from unsplash? or pixabay? or flickr? or...?

// Actual ffmpeg command stuff and call to post result to twitter:
const GRAVITY = {
  NW: "x=10:y=10",
  N: "x=(main_w/2)-(overlay_w/2):y=10",
  NE: "x=main_w-overlay_w-10:y=10",
  W: "x=10:y=(main_h/2)-(overlay_h/2)",
  C: "x=(main_w/2)-(overlay_w/2):y=(main_h/2)-(overlay_h/2)",
  E: "x=main_w-overlay_w-10:y=(main_h/2)-(overlay_h/2)",
  SW: "x=10:y=main_h-overlay_h-10",
  S: "x=(main_w/2)-(overlay_w/2):y=main_h-overlay_h-10",
  SE: "x=main_w-overlay_w-10:y=main_h-overlay_h-10"
}
let gravity = _.sample(GRAVITY);

// filter_complex nonsense:
let chromakey = {
  inputs: '1:v',
  filter: 'chromakey', options: 'black:0.01:0.0',
  outputs: 'ckout'
};

let roughscale = {
  inputs: '0:v',
  filter: 'scale', options: '1920:-1',
  outputs: 'roughscale'
};

let fixscale = {
  inputs: 'roughscale',
  filter: 'scale', options: 'trunc(iw/2)*2:trunc(ih/2)*2',
  outputs: 'bg'
};

let overlaid = {
  inputs: ['bg', 'ckout'],
  filter: 'overlay', options: `${gravity}`,
  outputs: 'comp'
};

let framed = {
  inputs: 'comp',
  filter: 'fps', options: '18',
  outputs: 'framed'
};

let downsized = {
  inputs: 'framed',
  filter: 'scale', options: '-1:480:flags=lanczos',
  outputs: 'scaled'
};

let splitter = {
  inputs: 'scaled',
  filter: 'split', 
  outputs: ['vidA', 'vidB']
};

let palettegen = {
  inputs: 'vidA',
  filter: 'palettegen',
  outputs: 'PAL'
};

let fifo = {
  inputs: 'vidB',
  filter: 'fifo',
  outputs: 'vid'
};

let finalize = {
  inputs: ['vid', 'PAL'],
  filter: 'paletteuse',
  outputs: 'out'
};

const flickr_options = {
  "tags": "landscape",
  "media": "photos",
  "safe_search": 1,
  "content_type": 1,
  "license": "2,3,4,5,6,9",
  "orientation": "landscape",
  "media": "photos",
  "extras": "url_o",
  "format": "json",
  "nojsoncallback": 1
}

// TODO: Implement alt text for attribution!
flickr.getAsync('photos.search', flickr_options).
  then(res=>res.photos.photo).
  map(photo=>{
    return {
      imgUrl: photo.url_o,
      altUrl: `https://flickr.com/${photo.owner}/${photo.id}`
    }
  }).
  then(photos=>_.sample(photos)).
  then(photo=> {
    console.log(`working with ${photo.imgUrl}\t/\t${photo.altUrl}`);
    let command = ffmpeg();
    let img_stream = new Stream.PassThrough();
    request.get(photo.imgUrl).pipe(img_stream);
    command.
      input(img_stream).
      input(VID_PATH).
      outputOptions('-shortest').
      complexFilter([chromakey, roughscale, fixscale, 
        overlaid, framed, downsized, splitter,
        palettegen, fifo,
        finalize
      ], 'out').
      output(TMP_FILE).
      toFormat('gif').
      on('start', function(commandLine) {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
      }).
      on('error', function(err, stdout, stderr) {
          console.log('Cannot process video: ' + err.message);
          console.log(stdout);
          console.log(stderr);
      }).
      on('end', function() {
          console.log(`wrote to ${TMP_FILE} `);
          REST.postMediaChunkedAsync({file_path: TMP_FILE}).
            then(r=>REST.post('statuses/update', {
              status: '',
              media_ids: [r.media_id_string]
            })).
            then(res=>console.log(`FLIPFLAP twote:\n${res.data.id_str}`)).
            catch(console.error)
      }).
      run();
  }).
  catch(console.error);
