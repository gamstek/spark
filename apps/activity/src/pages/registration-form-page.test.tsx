import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from '../components/form-field';
import { ChoiceField } from '../components/choice-field';
import { RegistrationFormPage } from './registration-form-page';

vi.mock('../hooks/use-runtime', () => ({
  useRuntime: () => ({
    activity: { title: '测试活动' },
    submitActivityForm: vi.fn(),
  }),
}));

describe('RegistrationFormPage', () => {
  it('renders the approved ordered questions in a semantic form with required markers', () => {
    const markup = renderToStaticMarkup(<RegistrationFormPage />);
    expect(markup).toContain('行业专家信息登记与技术交流预约');
    expect(markup).toContain(
      '尊敬的老师/专家，感谢您莅临我们的展位。请留下您的信息，以便我们为您提供精准的技术资料、应用方案及后续服务。',
    );
    expect(markup).toMatch(/<form[^>]*noValidate=""/i);
    const labels = [
      '姓名',
      '单位（公司/院校/研究所）全称',
      '部门/实验室/课题组',
      '职位/职称',
      '手机号码',
      '电子邮箱',
      '您的主要研究方向/应用领域（多选）',
      '您目前最关注的仪器类型或技术（多选）',
      '您此次关注的目的是（多选）',
      '您希望我们以何种方式为您提供后续信息？（多选题）',
      '您是否方便接受我们在1-2个工作日内致电进行简短的技术交流？',
      '您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）',
      '其他具体需求或咨询',
    ];
    let previous = -1;
    labels.forEach((label, index) => {
      const position = markup.indexOf(label);
      expect(position).toBeGreaterThan(previous);
      previous = position;
      expect(markup).toContain(`>${String(index + 1).padStart(2, '0')}</span>`);
    });
    expect(markup.match(/class="registration-required"/g)).toHaveLength(12);
    expect(markup).toMatch(/其他具体需求或咨询<\/label>/);
    expect(markup.match(/<fieldset/g)).toHaveLength(6);
    expect(markup.match(/role="radiogroup"/g)).toHaveLength(2);
    expect(markup).toContain('role="checkbox"');
    expect(markup).toContain('用户活动隐私协议');
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>提交信息<\/button>/);
    expect(markup).not.toContain('pattern=');
  });

  it('connects a text control to its visible label and persistent error region', () => {
    const markup = renderToStaticMarkup(
      <FormField
        id="name"
        number="01"
        label="姓名"
        required
        error="请填写姓名"
      >
        {(props) => <input {...props} />}
      </FormField>,
    );
    expect(markup).toContain('for="name"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="name-error"');
    expect(markup).toContain('id="name-error"');
    expect(markup).toContain('请填写姓名');
  });

  it('connects invalid grouped choices and their controls to an existing error target', () => {
    const markup = renderToStaticMarkup(
      <ChoiceField
        id="researchAreas"
        number="07"
        label="研究方向"
        required
        multiple
        options={{ life_sciences: '生命科学', other: '其他' }}
        value={[]}
        onChange={() => undefined}
        error="请至少选择一项"
      />,
    );
    expect(markup).toContain('<fieldset');
    expect(markup).toContain('<legend');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="researchAreas-error"');
    expect(markup).toContain('id="researchAreas-error"');
    expect(markup).toContain('请至少选择一项');
  });
});
