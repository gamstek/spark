import { describe, expect, it } from 'vitest';

import { resolveDevelopmentSimulation } from './development-simulation';

describe('resolveDevelopmentSimulation', () => {
  it('enables the simulated session only when explicitly configured in development', () => {
    expect(
      resolveDevelopmentSimulation({
        mode: 'simulate',
        development: true,
      }),
    ).toBe(true);
  });

  it('ignores the simulation setting in production', () => {
    expect(
      resolveDevelopmentSimulation({
        mode: 'simulate',
        development: false,
      }),
    ).toBe(false);
  });

  it('uses the standard activity session when simulation is not configured', () => {
    expect(
      resolveDevelopmentSimulation({
        mode: undefined,
        development: true,
      }),
    ).toBe(false);
  });
});
