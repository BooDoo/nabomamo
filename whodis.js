#!/usr/bin/env node

const _ = require('lodash');

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const CORPORAPATH = './assets/corpora-project/';
const adjs = require(CORPORAPATH+'words/adjs').adjs;

const venues = _.flatten(require(CORPORAPATH+'geography/venues').categories.
  map(cat=>cat.categories.map(el=>el.name)));
const objects = require(CORPORAPATH+'objects/objects').objects;

const nouns = _.concat(venues, objects);

let status = `${_.sample(adjs)} ${_.sample(nouns)} who dis`.toLowerCase();

REST.post('statuses/update', {status: status}).
then(res => {
  console.log(`WHODIS twote:\n${res.data.id_str}, ${res.data.text}`);
}).
catch(console.error)
