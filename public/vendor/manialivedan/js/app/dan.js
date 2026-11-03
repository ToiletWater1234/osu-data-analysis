// Site adapter: use the site's existing upstream interval tables, without
// ManiaLiveDan's additional extrapolated 6K tiers, badge art or UI palettes.
import { DAN_INDEX } from '../../../mania/js/estimator/intervals/index.js';
export function tableFor(keys, kind) {
  const tables = DAN_INDEX[keys]?.[kind];
  return tables?.extended || tables?.default || [];
}
export function labelFor(star, keys, kind) {
  if (!Number.isFinite(star) || star <= 0) return '';
  return tableFor(keys, kind).find(([lo, hi]) => star >= lo && star <= hi)?.[2] || '';
}
export const formatRc = (star, keys) => labelFor(star, keys, 'RC');
export const formatLn = (star, keys) => labelFor(star, keys, 'LN');
export const parseRc = () => null;
export const parseLn = () => null;
