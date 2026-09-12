import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ActionButton } from '../components/action-button';
import { SubmitSuccessPage } from './submit-success-page';

const runtime = vi.hoisted(() => ({
  activity: { title: '测试活动' },
  continueToLottery: vi.fn(),
}));

vi.mock('../hooks/use-runtime', () => ({ useRuntime: () => runtime }));
vi.mock('../hooks/use-document-title', () => ({
  useDocumentTitle: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

type ActionButtonElement = ReactElement<{
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}>;

function findActionButton(node: ReactNode): ActionButtonElement | null {
  if (!node || typeof node !== 'object') return null;
  const element = node as ActionButtonElement;
  if (element.type === ActionButton) return element;
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findActionButton(child);
      if (found) return found;
    }
    return null;
  }
  return findActionButton(children);
}

describe('SubmitSuccessPage', () => {
  it('continues to the lottery when the user chooses 去抽奖', () => {
    runtime.continueToLottery.mockReset();
    const button = findActionButton(SubmitSuccessPage());

    expect(button).not.toBeNull();
    button?.props.onClick?.({} as MouseEvent<HTMLButtonElement>);

    expect(runtime.continueToLottery).toHaveBeenCalledOnce();
  });
});
