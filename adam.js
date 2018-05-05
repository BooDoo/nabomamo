#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');
const lex = new require('rita').RiLexicon();
const rw = lex.randomWord.bind(lex);

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

function getVerb(length=4) {
  let type = _.sample(['vb','vbp']);
  let verb = rw(type);
  if (verb.length == 4) {
    return verb;
  } else {
    return getVerb(length);
  }
}

REST.post('statuses/update', {status: `You're thinking about how much you want to ${getVerb()} 2B, aren't you?`})
.then(res => {
  // Logging our successful tweet
  console.log(`ADAM twote:\n${res.data.id_str}, ${res.data.text}`);
})
.catch(console.error);
