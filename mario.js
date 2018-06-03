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
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);
const ffmpeg = P.promisifyAll(require('fluent-ffmpeg'));

const VID_PATH = path.join('assets', 'mario', 'how2fuckup.mp4');
const WAV_PATH = path.join(os.tmpdir(), 'destination.wav');
const TMP_FILE = path.join(os.tmpdir(), 'mario_out.mp4');
let WAV_STREAM = fs.createWriteStream(WAV_PATH);

const GB_API_KEY = creds.giantbomb.api_key;
const GB_ROOT = `https://giantbomb.com/api`;
const CHARS_ENDPOINT = `/characters`;
const CHARS_URI = `${GB_ROOT}${CHARS_ENDPOINT}`;
const CHARS_MAX = 33970;
const GB_DEFAULTS = {api_key: GB_API_KEY, format:`json`, field_list:`name,image`, limit:1};

function get_characters(limit=2,fieldList=`name,image`) {
  let params = {field_list: fieldList, limit: limit, offset:_.random(CHARS_MAX - limit)};
  params = _.merge(GB_DEFAULTS, params);
  return request.getAsync({json:true, headers: {'User-Agent':'gamesmemes v420'}, uri: CHARS_URI, qs:params});
}

function get_character(fieldList=null) {
  return get_characters(1, fieldList);
}

get_character().then(res => {
  let char_name = res.body.results[0].name;

  say(char_name).pipe(WAV_STREAM).on('finish', () => {
    ffmpeg.ffprobeAsync(WAV_PATH).
      then(info => info.format.duration).
      then(dur => 0.9 / dur).
      then(ptsRatio => {
        let command = ffmpeg();
        command.input(WAV_PATH).
        input(VID_PATH).
        seekInput(10).
        complexFilter(`[0:a]volume=1.5[a2];[1:a]volume=0.2,atrim=end=3.1,asetpts=PTS-STARTPTS[a1];[1:a]atrim=start=4.1,asetpts=PTS-STARTPTS[a3];[a1][a2][a3]concat=n=3:v=0:a=1[aout];[1:v]trim=end=3.1,setpts=PTS-STARTPTS[v1];[1:v]trim=3.1:4.1,setpts=PTS-STARTPTS[v2];[1:v]trim=start=4.1,setpts=PTS-STARTPTS[v3];[v2]setpts=PTS/${ptsRatio}[slow];[v1][slow][v3]concat=n=3:v=1:a=0[vout]`, ['vout', 'aout']).
        output(TMP_FILE).
        outputOption('-y').
        audioCodec('aac').
        videoCodec('libx264').
        on('end', function() {
              REST.postMediaChunkedAsync({file_path: TMP_FILE}).
                then(r=>REST.post('statuses/update', {
                  status: '',
                  media_ids: [r.media_id_string]
                })).
                then(res=>console.log(`MARIO twote:\n${res.data.id_str} using ${char_name}`)).
                catch(console.error);
          }).
          run();
      }).
    catch(console.error);
  });
}).catch(console.error);
