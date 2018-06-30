#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./lib/mt-rng');

const _ = require('lodash');
const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const os = require('os');
const path = require('path');
const Stream = require('stream');
const say = require('text2wave');

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);
const ffmpeg = P.promisifyAll(require('fluent-ffmpeg'));

const CORPORAPATH = './assets/corpora-project/';
const ca_municipalities = require(CORPORAPATH+'/geography/canadian_municipalities').municipalities.map(x => x.name);
const us_cities = require(CORPORAPATH+'/geography/us_cities').cities.map(x => x.city);
const london_tube = require(CORPORAPATH+'/geography/london_underground_stations').stations.map(x => x.name);
const planets = require(CORPORAPATH+'/science/planets').planets.map(x => x.name);

const words = _.concat(ca_municipalities, us_cities, london_tube, planets);
const DESTINATION = _.sample(words);

const VID_PATH = path.join('assets', 'curry', 'ra3-curry-space.mp4');
const WAV_PATH = path.join(os.tmpdir(), 'destination.wav');
const TMP_FILE = path.join(os.tmpdir(), 'curry_out.mp4');

let WAV_STREAM = fs.createWriteStream(WAV_PATH)

say(DESTINATION).pipe(WAV_STREAM).on('finish', () => {
  ffmpeg.ffprobeAsync(WAV_PATH).
    then(info => info.format.duration).
    then(dur => 1.4 / dur).
    then(ptsRatio => {
      let command = ffmpeg();
      command.input(WAV_PATH).
      input(VID_PATH).
      complexFilter(`[0:a]anull[a2];[1:a]atrim=end=8.6,asetpts=PTS-STARTPTS[a1];[1:a]atrim=start=10,asetpts=PTS-STARTPTS[a3];[a1][a2][a3]concat=n=3:v=0:a=1[aout];[1:v]trim=end=8.6,setpts=PTS-STARTPTS[v1];[1:v]trim=8.6:10,setpts=PTS-STARTPTS[v2];[1:v]trim=start=10,setpts=PTS-STARTPTS[v3];[v2]setpts=PTS/${ptsRatio}[slow];[v1][slow][v3]concat=n=3:v=1:a=0[vout]`, ['vout', 'aout']).
      output(TMP_FILE).
      outputOption('-y').
      audioCodec('aac').
      videoCodec('libx264').
      on('end', function() {
            console.log(`wrote to ${TMP_FILE} using ${DESTINATION} `);
            REST.postMediaChunkedAsync({file_path: TMP_FILE}).
              then(r=>REST.post('statuses/update', {
                status: `${DESTINATION}`,
                media_ids: [r.media_id_string]
              })).
              then(res=>console.log(`CURRY twote:\n${res.data.id_str}`)).
              catch(console.error)
        }).
        run();
    }).
    catch(console.error);
});
