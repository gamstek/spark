import { useContext } from 'react';

import {
  ActivityRuntimeContext,
  type ActivityRuntimeValue,
} from '../lib/runtime-context';

export function useRuntime(): ActivityRuntimeValue {
  const context = useContext(ActivityRuntimeContext);
  if (!context)
    throw new Error('useRuntime must be used within ActivityRuntimeProvider');
  return context;
}
