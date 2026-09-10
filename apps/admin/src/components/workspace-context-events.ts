export type FailedJobSummary = {
  id: string;
  kind: string;
  attempts: number;
};

export const failedJobsContextEvent = 'spark:failed-jobs-context-updated';

export function updateFailedJobsContext(jobs: FailedJobSummary[]) {
  window.dispatchEvent(
    new CustomEvent(failedJobsContextEvent, { detail: jobs }),
  );
}
