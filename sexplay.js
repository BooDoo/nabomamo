#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);

const CORPORAPATH = './assets/corpora-project/';

const objects = require(CORPORAPATH+'objects/objects').objects;
const verbs = require(CORPORAPATH+'words/verbs').verbs.map(verb=>verb.present);
const building_materials = require(CORPORAPATH+'materials/building-materials')["building materials"];
const layperson_metals = require(CORPORAPATH+'materials/layperson-metals')["layperson metals"];
const greek_gods = require(CORPORAPATH+'mythology/greek_gods').greek_gods;
const monsters = require(CORPORAPATH+'mythology/monsters').names;
const norse_deities = _.flatMap(require(CORPORAPATH+'mythology/norse_gods').norse_deities);
const bodyparts = require(CORPORAPATH+'humans/bodyParts').bodyParts;


const words = _.concat(objects, verbs, building_materials, layperson_metals, greek_gods, monsters, norse_deities, bodyparts).
  map(item=>item.replace(/[ \.,:;\!\?'"]/g,''));

const quals = ["is", "is not", "isn't", "is never", "is always", 
    "will never be", "has always been", "might be", "could be",
    "must be", "will soon be", "doesn't sounds like", "sounds a lot like",
    "can't be", "is now", "has become", "is my kind of"];

let status = `"${_.sample(words)}play" ${_.sample(quals)} "a sex thing"`;

REST.post('statuses/update', {status: status}).
then(res => {
  console.log(`SEXPLAY twote:\n${res.data.id_str}, ${res.data.text}`);
}).
catch(console.error)
