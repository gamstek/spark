import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDemoRuntime } from '../lib/runtime';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';
import { PrivacyModal } from '../components/privacy-modal';

interface FormValues {
  name: string;
  phone: string;
  company: string;
  title: string;
  city: string;
  interest: string;
}

const FIELDS: { key: keyof FormValues; label: string; required?: boolean }[] = [
  { key: 'name', label: '姓名', required: true },
  { key: 'phone', label: '手机号码', required: true },
  { key: 'company', label: '公司/单位', required: true },
  { key: 'title', label: '职位' },
  { key: 'city', label: '所在城市' },
  { key: 'interest', label: '感兴趣的产品' },
];

/** 填写活动信息（首版为钉钉表单外链；Demo 保留原稿的可预览表单） */
export function FormPage() {
  const { go } = useDemoRuntime();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { register, handleSubmit } = useForm<FormValues>();

  const onSubmit = (values: FormValues) => {
    void values;
    go('WAITING_FORM');
  };

  return (
    <PageShell className="bg-canvas">
      <main className="relative h-full px-0 pt-3">
        <header className="mx-auto text-[18px] text-ink">填写活动信息</header>

        <form
          className="mx-4 mt-4 flex-1 rounded-[14px] bg-white/90"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="flex flex-col divide-y divide-[#f4f5f9] px-4">
            {FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center py-3 text-[15px] text-ink"
              >
                <span className="shrink-0">
                  {f.label}
                  {f.required ? '*' : ''}
                </span>
                <input
                  className="ml-3 w-full bg-transparent text-right outline-none placeholder:text-[#c2c2c2]"
                  placeholder={f.required ? '请输入' : '请输入'}
                  defaultValue={
                    f.key === 'phone' ? '+86 158****0721' : undefined
                  }
                  {...register(f.key)}
                />
              </label>
            ))}
          </div>

          {/* 协议复选 */}
          <div className="px-4 pb-2 pt-1 text-[12px] text-ink">
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="text-left"
            >
              ☐ 我已阅读活动隐私协议《活动隐私协议》
            </button>
          </div>

          <div className="flex justify-center pb-12 pt-2">
            <ActionButton
              type="submit"
              className="w-[286px]"
            >
              提交信息
            </ActionButton>
          </div>
        </form>

        <PrivacyModal
          open={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          onAgree={() => {
            setShowPrivacy(false);
            go('WAITING_FORM');
          }}
        />
      </main>
    </PageShell>
  );
}
