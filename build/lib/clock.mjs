export const FROZEN_INSTANT_VARIABLE = 'EVALS_BASELINE_FROZEN_INSTANT';

export function freezeClock(isoInstant) {
  const RealDate = globalThis.Date;
  const instant = RealDate.parse(isoInstant);
  if (Number.isNaN(instant)) throw new TypeError(`not an instant: ${isoInstant}`);

  class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [instant] : args));
    }

    static now() {
      return instant;
    }
  }

  globalThis.Date = FrozenDate;
  return () => {
    globalThis.Date = RealDate;
  };
}
