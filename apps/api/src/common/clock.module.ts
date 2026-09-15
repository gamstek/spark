import { Global, Module } from '@nestjs/common';

import { APP_CLOCK, systemClock } from './clock.js';

@Global()
@Module({
  providers: [{ provide: APP_CLOCK, useValue: systemClock }],
  exports: [APP_CLOCK],
})
export class ClockModule {}
