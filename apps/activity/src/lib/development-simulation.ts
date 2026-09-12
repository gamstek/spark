export function resolveDevelopmentSimulation({
  mode,
  development,
}: {
  mode: string | undefined;
  development: boolean;
}): boolean {
  return development && mode === 'simulate';
}
