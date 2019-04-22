const SIZE_OF_CONTEXT = 128;
const SIZE_OF_DIGEST = 20;
    
export type SumInput = string | BufferSource | ReadableStream<Uint8Array>;

export default function(Sha1Wasm: WebAssembly.Module) {
    const memory = new WebAssembly.Memory({ initial: 2 });
    const allocs: [number, number][] = [];
    
    let view = new Uint8Array(memory.buffer);
    
    const instance = new WebAssembly.Instance(Sha1Wasm, {
        module: {},
        env: {
            memory: memory,
            table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
        },
    });

    async function sum(input: SumInput): Promise<Uint8Array>;
    async function sum(input: SumInput, encoding: 'hex'): Promise<string>;
    async function sum(input: SumInput, encoding?: 'hex'): Promise<any> {
        if (!(input instanceof Uint8Array) && !(input instanceof ReadableStream)) {
            if (typeof input === 'string') {
                input = new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));
            } else if (ArrayBuffer.isView(input)) {
                input = new Uint8Array(input.buffer);
            } else if (input instanceof ArrayBuffer) {
                input = new Uint8Array(input);
            } else {
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
            } else {
                feed(ctx, input as Uint8Array);
            }
    
            return encoded_result(ctx, encoding);
        } finally {
            free(ctx);
        }
    }
    
    class Summer {
        private _context: number;
        private _freed: boolean;
    
        constructor() {
            this._context = new_context();
        }
    
        push(data: Uint8Array): void {
            this._assert();
            feed(this._context, data);
        }
    
        digest(): Uint8Array;
        digest(encoding: 'hex'): string;
        digest(encoding?: 'hex'): any {
            this._assert();
            return encoded_result(this._context, encoding);
        }
    
        close(): void {
            this._assert();
            this._freed = true;
            free(this._context);
        }
    
        private _assert(): void {
            if (this._freed) {
                throw new Error('Summer may not be used after it has been closed');
            }
        }
    }
    
    function new_context(): number {
        const ptr = malloc(SIZE_OF_CONTEXT);
        instance.exports.SHA1Reset(ptr);
        return ptr;
    }
    
    function encoded_result(ctx: number): Uint8Array;
    function encoded_result(ctx: number, encoding: 'hex'): string;
    function encoded_result(ctx: number, encoding?: string): any {
        const digest = result(ctx);
        if (encoding === 'hex') {
            return Array.from(digest).map((b) => ('0' + b.toString(16)).slice(-2)).join('');
        }
    
        return digest;
    }
    
    function result(context_ptr: number): Uint8Array {
        const ptr = malloc(SIZE_OF_DIGEST);
        try {
            handle_error(instance.exports.SHA1Result(context_ptr, ptr));
            return view.slice(ptr, ptr + SIZE_OF_DIGEST);
        } finally {
            free(ptr);
        }
    }
    
    function feed(context_ptr: number, buffer: Uint8Array): void {
        const ptr = malloc(buffer.length);
        try {
            view.set(buffer, ptr);
            handle_error(instance.exports.SHA1Input(context_ptr, ptr, buffer.length));
        } finally {
            free(ptr);
        }
    }
    
    function handle_error(code: number): void {
        if (code === 1) {
            throw new Error('input too long');
        } else if (code === 2) {
            throw new Error('state error');
        } else if (code !== 0) {
            throw new Error(`unexpected error code: ${code}`);
        }
    }

    // MEMORY MANAGEMENT START
    
    function malloc(length: number): number {
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
    
    function free(ptr: number): void {
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
}