import { Outlet, useLocation } from 'react-router-dom';

import { PageHeader } from '../../components/page-header';

const pageDetails = [
  ['/prizes', '奖品与库存', '管理活动奖项、抽奖权重和可用库存。'],
  ['/participants', '参与者', '查看参与记录、首次有效线索和中奖核销状态。'],
  ['/redemptions', '核销记录', '追踪中奖凭证的待核销、已核销和过期状态。'],
  ['/report', '数据概览', '查看访问、转化、奖品库存和核销结果。'],
  ['/exports', '线索导出', '按活动导出参与、中奖、核销和渠道数据。'],
] as const;

export function ActivityLayout() {
  const { pathname } = useLocation();
  const detail = pageDetails.find(([suffix]) => pathname.endsWith(suffix));

  return (
    <>
      <PageHeader
        title={detail?.[1] ?? '活动设置'}
        description={detail?.[2] ?? '配置活动模板、页面内容和运行时间。'}
      />
      <div className="activity-tab-content">
        <Outlet />
      </div>
    </>
  );
}
