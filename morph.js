#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');
const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const os = require('os');
const path = require('path');
const Stream = require('stream');
const GIFEncoder = require('gifencoder');
const Opentype = require('opentype.js');
const Canvas = require('canvas')
// const Canvas = require('canvas-prebuilt');
const flubber = require('flubber');
const fontPath = './assets/fonts/HelveticaNeue.ttf';
const TextToSVG = require('text-to-svg');
const textToSVG = TextToSVG.loadSync(fontPath);

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);

const foreColor = '#b00d00',
      backColor = '#ffffff';
const attributes = {fill: '#b00d00', stroke: '#b00d00'};
const options = {x: 0, y: 160, fontSize: 144, anchor: 'baseline', attributes: attributes};
const slideTime = 1200;
const TMP_FILE = path.join(os.tmpdir(), 'morph_out.gif');
let outStream = fs.createWriteStream(TMP_FILE);

// take from args:
// let words = process.argv.splice(2);
// take from corpora sources:
const CORPORAPATH = './assets/corpora-project/';
const canadaProv = require(CORPORAPATH+'geography/canada_provinces_and_territories').provinces;
const countries = require(CORPORAPATH+'geography/countries').countries;
const englishCities = require(CORPORAPATH+'geography/english_towns_cities').cities;
const usCities = require(CORPORAPATH+'geography/us_cities').cities.map(c=>c.city);
const seas = require(CORPORAPATH+'geography/oceans').seas.map(s=>s.name);
const canadaMuni = require(CORPORAPATH+'geography/canadian_municipalities').municipalities.map(m=>m.name);

const wordPool = _.concat(usCities, countries, englishCities, seas, canadaMuni, canadaProv);

let words = _.sampleSize(wordPool, 2);
let maxWidth = _.max(words.map(word=>textToSVG.getWidth(word, options))) * 1.2,
    maxHeight = 200;
let omniPaths = words.map(word => textToSVG.font.getPaths(word, (maxWidth - textToSVG.getWidth(word, options)) / 2, 160, 144));

// // OLDER: let splitGlyphs = omniPaths.map(word => word.map(glyph => splitGlyph(glyph))).map(cmd =>_.flatten(cmd));
// // BAD RESULTS, NEEDS MULTIPLE GLYPHs let shapes = omniPaths.map(word => word.map(glyph => _.flatten(splitGlyph(glyph)))).map(word=>findErasePaths(getBoxesForPaths(commandsToPath(word))));
let paths = omniPaths.map(
  paths => {
    // console.log(`these glyphPaths are`);
    // console.dir(paths);
   return _.flatMap(paths, 'commands');
  });
// console.log(paths.length);
// console.log(paths[0].length, paths[1].length);
// console.log(paths[0][0]);
let splitPaths = paths.map(splitCommands);
// console.log(splitPaths[0].length, splitPaths[1].length);
let toDraw = splitPaths.map(word=>findErasePaths(getBoxesForPaths(commandsToPath(word))));
// console.dir(toDraw);
// console.log(toDraw.length);
// console.log(toDraw[0].length, toDraw[1].length);

let shapes = toDraw.map(paths => _.sortBy(paths, 'fillStyle'));
// console.dir(shapes.map(word => _.flatMap(word, 'fillStyle')));
// return null;

let encoder = new GIFEncoder(maxWidth,maxHeight),
    step = 60;

encoder.createReadStream().pipe(outStream).
  on('finish', () => {
    let status = `How do you get from ${words[0]} to ${words[1]}? It's easy:`;
      REST.postMediaChunkedAsync({file_path: TMP_FILE}).
        then(r=>REST.post('statuses/update', {
          status: status,
          media_ids: [r.media_id_string]
        })).
        then(res=>console.log(`MORPH twote: ${res.data.id_str} ${status}`)).
        catch(console.error);
  });

encoder.start();
encoder.setRepeat(0);
encoder.setTransparent(0x000000);
encoder.setDelay(step);

let canvas = new Canvas(maxWidth,maxHeight),
    context = canvas.getContext("2d"),
    width = maxWidth,
    height = maxHeight,
    interpolators = makeIPs(shapes[0],  shapes[1]),
    startTime,
    maxTime = words.length * slideTime;

context.fillStyle = foreColor;
for (let t=0;t<maxTime;t+=step) {
  draw(t);
  encoder.addFrame(context);
}

encoder.finish();

function draw(time) {
  var points,
      t;

  if (!startTime) {
    startTime = time;
  }

  t = time - startTime;

  //console.log(`working on ${time} as ${t}`);
  context.clearRect(0, 0, width, height);
  
  // background fill... 
  context.fillStyle = backColor;
  context.fillRect(0, 0, width, height);
  context.fillStyle = foreColor;

  // Next iteration
  if (t > slideTime) {
    // console.log(`drawing next slide...`);
    startTime = time - t + slideTime;
    t -= slideTime;
    shapes.push(shapes.shift());
    interpolators = makeIPs(shapes[0], shapes[1]);
  }

  interpolators.forEach( ip => {
    let res = ip(ease(t / slideTime));
    points = res.d;
    context.fillStyle = res.fillStyle == "erase" ? backColor : foreColor;
    // if (res.fillStyle == 'erase') { console.log(`res.fillStyle is ${res.fillStyle}, drawing as ${context.fillStyle} with ${res.d[0]}`); }
    context.beginPath();
    points.forEach(function(p, i) {
      context[i ? "lineTo" : "moveTo"](...p);
    });
    context.lineTo(...points[0]);
    // context.stroke();
    context.fill();
  });
}

function makeIPs (fromShapes, toShapes) {
  let toReturn = [];

  for (let i=0, ii=Math.max(fromShapes.length, toShapes.length);i<ii;i+=1) {
    let ip,
        x,
        y,
        origin = fromShapes[i] || null,
        dest = toShapes[i] || null;
    
    //console.log(`working on path ${i+1} of ${ii}`);

    if (origin && dest) {
      ip = t => {
        return {
          d: flubber.interpolate(origin.d, dest.d, {string: false})(t),
          fillStyle: dest.fillStyle
        };
      }
    }
    else if (!origin) {
      // console.log (`no origin, readM from destination:\n${dest}`);
      [x,y] = readM(dest.d);
      ip = t => {
        return {
          d: flubber.fromCircle(x, y, 0, dest.d, {string: false})(t),
          fillStyle: dest.fillStyle
        };
      }
    }
    else if (!dest) {
      // console.log (`no destination, readM from origin:\n${origin}`);
      [x,y] = readM(origin.d);
      ip = t=> { 
        return {
          d: flubber.toCircle(origin.d, x, y, 0, {string: false})(t),
          fillStyle: "erase"
        };
      }
    }
    
    toReturn.push(ip);
  }

  return toReturn;
}

function getDs(ips, t) {
  return ips.map(ip => ip(t));
}

// If it's only 1 item, we draw it straight
// If >1 item, we'll draw firstin FG then subsequent as BG
function splitAndReversePathData(pathString) {
  pathString.toPathData().split('M').splice(1).map(el=>'M'+el).reverse()
}

function getSVG(ips, t) {
  let svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="200">`;
  ips.forEach(ip => svgOut += `<path fill="#b00d00" stroke="#b00d00" d="${ip(t)}"/>`);
  svgOut += `</svg>`;
  return svgOut;
}

function readM(fromPath) {
  let toReturn; 
  if (_.isArray(fromPath)) {
    toReturn = fromPath[0];
  }
  else {
    let pattern = /^M(.+?)L.+/i,
        separators = /[, ]/g;
    toReturn = fromPath.replace(pattern, "$1").split(separators).map(el=>el.split('.')[0]).map(el=>_.parseInt(el))
  }

  return toReturn;
}

// Cubic in/out easing
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

function splitCommands(commands) {
  // Break commands at "M" instructions...
  let rawCommands = _.reduce(commands, (acc, c) => { 
    if (c.type=="M") {
      acc.push([c]);
    } else {
      _.last(acc).push(c);
    }

    return acc;
  }, []);

  return rawCommands;
}

function commandsToPath(rawCommands) {
  let newPaths = rawCommands.map(commands => {
    let p = new Opentype.Path();
    p.commands = commands;
    return p;
  });

  return newPaths;
}

function getBoxesForPaths(subPaths) {
  return subPaths.map(path => {
    path.box = path.getBoundingBox()
    return path;
    });
}

function findErasePaths(paths) {
  // console.log(`looking at a glyph of ${paths.length} subpaths`);
  return paths.map(path => {
    let fill;
    if (_.find(paths, otherPath => isWithin(path.box,otherPath.box))) {
      fill = "erase";
    }
    else {
      fill = "draw";
    }

    return {d: path.toPathData(), fillStyle: fill};
  });
}

function isWithin(thisBox, otherBox) {
  // console.log(
  //   ["|",_.parseInt(thisBox.x1),_.parseInt(thisBox.x2),"|", _.parseInt(otherBox.x1), _.parseInt(otherBox.x2),"|\n|",
  //    _.parseInt(thisBox.y1),_.parseInt(thisBox.y2),"|", _.parseInt(otherBox.y1), _.parseInt(otherBox.y2),"|"].join("\t") + "\n\n\n"
  // )
  return otherBox.x1 < thisBox.x1 && otherBox.y1 < thisBox.y1 && otherBox.x2 > thisBox.x2 && otherBox.y2 > thisBox.y2;
}

// console.log(svg);
// fs.writeFileSync('./testout.html', getSVG(ips, 1));

// Aring = 1, 0, 0, 1
// B = 0, 1, 0 
// oe = 0, 0, 1
