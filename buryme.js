#!/usr/bin/env node

const _ = require('lodash');
const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const os = require('os');
const path = require('path');
const Stream = require('stream');
const say = require('text2wave');
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);
const ffmpeg = P.promisifyAll(require('fluent-ffmpeg'));

const VID_PATH = path.join('assets', 'bury', 'buryme.mp4');
const WAV_PATH = path.join(os.tmpdir(), 'destination.wav');
const TMP_FILE = path.join(os.tmpdir(), 'buryme_out.mp4');
let WAV_STREAM = fs.createWriteStream(WAV_PATH);

const CORPORAPATH = './assets/corpora-project/';
const objects = require(CORPORAPATH+'objects/objects').objects;
const clothes = require(CORPORAPATH+'objects/clothing').clothes;
const rooms = require(CORPORAPATH+'architecture/rooms').rooms;
const music = require(CORPORAPATH+'music/genres').genres;
const gemstones = require(CORPORAPATH+'materials/gemstones').gemstones;
const laypersonMetals = require(CORPORAPATH+'materials/layperson-metals')["layperson metals"];
const beers = require(CORPORAPATH+'foods/beer_styles').beer_styles;
const fruits = require(CORPORAPATH+'foods/fruits').fruits;

const moves = require(CORPORAPATH+'games/street_fighter_ii').characters.map(c=>c.moves).reduce((acc,next)=>acc.concat(next));
const artifacts = require(CORPORAPATH+'archetypes/artifact').artifacts.map(a=>a.synonyms.concat([a.name])).reduce((acc,next)=>acc.concat(next));

const words = _.concat(objects, clothes, rooms, music, gemstones, laypersonMetals, beers, fruits, moves, artifacts).
  map(item=>item.replace(/[\.,:;\!\?'"]/g,''));

let obj = _.sample(words);

say(obj).pipe(WAV_STREAM).on('finish', () => {
  ffmpeg.ffprobeAsync(WAV_PATH).
    then(info => info.format.duration).
    then(dur => 1.8 / dur).
    then(ptsRatio => {
      let command = ffmpeg();
      command.input(WAV_PATH).
      input(VID_PATH).
      complexFilter(
        `[0:a]volume=0.5[a2];` +
        `[1:a]volume=1,atrim=end=1.8,asetpts=PTS-STARTPTS[a1];` +
        `[a1][a2]concat=n=2:v=0:a=1[aout];` +
        `[1:v]trim=end=1.6,setpts=PTS-STARTPTS[v1];` +
        `[1:v]trim=1.6:3.6,setpts=PTS-STARTPTS[v2];` +
        `[v2]setpts=PTS/${ptsRatio}[slow];` +
        `[v1][slow]concat=n=2:v=1:a=0[vout]`, ['vout', 'aout']).
      output(TMP_FILE).
      outputOption('-y').
      audioCodec('aac').
      videoCodec('libx264').
      on('end', function() {
            let status = `bury me with my ${obj}`.toLowerCase();
            REST.postMediaChunkedAsync({file_path: TMP_FILE}).
              then(r=>REST.post('statuses/update', {
                status: status,
                media_ids: [r.media_id_string]
              })).
              then(res=>console.log(`BURYME twote:\n${res.data.id_str} ${status}`)).
              catch(console.error);
        }).
        run();
    }).
  catch(console.error);
});
