export type ActivitySchedule = {
  startsAt: string;
  drawEndsAt: string;
  endsAt: string;
  redeemEndsAt: string;
};

export function getActivityScheduleError(
  schedule: ActivitySchedule,
): string | null {
  const startsAt = new Date(schedule.startsAt);
  const drawEndsAt = new Date(schedule.drawEndsAt);
  const endsAt = new Date(schedule.endsAt);
  const redeemEndsAt = new Date(schedule.redeemEndsAt);

  if (
    [startsAt, drawEndsAt, endsAt, redeemEndsAt].some((date) =>
      Number.isNaN(date.getTime()),
    )
  )
    return '请完整填写有效的活动时间。';
  if (startsAt >= drawEndsAt) return '抽奖截止时间必须晚于活动开始时间。';
  if (drawEndsAt > endsAt) return '活动结束时间不能早于抽奖截止时间。';
  if (endsAt > redeemEndsAt) return '兑奖截止时间不能早于活动结束时间。';
  return null;
}
