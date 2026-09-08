export interface DemoActivity {
  code: string;
  title: string;
  slug: string;
  dates: string;
  organizer: string;
  rulesText: string;
  intro: string;
  dingtalkFormUrl: string;
}

export const ACTIVITY: DemoActivity = {
  code: 'demo',
  title: '第八届新污染物环境健康风险及防控学术会议',
  slug: '参与抽奖赢礼品',
  dates: '2026.09.04 - 09.06',
  organizer: '上海交通大学',
  rulesText: '每人只有一次抽奖机会，百分百中奖哦！',
  intro:
    '关注公众号并填写活动信息，即可获得一次抽奖机会，百分百中奖。请在现场凭兑奖码领取奖品。',
  dingtalkFormUrl: 'https://alidocs.dingtalk.com', // Demo 占位，接后端时由 form-link 返回
};
