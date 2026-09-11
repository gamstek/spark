import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { PrizesService } from './prizes.service.js';
@Controller('admin/prizes')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class PrizesController {
  constructor(@Inject(PrizesService) private readonly prizes: PrizesService) {}
  @Get('activities/:activityId') list(@Param('activityId') activityId: string) {
    return this.prizes.list(activityId);
  }
  @Post('activities/:activityId') @UseGuards(CsrfGuard) create(
    @Param('activityId') activityId: string,
    @Body()
    body: {
      prizeLevel: string;
      name: string;
      imageAssetId?: string | null;
      totalStock: number;
      weight: number;
    },
  ) {
    return this.prizes.create(activityId, body);
  }
  @Patch('activities/:activityId/no-prize-weight')
  @UseGuards(CsrfGuard)
  updateNoPrizeWeight(
    @Param('activityId') activityId: string,
    @Body() body: { noPrizeWeight: number },
  ) {
    return this.prizes.updateNoPrizeWeight(activityId, body.noPrizeWeight);
  }
  @Post('activity-prizes/:id/stock') @UseGuards(CsrfGuard) async addStock(
    @Param('id') id: string,
    @Body() body: { quantity: number; operationId: string },
    @Req() request: { session: { subjectId: string } },
  ) {
    await this.prizes.addStock(
      id,
      body.quantity,
      body.operationId,
      request.session.subjectId,
    );
    return { success: true };
  }
}
