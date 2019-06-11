"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memory_1 = require("wasm-common/memory");
function default_1(Sha1Wasm) {
    const mem = new memory_1.default({ initial: 2 });
    const instance = new WebAssembly.Instance(Sha1Wasm, {
        module: {},
        env: {
            memory: mem.memory,
        },
    });
    const SIZE_OF_CONTEXT = instance.exports._sizeof_SHA1Context();
    const SIZE_OF_DIGEST = instance.exports._sizeof_SHA1Hash();
    function sum(input, encoding) {
        const ctx = new_context();
        try {
            feed(ctx, input);
            return encoded_result(ctx, encoding);
        }
        finally {
            mem.free(ctx);
        }
    }
    class Summer {
        constructor() {
            this._context = new_context();
        }
        push(data) {
            this._assert();
            feed(this._context, data);
        }
        digest(encoding) {
            this._assert();
            return encoded_result(this._context, encoding);
        }
        close() {
            this._assert();
            this._freed = true;
            mem.free(this._context);
        }
        _assert() {
            if (this._freed) {
                throw new Error('Summer may not be used after it has been closed');
            }
        }
    }
    function new_context() {
        const ptr = mem.alloc(SIZE_OF_CONTEXT);
        instance.exports._SHA1Reset(ptr);
        return ptr;
    }
    function encoded_result(ctx, encoding) {
        const digest = result(ctx);
        if (encoding === 'hex') {
            return Array.from(digest).map((b) => ('0' + b.toString(16)).slice(-2)).join('');
        }
        return digest;
    }
    function result(context_ptr) {
        const ptr = mem.alloc(SIZE_OF_DIGEST);
        try {
            handle_error(instance.exports._SHA1Result(context_ptr, ptr));
            return mem.copyOut(ptr, SIZE_OF_DIGEST);
        }
        finally {
            mem.free(ptr);
        }
    }
    function feed(context_ptr, input) {
        if (typeof input === 'string') {
            input = new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));
        }
        else if (ArrayBuffer.isView(input)) {
            input = new Uint8Array(input.buffer);
        }
        else if (input instanceof ArrayBuffer) {
            input = new Uint8Array(input);
        }
        else if (!(input instanceof Uint8Array)) {
            throw new Error('unexpected type: ' + typeof input);
        }
        const ptr = mem.copyIn(input);
        try {
            handle_error(instance.exports._SHA1Input(context_ptr, ptr, input.length));
        }
        finally {
            mem.free(ptr);
        }
    }
    function handle_error(code) {
        if (code === 1) {
            throw new Error('input too long');
        }
        else if (code === 2) {
            throw new Error('state error');
        }
        else if (code !== 0) {
            throw new Error(`unexpected error code: ${code}`);
        }
    }
    return { sum, Summer };
}
exports.default = default_1;
