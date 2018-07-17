#!/usr/bin/env node
'use strict';

// Replace Math.random() with MT-based substitute:
Math.random = require('./lib/mt-rng');
// General requirements
const _ = require('lodash');
const $ = require('cheerio');
const P = require('bluebird');
const R = P.promisifyAll(require('request'));
// Read API keys etc
const creds = require('./credentials');
// Twitter interface
const Twit = require('./lib/twithelper');
const T = new Twit(creds.live);
// For working with our words
const WordHelper = require('./lib/wordhelper');
const W = new WordHelper(creds);
const lex = new require('rita').RiLexicon();
const rw = lex.randomWord.bind(lex);

// API is being a jerk, we're scraping
const CNROOT = 'http://conceptnet.io';
// Seeding words
const CORPORAPATH = './assets/corpora-project/';
const objects = require(CORPORAPATH+'objects/objects').objects;
const clothes = require(CORPORAPATH+'objects/clothing').clothes;
const occupations = require(CORPORAPATH+'humans/occupations').occupations;
const animals = require(CORPORAPATH+'animals/common').animals;
let words = _.concat(objects, clothes, occupations, animals).map(item=>item.replace(/[\.,:;\!\?'"]/g,'').split(' ')[0]);
words = _.uniq(words);

String.prototype.reStartsWith = function startsWith(re) {
  let matchRes = this.match(re);

  if (matchRes && matchRes.index == 0) {
    return true;
  }
  else {
    return false;
  }
}

function getTargetNextSibling(doc, targetText, targetTag='h2', siblingTag='ul') {
  return doc(targetTag).
  filter((i,el)=>$(el).text().match(RegExp(targetText, 'ig'))).
  next(siblingTag);
}

function getListItems(list, childSelector='li.term') {
    let items = list.children(childSelector);
    return items;
}

function getListItemsTextContents(items) {
  const toStrip = /^\s+en$|\n|➜|\(.+\)$/gm;

  let itemValues = items.
    map((i,el)=>$(el).text().replace(toStrip,'').trim());
  return _(itemValues).map(el=>el).uniq().valueOf();
}

function getCNValues(doc, targetText) {
  return getListItemsTextContents(getListItems(getTargetNextSibling(doc, targetText)));
}

async function fetchWordValues(baseWord) {
  let targets = ['types of', 'properties of', 'created by', 'made of', 'location of', 'is capable of', 'parts of', 'has', 'used for', 'causes of'];
  let wordVals = {};
  let res = await R.getAsync(`${CNROOT}/c/en/${baseWord}`);
  let conceptDoc = $.load(res.body);
  
  // Punt if there's a root word e.g. "pundit" for "pundits"?
  let hasRootWords = getListItems(getTargetNextSibling(conceptDoc, 'root word')).length;
  if (hasRootWords) {
    // console.log("Fetching a root word instead...");
    let rootWordPath = getListItems(getTargetNextSibling(conceptDoc, "root word")).
                    children('a').
                    map( (i,el) => $(el).attr('href') ).
                    filter((i,href) => href.startsWith('/c'))[0];
    baseWord = _.last(rootWordPath.split('/'));
    res = await R.getAsync(`${CNROOT}${rootWordPath}`);
    conceptDoc = $.load(res.body);
  }

  let availableItems = _.reduce(targets, function(acc, target) {
    acc[_.camelCase(target)] = getCNValues(conceptDoc, target);
    return acc;
  }, {})

  wordVals.word = baseWord;
  wordVals.edges = _.omitBy(availableItems, el=>el.length==0);
  // console.log(wordVals);
  return wordVals;
}

function generateTerminus() {
  let terminus =  Math.random() >= 0.98 ? '‽' : _.sample(['','.','?','!']);
  terminus += Math.random() >= 0.80 ? terminus.charAt(0) : '';
  terminus += Math.random() >= 0.80 ? terminus.charAt(0) : '';
  return terminus;
}

function baseOrSuffix(base, suffix, sufChance=0.5) {
  if (Math.random() <= sufChance) {
    base += suffix
  }
  return base;
}

function seeOrSeen(chance) {
  return baseOrSuffix('see','n',0.4);
}

function useOrUsed(chance) {
  return baseOrSuffix('use','d',0.4);
}

async function main() {
  let theWord = process.argv[2] || _.sample([rw('nn'),_.sample(words)]);
  let status;
  let preamble = 
    (Math.random() >= 0.9 ? _.sample(['sure ','ok ','i guess ']) : '') + 
    'sex is alright but ' +
    (Math.random() > 0.85 ? 'like ': '') +
    // (Math.random() > 0.20 ? 'have ' : '') +
    (_.sample(['u','you','yall'])) + 
    ' ever' +
    (Math.random() > 0.95 ? ' like': '') + 
    (Math.random() > 0.95 ? ' totally': '');
  let terminus = generateTerminus();
  let subject;
  let predicate = '';
  let wordVals, edges;
  let postPreamble = seeOrSeen;
  let takesPredicate = true;

  // console.log(`the magic word is: ${theWord}`);
  wordVals = await fetchWordValues(theWord);
  console.log(`the magic word is now: ${wordVals.word}`);
  subject = wordVals.word;
  edges = wordVals.edges
  // console.log(`and it can embellish with: ${Object.keys(wordVals.edges)}`);

  // Let's do some awful random chance, hey? Watch this
  if (edges.typesOf && Math.random() >= 0.7) {
    subject = _.sample(edges.typesOf);
  }

  if (edges.propertiesOf && Math.random() >= 0.2) {
    subject = [_.sample(edges.propertiesOf), subject].join(' ');
  }

  if (edges.createdBy && Math.random() >= 0.8) {
    subject = [_.sample(edges.createdBy), _.sample(['create','make']), subject].join(' ');
    takesPredicate = false;
  } else if (edges.madeOf && Math.random() >= 0.8) {
    subject = [_.sample(edges.madeOf), _.sample(['become','form', 'turn into', 'transform into']), subject].join(' ');
    takesPredicate = false;
  }

  if (takesPredicate) {
    if (edges.definedAs && Math.random() >= 0.7 ) {
      predicate = `, the ${_.sample(edges.definedAs)}`;
    }
    if (edges.propertiesOf && Math.random() >= 0.15 ) {
      predicate = ` in all its ${_.sample(edges.propertiesOf)}${_.sample([' glory',' majesty','','','',''])}`;
    }
    if (edges.locationOf && Math.random() >= 0.2)  {
      predicate = ` in ${_.sample(edges.locationOf)}`
    }
    if ( (edges.causesOf || edges.isCapableOf || edges.subevents) && Math.random() >= 0.2 ) {
      let pool = _.reject( _.concat(edges.causesOf, edges.isCapableOf, edges.subevents), el=>el == undefined || el == null);
      predicate = ` ${_.sample(pool)}`;
    }
    if ( (edges.partsOf || edges.has) && Math.random() >= 0.15 ) {
      let pool = _.reject( _.concat(edges.partsOf, edges.has), el=>el == undefined || el == null);
      predicate = `'s ${_.sample(pool)}`;
    }
    if ( (edges.effectsOf || edges.thingsCreated) && Math.random() >= 0.1) {
      let pool = _.reject( _.concat(), el=>el == undefined || el == null);
      predicate = ` ${_.sample(['create', 'give rise to'])} ${_.sample(pool)}`;
    }
    if ( edges.usedFor && Math.random() >= 0.1) {
      postPreamble = useOrUsed;
      let item = _.sample(edges.usedFor);
      if (_.endsWith(item.replace(/^an? /,'').split(' ')[0], 'ing')) { 
        predicate = ` for ${item}`;
      }
      else if (item.reStartsWith(/an? |the /)) {
        predicate = ` as ${item}`;
      }
      else {
        predicate = ` to ${item}`;
      }
    }
    status = `${preamble} ${postPreamble()} the ${subject}${predicate}${terminus}`.replace(/s's/g, `s'`).replace('_', ' ').toLowerCase();
  } else {
    status = `${preamble} ${postPreamble()} the ${subject}${terminus}`.replace(/s's/g, `s'`).replace('_', ' ').toLowerCase();
  }

  console.log(status);
  return T.makeTweet(status);
}

main().then(res=>console.log(`CONSEXT twote: ${res.data.id_str}`)).catch(console.error);
