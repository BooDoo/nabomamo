#!/usr/bin/env sh

SCRIPT=`ls *.js | shuf -n 1`
exec ./$SCRIPT