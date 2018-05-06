#!/usr/bin/env node

'use strict';

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');
const os = require('os');
const path = require('path');
const exec = require('child-process-promise').exec;
const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const request = P.promisifyAll(require('request'));
const lex = new require('rita').RiLexicon();
const rw = lex.randomWord.bind(lex);
const isAdverb = lex.isAdverb.bind(lex);

const creds = require('./credentials');
const Twit = require('twit');
Twit.prototype.postMediaChunkedAsync = P.promisify(Twit.prototype.postMediaChunked);
const REST = new Twit(creds.live);

const TMP_FILE = path.join(os.tmpdir(), 'this.png');

function isntAdverb(w) {
  if (_.words(w).length > 1) {
    return true;
  } else if (isAdverb(w)) {
    return false;
  } else {
    return true;
  }
}

function getRandomWord() {
  let target=`http://api.wordnik.com/v4/word.json/${srcWord}/randomWord?includePartOfSpeech=noun&excludePartOfSpeech=adverb&maxLength=12&api_key=${creds.wordnik.api_key}`
  return request.getAsync({url: target, json: true})
  .then(res=>res.word);
}

function getSourceWord(pos="nn") {
  let type = pos;
  let word = rw(type)
  return word
}

function getRelated(srcWord) {
  let target = `http://api.wordnik.com/v4/word.json/${srcWord}/relatedWords?useCanonical=true&relationshipTypes=same-context&limitPerRelationshipType=40&api_key=${creds.wordnik.api_key}`
  return request.getAsync({url: target, json: true})
  .then(res => _(res.body).flatMap("words").filter(isntAdverb).value() );
}

function getWordPair(srcWord=null) {
  srcWord = srcWord || getSourceWord();
  return getRelated(srcWord).
  tap(console.log).
  then(related => {return {srcWord: srcWord, relWord: _.sample(related)}; })
}

// srcWord @ +430+150
// secondWord @ +309+432

getWordPair().
  tap(console.log).
  then(words => `convert ./assets/base/isthis.png -font "Ubuntu-Condensed" -fill white -background none -pointsize 27 \\( label:"${words.srcWord}" -rotate -8 -geometry +430+150 \\) -composite \\( label:"${words.relWord}" -geometry +310+430 \\) -composite "${TMP_FILE}"`).  
  then(imCall => exec(imCall)).
  then(ret=>REST.postMediaChunkedAsync({file_path: TMP_FILE})).
  then(r=>REST.post('statuses/update', {
          status: '',
          media_ids: [r.media_id_string]
        })).
  then(res=>console.log(`ISTHIS twote:${res.data.id_str}`)).
  catch(console.error);
