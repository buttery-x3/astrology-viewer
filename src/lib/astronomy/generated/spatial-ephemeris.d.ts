export interface EmscriptenModule {
  HEAPF64: Float64Array;
  HEAPU8: Uint8Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  ccall(name: string, returnType: string | null, argumentTypes: string[], values: (string | number)[]): number | string;
  UTF8ToString(pointer: number): string;
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
}
export default function createSpatialEphemeris(options?: {
  wasmBinary?: Uint8Array;
  locateFile?: (name: string) => string;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}): Promise<EmscriptenModule>;
