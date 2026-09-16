import { describe, expect, it } from 'vitest';

import {
  createWheelDeceleration,
  sampleWheelDeceleration,
} from './wheel-motion';

describe('wheel deceleration', () => {
  it('inherits the current angular velocity without a speed jump', () => {
    const plan = createWheelDeceleration({
      startAngle: 137,
      targetRotation: -90,
      startVelocity: 0.5,
    });

    expect(sampleWheelDeceleration(plan, 0).velocity).toBeCloseTo(0.5);
  });

  it('slows down monotonically and never accelerates again', () => {
    const plan = createWheelDeceleration({
      startAngle: 137,
      targetRotation: -90,
      startVelocity: 0.5,
    });
    const samples = Array.from({ length: 21 }, (_, index) =>
      sampleWheelDeceleration(plan, (plan.duration * index) / 20),
    );

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!.velocity).toBeLessThanOrEqual(
        samples[index - 1]!.velocity,
      );
    }
    expect(samples.at(-1)?.velocity).toBeCloseTo(0);
  });

  it('lands exactly on the requested prize angle after at least one turn', () => {
    const plan = createWheelDeceleration({
      startAngle: 137,
      targetRotation: -90,
      startVelocity: 0.5,
    });
    const finalSample = sampleWheelDeceleration(plan, plan.duration);

    expect(plan.endAngle - plan.startAngle).toBeGreaterThanOrEqual(360);
    expect(((finalSample.angle % 360) + 360) % 360).toBeCloseTo(270);
  });
});
