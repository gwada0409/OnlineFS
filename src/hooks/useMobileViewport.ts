import { useEffect, useState } from 'react';

export function useMobileViewport() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(width < 768px)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(width < 768px)');
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}
