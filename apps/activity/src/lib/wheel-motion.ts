export interface WheelDecelerationPlan {
  startAngle: number;
  endAngle: number;
  startVelocity: number;
  duration: number;
  deceleration: number;
}

interface CreateWheelDecelerationOptions {
  startAngle: number;
  targetRotation: number;
  startVelocity: number;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function createWheelDeceleration({
  startAngle,
  targetRotation,
  startVelocity,
}: CreateWheelDecelerationOptions): WheelDecelerationPlan {
  const safeVelocity = Math.max(startVelocity, 0.001);
  const alignment = positiveModulo(targetRotation - startAngle, 360);
  const distance = 360 + alignment;
  const duration = (2 * distance) / safeVelocity;

  return {
    startAngle,
    endAngle: startAngle + distance,
    startVelocity: safeVelocity,
    duration,
    deceleration: safeVelocity / duration,
  };
}

export function sampleWheelDeceleration(
  plan: WheelDecelerationPlan,
  elapsed: number,
): { angle: number; velocity: number; complete: boolean } {
  const time = Math.min(Math.max(elapsed, 0), plan.duration);
  const angle =
    plan.startAngle +
    plan.startVelocity * time -
    0.5 * plan.deceleration * time * time;

  return {
    angle: time === plan.duration ? plan.endAngle : angle,
    velocity: Math.max(0, plan.startVelocity - plan.deceleration * time),
    complete: time === plan.duration,
  };
}
