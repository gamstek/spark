import { Injectable } from '@nestjs/common';

export type JobHandler = (payload: unknown) => Promise<void>;

@Injectable()
export class JobHandlers {
  private readonly handlers = new Map<string, JobHandler>();

  register(kind: string, handler: JobHandler): void {
    if (this.handlers.has(kind))
      throw new Error(`JOB_HANDLER_ALREADY_REGISTERED:${kind}`);
    this.handlers.set(kind, handler);
  }

  get(kind: string): JobHandler | undefined {
    return this.handlers.get(kind);
  }
}
