# wasm-sha1

A (slightly modified) [implementation of SHA-1](http://mattmahoney.net/dc/) compiled to wasm and wrapped because [SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) [doesn't support streaming data](https://github.com/w3c/webcrypto/issues/73).

## API

Each data-accepting function (`sum()`, `Summer.push()`) accepts the following input types:

-   string
-   BufferSource
-   ReadableStream<Uint8Array>

### sum

`sum("hello")` yields `Uint8Array(20) [245, 114, 211, 150, 250, 233, 32, 102, 40, 113, 79, 178, 206, 0, 247, 46, 148, 242, 37, 143]`

`sum("hello", "hex")` yields `"f572d396fae9206628714fb2ce00f72e94f2258f"`

### Summer

```
const summer = new Summer();
summer.push('he');
summer.push('llo');
summer.digest(); // or summer.digest("hex");
```

## Importing

Load `sha.wasm` following the intructions of https://developer.mozilla.org/en-US/docs/WebAssembly/Loading_and_running and pass the resulting module to the default export.

```
const fs = require('fs');
const { default } = require('./sha1');

...

const wasm = fs.readFileSync('sha1.wasm');
const module = await WebAssembly.compile(wasm);
const { sum, Summer } = default(module);
```

or with web APIs

```
const module = await WebAssembly.compileStreaming(fetch('sha1.wasm'));
```

## Building

https://github.com/cloudflare/cloudflare-workers-wasm-demo#how-to-build

Then run `npm run build`
