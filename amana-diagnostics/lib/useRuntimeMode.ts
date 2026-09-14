'use client';

import { useEffect, useState } from 'react';
import { getRuntimeMode, serverDefaultMode, type RuntimeMode } from './runtimeMode';

/**
 * The mode, for components. Starts from the server's answer so the first
 * client render matches the markup that arrived, then settles on the
 * browser's decision after mount. The decision itself is lib/runtimeMode.
 */
export function useRuntimeMode(): RuntimeMode {
  const [mode, setMode] = useState<RuntimeMode>(serverDefaultMode);
  useEffect(() => { setMode(getRuntimeMode()); }, []);
  return mode;
}
