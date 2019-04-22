#!/bin/bash

clang -cc1 -O3 -emit-llvm-bc -triple=wasm32-unknown-unknown-wasm -std=c11 sha1.c
llc -O3 -filetype=obj sha1.bc -o sha1.o
wasm-ld --no-entry sha1.o -o sha1.wasm --export SHA1Reset --export SHA1Result --export SHA1Input --strip-all --import-memory
rm sha1.bc sha1.o
