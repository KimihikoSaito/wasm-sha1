import Memory from 'wasm-common/memory';

export default function(Sha1Wasm: WebAssembly.Module, { grow = 0 }: { grow: number } = {}) {
    const mem = new Memory({ initial: 256, maximum: 256 + grow });
    
    const instance = new WebAssembly.Instance(Sha1Wasm, {
        module: {},
        env: {
            memory: mem.memory,
        },
    });

    const SIZE_OF_CONTEXT = instance.exports._sizeof_SHA1Context();
    const SIZE_OF_DIGEST = instance.exports._sizeof_SHA1Hash();

    function sum(input: any): Uint8Array;
    function sum(input: any, encoding: 'hex'): string;
    function sum(input: any, encoding?: 'hex'): any {
        const ctx = new_context();
        
        try {
            feed(ctx, input);
            return encoded_result(ctx, encoding);
        } finally {
            mem.free(ctx);
        }
    }
    
    class Summer {
        private _context: number;
        private _freed: boolean;
    
        public constructor() {
            this._context = new_context();
        }
    
        public push(data: any): void {
            this._assert();
            feed(this._context, data);
        }
    
        public digest(): Uint8Array;
        public digest(encoding: 'hex'): string;
        public digest(encoding?: 'hex'): any {
            this._assert();
            return encoded_result(this._context, encoding);
        }
    
        public close(): void {
            this._assert();
            this._freed = true;
            mem.free(this._context);
        }
    
        private _assert(): void {
            if (this._freed) {
                throw new Error('Summer may not be used after it has been closed');
            }
        }
    }
    
    function new_context(): number {
        const ptr = mem.alloc(SIZE_OF_CONTEXT);
        instance.exports._SHA1Reset(ptr);
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
        const ptr = mem.alloc(SIZE_OF_DIGEST);
        try {
            handle_error(instance.exports._SHA1Result(context_ptr, ptr));
            return mem.copyOut(ptr, SIZE_OF_DIGEST);
        } finally {
            mem.free(ptr);
        }
    }
    
    function feed(context_ptr: number, input: any): void {
        if (typeof input === 'string') {
            input = new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));
        } else if (ArrayBuffer.isView(input)) {
            input = new Uint8Array(input.buffer);
        } else if (input instanceof ArrayBuffer) {
            input = new Uint8Array(input);
        } else if (!(input instanceof Uint8Array)) {
            throw new Error('unexpected type: ' + typeof input);
        }

        const ptr = mem.copyIn(input);
        try {
            handle_error(instance.exports._SHA1Input(context_ptr, ptr, input.length));
        } finally {
            mem.free(ptr);
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

    return { sum, Summer };
}
