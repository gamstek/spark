import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { RuntimeStep } from '@spark/contracts';
import { TRANSITIONS } from './runtime-steps';
import { ACTIVITY } from './activity';
import { WIN } from './redemption';
import type { DemoWin } from './redemption';

/** 正交视图：非状态机但需要独立预览的屏 */
export type DemoView = 'main' | 'info' | 'redeemed-success' | 'follow-success';

interface DemoRuntime {
  step: RuntimeStep;
  view: DemoView;
  activity: typeof ACTIVITY;
  win: DemoWin;
  go: (next: RuntimeStep, opts?: { free?: boolean }) => void;
  openView: (view: DemoView) => void;
  closeView: () => void;
  reset: () => void;
}

const STORAGE_KEY = 'demo:activity:step';

/** 允许通过 ?step=X 直链预览任意屏（demo 专用） */
function readInitialStep(): RuntimeStep {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('step');
  if (fromQuery) return fromQuery.toUpperCase() as RuntimeStep;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) return stored as RuntimeStep;
  return 'NOT_STARTED';
}

const DemoRuntimeContext = createContext<DemoRuntime | null>(null);

export function DemoRuntimeProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<RuntimeStep>(readInitialStep);
  const [view, setView] = useState<DemoView>('main');

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, step);
  }, [step]);

  const go = (next: RuntimeStep, opts?: { free?: boolean }) => {
    const allowed = TRANSITIONS[step] ?? [];
    if (opts?.free || allowed.includes(next)) {
      setStep(next);
      setView('main');
    }
  };

  const value = useMemo<DemoRuntime>(
    () => ({
      step,
      view,
      activity: ACTIVITY,
      win: WIN,
      go,
      openView: (v) => setView(v),
      closeView: () => setView('main'),
      reset: () => {
        setStep('NOT_STARTED');
        setView('main');
      },
    }),
    [step, view],
  );

  return (
    <DemoRuntimeContext.Provider value={value}>
      {children}
    </DemoRuntimeContext.Provider>
  );
}

export function useDemoRuntime(): DemoRuntime {
  const ctx = useContext(DemoRuntimeContext);
  if (!ctx)
    throw new Error('useDemoRuntime must be used within DemoRuntimeProvider');
  return ctx;
}
