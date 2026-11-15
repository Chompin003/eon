import { useEffect, useRef, useState } from 'react';
import { writeLocation, type SharedLocation } from './shared';

/** Navigation and playback never create history entries or write at frame rate. */
export function useShareLink(state: SharedLocation) {
  const current = useRef(state);
  current.current = state;
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState('');
  const flush = () => {
    const url = writeLocation(new URL(location.href), current.current).href;
    if (url !== location.href) history.replaceState(history.state, '', url);
    return url;
  };
  useEffect(() => {
    // A fixed maximum interval also captures continuous playback; a debounce alone
    // would never fire while dates change every 100 ms.
    const timer = window.setInterval(flush, 500);
    const hide = () => flush();
    window.addEventListener('pagehide', hide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', hide);
    };
  }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return {
    copied,
    manual,
    copy: async () => {
      const url = flush();
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setManual('');
      } catch {
        setManual(url);
      }
    },
  };
}
