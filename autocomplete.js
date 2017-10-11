#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');
const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const CORPORAPATH = './assets/corpora-project/';

const animals = require(CORPORAPATH+'animals/common').animals;
const bodyParts = require(CORPORAPATH+'humans/bodyParts').bodyParts;
const passages = require(CORPORAPATH+'architecture/passages.json').passages;

const settings = _.flatMap(require(CORPORAPATH+'archetypes/setting').settings, el=>_.concat(el.synonyms, el.name));
const events = _.flatMap(require(CORPORAPATH+'archetypes/event').events, el=>_.concat(el.synonyms, el.name));
const artifacts = _.flatMap(require(CORPORAPATH+'archetypes/artifact').artifacts, el=>_.concat(el.synonyms, el.name));
const characters = _.flatMap(require(CORPORAPATH+'archetypes/character').characters, el=>_.concat(el.synonyms, el.name));

const words = _.concat(animals, bodyParts, passages, settings, events, artifacts, characters);

const ordinal = ["first", "second", "third", "1st", "2nd", "3rd"];

let status = `quote this with "${_.sample(words)}" and just keep hitting the ${_.sample(ordinal)} suggested word until u run out of characters`;

REST.post('statuses/update', {status: status}).
then(res => {
  console.log(`AUTOCOMPLETE twote:\n${res.data.id_str}, ${res.data.text}`);
}).
catch(console.error);
