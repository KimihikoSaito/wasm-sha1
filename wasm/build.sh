#!/bin/bash

FUNCTIONS=(
    'SHA1Reset'
    'SHA1Result'
    'SHA1Input'
    'sizeof_SHA1Context'
    'sizeof_SHA1Hash'
)

for f in "${FUNCTIONS[@]}"; do
    COMBINED="$COMBINED,'_$f'"
done

OUT_DIR=$(dirname "$0")
emcc -s "EXPORTED_FUNCTIONS=[${COMBINED: 1}]" -Os "$OUT_DIR/sha1.c" "$OUT_DIR/sizes.c" -o "$OUT_DIR/sha1.wasm"
# wasm2wat "$OUT_DIR/sha1.wasm" -o "$OUT_DIR/sha1.wat"
