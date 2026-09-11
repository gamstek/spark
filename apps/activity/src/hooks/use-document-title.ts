import { useEffect } from 'react';

export function formatDocumentTitle(
  activityTitle: string,
  pageTitle: string | null,
): string {
  return pageTitle ? `${pageTitle} - ${activityTitle}` : activityTitle;
}

export function setTemporaryDocumentTitle(
  target: Pick<Document, 'title'>,
  title: string,
): () => void {
  const previousTitle = target.title;
  target.title = title;
  return () => {
    target.title = previousTitle;
  };
}

export function useDocumentTitle(
  activityTitle: string,
  pageTitle: string | null,
): void {
  useEffect(() => {
    if (!activityTitle || typeof document === 'undefined') return;
    return setTemporaryDocumentTitle(
      document,
      formatDocumentTitle(activityTitle, pageTitle),
    );
  }, [activityTitle, pageTitle]);
}
