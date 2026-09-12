import { createElement, type ReactNode } from 'react';
import type * as RadixThemes from '@radix-ui/themes';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantDetailDialog } from './participant-detail-dialog';

// Radix portals require a browser. Render their content inline here; actual
// focus, dismissal and scroll behavior are exercised by the browser fixture.
vi.mock('@radix-ui/themes', async (importOriginal) => {
  const original = await importOriginal<typeof RadixThemes>();
  return {
    ...original,
    Dialog: {
      Root: ({ open, children }: { open: boolean; children: ReactNode }) =>
        open ? children : null,
      Content: ({ children }: { children: ReactNode }) =>
        createElement('div', { role: 'dialog' }, children),
      Title: ({ children }: { children: ReactNode }) =>
        createElement('h2', {}, children),
      Description: ({ children }: { children: ReactNode }) =>
        createElement('p', {}, children),
      Close: ({ children }: { children: ReactNode }) => children,
    },
  };
});

const answers = {
  name: '张三',
  organization: '星火研究院',
  department: '分析实验室',
  jobTitle: '研究员',
  phone: '13800138000',
  email: 'participant@example.com',
  researchAreas: ['life_sciences', 'other'] as const,
  researchAreaOther: '交叉研究',
  instrumentInterests: ['mass_spectrometry'] as const,
  visitPurposes: ['new_products'] as const,
  followUpPreferences: ['product_pdf'] as const,
  contactPreference: 'email_first' as const,
  onsiteAvailability: 'available' as const,
};

describe('ParticipantDetailDialog', () => {
  it('renders all 13 questions in order with Chinese options and an unanswered optional question', () => {
    const html = renderToStaticMarkup(
      <ParticipantDetailDialog
        open
        answers={{
          ...answers,
          researchAreas: [...answers.researchAreas],
          instrumentInterests: [...answers.instrumentInterests],
          visitPurposes: [...answers.visitPurposes],
          followUpPreferences: [...answers.followUpPreferences],
        }}
        onOpenChange={() => undefined}
      />,
    );
    const questions = [...html.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map(
      (match) => match[1],
    );
    expect(questions).toHaveLength(13);
    expect(questions.map((question) => question?.slice(0, 2))).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
    ]);
    expect(html).toContain('生命科学（制药、生物技术、CRO）；其他（交叉研究）');
    expect(html).toContain(
      '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）',
    );
    expect(html).toContain('请先通过邮件发送资料');
    expect(html).toContain('其他具体需求或咨询</dt><dd>未填写</dd>');
    expect(html).not.toContain('life_sciences');
  });

  it('explains a missing submission without pretending answers exist', () => {
    const html = renderToStaticMarkup(
      <ParticipantDetailDialog
        open
        answers={null}
        onOpenChange={() => undefined}
      />,
    );
    expect(html).toContain('暂无登记详情');
    expect(html).not.toContain('<dt');
  });
});
