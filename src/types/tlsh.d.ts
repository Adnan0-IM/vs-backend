declare module "tlsh" {
  export function hash(data: Buffer | Uint8Array): string;
  export function compare(hash1: string, hash2: string): number;
  export default {
    hash: (data: Buffer | Uint8Array) => string,
    compare: (hash1: string, hash2: string) => number
  };
}
