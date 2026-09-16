import TLSH from "tlsh-typescript";

export function computeTLSH(buffer: Buffer): string | null {
  if (buffer.length < 256) {
    return null;
  }
  try {
    const tlsh = new TLSH();
    tlsh.update(buffer);
    tlsh.finale();
    return tlsh.hash();
  } catch (err) {
    console.warn("Failed to compute TLSH:", err);
    return null;
  }
}

export function compareTLSH(hash1: string, hash2: string): number {
  try {
    const t1 = new TLSH();
    t1.fromTlshStr(hash1);

    const t2 = new TLSH();
    t2.fromTlshStr(hash2);

    const diff = t1.totalDiff(t2);
    const similarity = Math.max(0, 100 - diff);
    return similarity;
  } catch (err) {
    console.warn("Failed to compare TLSH:", err);
    return 0;
  }
}