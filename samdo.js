#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./lib/mt-rng');

const _ = require('lodash');
const P = require('bluebird');
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const Wordnik = require('wordnik-as-promised');
const wn = new Wordnik(creds.wordnik.api_key);

const firstWords = "shower library tree highway workplace office bathroom toilet pagoda classroom  bedroom boudoir roof sidewalk lake orbit".split(' ');
const secondWords = "egg beer avocado loaf candy food meal dinner supper breakfast brunch snack bread cheese wine merlot vodka spirit salad lettuce banana".split(' ');

function getRelated(w) {
  let target = `http://api.wordnik.com/v4/word.json/${w}/relatedWords?useCanonical=true&relationshipTypes=same-context,hypernym&limitPerRelationshipType=30&api_key=${creds.wordnik.api_key}`
  return request.getAsync({url: target, json: true})
  .then(res => _.flatMap(res.body, "words"));
}

// Pick a seed word from each list and fetch related words for each
P.all([
  getRelated(_.sample(firstWords)),
  getRelated(_.sample(secondWords))
])
.spread((firstPool, secondPool) => {
  // pick one from each pool of related words and put it in the snowclone
  let firstWord = _.sample(firstPool),
      secondWord = _.sample(secondPool),
      status = `sam do ${firstWord} ${secondWord}`;
  return status;
})
.then(status => REST.post('statuses/update', {status: status}))
.then(res => {
  // Logging our successful tweet
  console.log(`SAMDO twote:\n${res.data.id_str}, ${res.data.text}`);
})
.catch(console.error);
