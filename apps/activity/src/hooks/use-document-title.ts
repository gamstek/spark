import { useEffect, useRef } from 'react';

export function formatDocumentTitle(
  activityTitle: string,
  pageTitle: string | null,
): string {
  return pageTitle ? `${pageTitle} - ${activityTitle}` : activityTitle;
}

export function useDocumentTitle(
  activityTitle: string,
  pageTitle: string | null,
): void {
  const defaultTitle = useRef(
    typeof document === 'undefined' ? '' : document.title,
  );

  useEffect(() => {
    if (!activityTitle || typeof document === 'undefined') return;
    document.title = formatDocumentTitle(activityTitle, pageTitle);
    return () => {
      document.title = defaultTitle.current;
    };
  }, [activityTitle, pageTitle]);
}
