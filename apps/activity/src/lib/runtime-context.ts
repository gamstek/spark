import { createContext } from 'react';
import type {
  ActivityFormSubmissionInput,
  RuntimeStep,
  WinView,
} from '@spark/contracts';

export type ActivityView = 'home' | 'flow' | 'rules' | 'info' | 'prizes';

export interface ActivityDisplay {
  code: string;
  title: string;
  startsAt: string;
  endsAt: string;
  dates: string;
  organizer: string;
  rulesText: string;
  noPrizeWeight: number;
  prizes: { prizeLevel: string; name: string; imageUrl?: string }[];
}

export interface PrizeCodeView {
  code: string;
  qrUrl: string;
}

export interface ActivityRuntimeValue {
  step: RuntimeStep;
  view: ActivityView;
  loading: boolean;
  loadError: string | null;
  activity: ActivityDisplay;
  win: WinView | null;
  prizeCode: PrizeCodeView | null;
  message: string | null;
  drawing: boolean;
  formSubmitted: boolean;
  openView: (view: ActivityView) => void;
  closeView: () => void;
  participate: () => Promise<void>;
  verifySubscribe: () => Promise<void>;
  submitActivityForm: (input: ActivityFormSubmissionInput) => Promise<void>;
  continueToLottery: () => Promise<void>;
  draw: () => Promise<void>;
  showPrize: () => void;
  showMyPrizes: () => void;
  setMessage: (message: string | null) => void;
}

export const ActivityRuntimeContext =
  createContext<ActivityRuntimeValue | null>(null);
