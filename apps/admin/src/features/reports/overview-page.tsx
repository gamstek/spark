import { Card, Flex, Grid, Heading } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

type Report = {
  visits: number;
  uniqueVisitors: number;
  participants: number;
  leads: number;
  subscribed: number;
  awarded: number;
  available: number;
  pending: number;
  redeemed: number;
  expired: number;
  channels: { code: string; visitors: number }[];
  prizes: { name: string; awarded: number; redeemed: number }[];
};

export function ReportsOverviewPage() {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    api<Report>(`admin/activities/${id}/report`).then(setReport);
  }, [id]);

  return (
    <>
      <Heading>数据概览</Heading>
      <Grid
        columns="3"
        gap="4"
      >
        {report &&
          Object.entries({
            访问次数: report.visits,
            访问人数: report.uniqueVisitors,
            参与人数: report.participants,
            有效线索: report.leads,
            已关注: report.subscribed,
            已中奖: report.awarded,
            可用库存: report.available,
            待兑奖: report.pending,
            已核销: report.redeemed,
            已过期: report.expired,
          }).map(([label, value]) => (
            <Card key={label}>
              <Flex direction="column">
                <span>{label}</span>
                <strong className="metric">{value}</strong>
              </Flex>
            </Card>
          ))}
      </Grid>
      {report && (
        <Card>
          <p>
            渠道：
            {report.channels
              .map((item) => `${item.code} ${item.visitors}`)
              .join('；') || '暂无'}
          </p>
          <p>
            奖项：
            {report.prizes
              .map(
                (item) =>
                  `${item.name} 中奖 ${item.awarded} / 核销 ${item.redeemed}`,
              )
              .join('；') || '暂无'}
          </p>
        </Card>
      )}
    </>
  );
}
