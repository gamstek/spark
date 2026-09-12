import type { ActivityFormSubmissionInput } from '@spark/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { activityApi } from './api';

const form: ActivityFormSubmissionInput = {
  name: '张三',
  organization: '星火科技',
  department: '研发部',
  jobTitle: '研究员',
  phone: '13800138000',
  email: 'zhangsan@example.com',
  researchAreas: ['life_sciences'],
  instrumentInterests: ['chromatography'],
  visitPurposes: ['new_products'],
  followUpPreferences: ['product_pdf'],
  contactPreference: 'email_first',
  onsiteAvailability: 'available',
  otherNeeds: '',
  privacyAccepted: true,
};

describe('activityApi.submitForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the submitted form and runtime CSRF token to the local endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await activityApi.submitForm('expo-2026', 'csrf-token', form);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity/expo-2026/form-submissions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify(form),
      }),
    );
  });
});
