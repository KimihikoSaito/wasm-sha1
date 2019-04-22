declare namespace WebAssembly {
    class Module {}
    class Table {
        constructor(options: any);
    }
    class Memory {
        buffer: ArrayBuffer;
        constructor(options: any);
        grow(pages: number): void;
    }
    class Instance {
        exports: any;
        constructor(module: Module, options: any);
    }
}
