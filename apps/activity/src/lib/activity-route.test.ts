import { describe, expect, it } from 'vitest';

import { activityPath, activityViewFromPath } from './activity-route';

describe('activity routes', () => {
  it('maps activity child paths to views', () => {
    expect(activityViewFromPath('/activity/demo')).toBe('home');
    expect(activityViewFromPath('/activity/demo/rules')).toBe('rules');
    expect(activityViewFromPath('/activity/demo/info')).toBe('info');
    expect(activityViewFromPath('/activity/demo/participate')).toBe('flow');
    expect(activityViewFromPath('/activity/demo/prizes')).toBe('prizes');
  });

  it('builds paths handled by the activity router basename', () => {
    expect(activityPath('demo', 'home')).toBe('/demo');
    expect(activityPath('demo', 'rules')).toBe('/demo/rules');
    expect(activityPath('demo', 'info')).toBe('/demo/info');
    expect(activityPath('demo', 'flow')).toBe('/demo/participate');
    expect(activityPath('demo', 'prizes')).toBe('/demo/prizes');
  });
});
