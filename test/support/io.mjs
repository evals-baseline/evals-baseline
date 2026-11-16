export const fixedClock = new Date('2026-11-11T12:00:00.000Z');

export function failure(code) {
  return Object.assign(new Error(`${code}: simulated`), { code });
}

export function makeIo(files = {}, now = fixedClock) {
  const store = new Map(Object.entries(files));
  const writes = [];
  return {
    store,
    writes,
    readFile(path) {
      if (!store.has(path)) {
        throw failure('ENOENT');
      }
      const content = store.get(path);
      if (content instanceof Error) {
        throw content;
      }
      return content;
    },
    writeFile(path, text) {
      const refusal = store.get(`write:${path}`);
      if (refusal instanceof Error) {
        throw refusal;
      }
      writes.push([path, text]);
      store.set(path, text);
    },
    now: () => now,
  };
}
