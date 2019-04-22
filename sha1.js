"use strict";
const SIZE_OF_CONTEXT = 128;
const SIZE_OF_DIGEST = 20;
module.exports = function (Sha1Wasm) {
    const memory = new WebAssembly.Memory({ initial: 2 });
    const allocs = [];
    let view = new Uint8Array(memory.buffer);
    const instance = new WebAssembly.Instance(Sha1Wasm, {
        module: {},
        env: {
            memory: memory,
            table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
        },
    });
    async function sum(input, encoding) {
        if (!(input instanceof Uint8Array) && !(input instanceof ReadableStream)) {
            if (typeof input === 'string') {
                input = new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));
            }
            else if (ArrayBuffer.isView(input)) {
                input = new Uint8Array(input.buffer);
            }
            else if (input instanceof ArrayBuffer) {
                input = new Uint8Array(input);
            }
            else {
                throw new Error(`unsupported input type: ${input[Symbol.toStringTag]}`);
            }
        }
        const ctx = new_context();
        try {
            if (input instanceof ReadableStream) {
                const reader = input.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    if (!value.length) {
                        continue;
                    }
                    feed(ctx, value);
                }
            }
            else {
                feed(ctx, input);
            }
            return encoded_result(ctx, encoding);
        }
        finally {
            free(ctx);
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
            free(this._context);
        }
        _assert() {
            if (this._freed) {
                throw new Error('Summer may not be used after it has been closed');
            }
        }
    }
    function new_context() {
        const ptr = malloc(SIZE_OF_CONTEXT);
        instance.exports.SHA1Reset(ptr);
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
        const ptr = malloc(SIZE_OF_DIGEST);
        try {
            handle_error(instance.exports.SHA1Result(context_ptr, ptr));
            return view.slice(ptr, ptr + SIZE_OF_DIGEST);
        }
        finally {
            free(ptr);
        }
    }
    function feed(context_ptr, buffer) {
        const ptr = malloc(buffer.length);
        try {
            view.set(buffer, ptr);
            handle_error(instance.exports.SHA1Input(context_ptr, ptr, buffer.length));
        }
        finally {
            free(ptr);
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
    // MEMORY MANAGEMENT START
    function malloc(length) {
        if (!allocs.length) {
            allocs.push([0, length]);
            return 0;
        }
        // look for space in between allocations
        const last_alloc = allocs[allocs.length - 1];
        if (allocs.length > 1) {
            if (last_alloc[0] + last_alloc[1] + length > view.length) {
                // not enough memory to allocate
                memory.grow(1);
                view = new Uint8Array(memory.buffer);
                return malloc(length);
            }
            for (let i = 0; i < allocs.length - 1; i++) {
                const a = allocs[i][0] + allocs[i][1];
                const b = allocs[i + 1][0];
                if (b - a >= length) {
                    allocs.splice(i + 1, 0, [a, length]);
                    return a;
                }
            }
        }
        // allocate at the end
        const ptr = last_alloc[0] + last_alloc[1];
        allocs.push([ptr, length]);
        return ptr;
    }
    function free(ptr) {
        for (const [i, alloc] of allocs.entries()) {
            if (alloc[0] === ptr) {
                allocs.splice(i, 1);
                return;
            }
        }
        throw new Error('attempted to free invalid pointer');
    }
    // MEMORY MANAGEMENT END
    return { sum, Summer };
};
