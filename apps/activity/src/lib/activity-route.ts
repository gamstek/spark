import type { ActivityView } from './runtime-context';

const segmentByView: Record<ActivityView, string> = {
  home: '',
  rules: 'rules',
  info: 'info',
  flow: 'participate',
  prizes: 'prizes',
};

export function activityViewFromPath(pathname: string): ActivityView {
  const segment = pathname.replace(/\/+$/, '').split('/').at(-1);
  if (segment === 'rules') return 'rules';
  if (segment === 'info') return 'info';
  if (segment === 'participate') return 'flow';
  if (segment === 'prizes') return 'prizes';
  return 'home';
}

export function activityPath(code: string, view: ActivityView): string {
  const base = `/${encodeURIComponent(code)}`;
  const segment = segmentByView[view];
  return segment ? `${base}/${segment}` : base;
}
