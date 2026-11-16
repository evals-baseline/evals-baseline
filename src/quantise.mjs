import { datum } from './printable.mjs';

const microUnitsPerUnit = 1000000;

export const largestQuantisable = 4000000000;

export function quantise(value) {
  const micro = Math.round(value * microUnitsPerUnit);
  return micro === 0 ? 0 : micro;
}

export function isQuantisable(value) {
  return typeof value === 'number' && Math.abs(value) <= largestQuantisable;
}

export function formatQuantised(micro) {
  const sign = micro < 0 ? '-' : '';
  const digits = String(Math.abs(micro)).padStart(7, '0');
  const whole = digits.slice(0, -6);
  const fraction = digits.slice(-6).replace(/0+$/, '');
  return fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

export function count(number, noun) {
  return `${number} ${noun}${number === 1 ? '' : 's'}`;
}

export function roundToMillionths(value) {
  return quantise(value) / microUnitsPerUnit;
}

export function listKeys(keys) {
  const listed = keys.slice(0, 10).map(datum).join(', ');
  return keys.length > 10 ? `${listed}, and ${keys.length - 10} more` : listed;
}
