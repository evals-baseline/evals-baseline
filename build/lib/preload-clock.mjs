import { FROZEN_INSTANT_VARIABLE, freezeClock } from './clock.mjs';

freezeClock(process.env[FROZEN_INSTANT_VARIABLE]);
