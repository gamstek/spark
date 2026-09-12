import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from '@radix-ui/themes';
import {
  ActivityFormSubmissionSchema,
  activityFormDefinition,
  activityFormOptionLabels,
  type ActivityFormSubmissionDraft,
  type ActivityFormSubmissionInput,
} from '@spark/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { ActionButton } from '../components/action-button';
import { ChoiceField } from '../components/choice-field';
import {
  ContentDialog,
  PrivacyAgreementContent,
} from '../components/content-dialog';
import { FormField } from '../components/form-field';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useRuntime } from '../hooks/use-runtime';
import { ApiError } from '../lib/api';

const heading = '行业专家信息登记与技术交流预约';
const validationSummary = '请检查标记的项目后重新提交';

function submissionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '登录状态已失效，请刷新页面后重试';
    if (error.code === 'VALIDATION_ERROR') return validationSummary;
    if (error.code === 'CSRF_INVALID')
      return '页面状态已失效，请刷新后重新提交';
    if (error.code === 'FORM_NOT_AVAILABLE')
      return '当前活动暂不可提交，请刷新页面查看最新状态';
  }
  return '提交结果尚未确认，请检查网络后重试';
}

const question = (
  index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
) => ({ ...activityFormDefinition[index], required: index < 12 });

export function RegistrationFormPage() {
  const { activity, submitActivityForm } = useRuntime();
  useDocumentTitle(activity.title, heading);
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInFlight = useRef(false);
  const [summary, setSummary] = useState('');
  const {
    register,
    control,
    handleSubmit,
    unregister,
    formState: { errors, isSubmitting },
  } = useForm<
    ActivityFormSubmissionDraft,
    unknown,
    ActivityFormSubmissionInput
  >({
    resolver: zodResolver(ActivityFormSubmissionSchema, {
      error: (issue) => {
        if (issue.code === 'too_big') return `请控制在${issue.maximum}字以内`;
        if (issue.code === 'too_small' && issue.origin === 'array')
          return '请至少选择一项';
        if (issue.code === 'invalid_value') return '请选择一项';
        return '请填写此项';
      },
    }),
    defaultValues: {
      name: '',
      organization: '',
      department: '',
      jobTitle: '',
      phone: '',
      email: '',
      researchAreas: [],
      instrumentInterests: [],
      visitPurposes: [],
      followUpPreferences: [],
      otherNeeds: '',
      privacyAccepted: false,
    },
    shouldFocusError: false,
  });
  const researchAreas = useWatch({ control, name: 'researchAreas' });
  const instrumentInterests = useWatch({
    control,
    name: 'instrumentInterests',
  });
  const showResearchOther = researchAreas.includes('other');
  const showInstrumentOther = instrumentInterests.includes('other');
  useEffect(() => {
    if (!showResearchOther) unregister('researchAreaOther');
  }, [showResearchOther, unregister]);
  useEffect(() => {
    if (!showInstrumentOther) unregister('instrumentInterestOther');
  }, [showInstrumentOther, unregister]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSummary('');
    try {
      await handleSubmit(
        async (input) => {
          try {
            await submitActivityForm(input);
          } catch (error) {
            setSummary(submissionError(error));
          }
        },
        () => {
          setSummary(validationSummary);
          requestAnimationFrame(() => {
            const firstInvalid = formRef.current?.querySelector<HTMLElement>(
              'input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"]',
            );
            firstInvalid?.focus({ preventScroll: true });
            firstInvalid?.scrollIntoView({ block: 'center', behavior: 'auto' });
          });
        },
      )(event);
    } finally {
      submissionInFlight.current = false;
    }
  }

  return (
    <main
      className="registration-page"
      aria-label="专家信息登记表单"
    >
      <header className="registration-header">
        <h1>{heading}</h1>
        <p>
          尊敬的老师/专家，感谢您莅临我们的展位。请留下您的信息，以便我们为您提供精准的技术资料、应用方案及后续服务。
        </p>
        <p className="registration-guidance">标有 * 的项目为必填项</p>
      </header>
      <form
        ref={formRef}
        className="registration-form"
        noValidate
        aria-busy={isSubmitting}
        onSubmit={(event) => void onSubmit(event)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.nativeEvent.isComposing)
            event.preventDefault();
        }}
      >
        <FormField
          id="name"
          {...question(0)}
          error={errors.name?.message}
        >
          {(props) => (
            <input
              {...register('name')}
              {...props}
              type="text"
              autoComplete="name"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          id="organization"
          {...question(1)}
          error={errors.organization?.message}
        >
          {(props) => (
            <input
              {...register('organization')}
              {...props}
              type="text"
              autoComplete="organization"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          id="department"
          {...question(2)}
          error={errors.department?.message}
        >
          {(props) => (
            <input
              {...register('department')}
              {...props}
              type="text"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          id="jobTitle"
          {...question(3)}
          error={errors.jobTitle?.message}
        >
          {(props) => (
            <input
              {...register('jobTitle')}
              {...props}
              type="text"
              autoComplete="organization-title"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          id="phone"
          {...question(4)}
          error={errors.phone?.message}
        >
          {(props) => (
            <input
              {...register('phone')}
              {...props}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          id="email"
          {...question(5)}
          error={errors.email?.message}
        >
          {(props) => (
            <input
              {...register('email')}
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <Controller
          control={control}
          name="researchAreas"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(6)}
              multiple
              options={activityFormOptionLabels.researchAreas}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.researchAreas?.message}
            >
              {showResearchOther && (
                <FormField
                  id="researchAreaOther"
                  label="其他研究方向/应用领域说明"
                  required
                  error={errors.researchAreaOther?.message}
                >
                  {(props) => (
                    <input
                      {...register('researchAreaOther')}
                      {...props}
                      type="text"
                      readOnly={isSubmitting}
                    />
                  )}
                </FormField>
              )}
            </ChoiceField>
          )}
        />
        <Controller
          control={control}
          name="instrumentInterests"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(7)}
              multiple
              options={activityFormOptionLabels.instrumentInterests}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.instrumentInterests?.message}
            >
              {showInstrumentOther && (
                <FormField
                  id="instrumentInterestOther"
                  label="其他仪器类型或技术说明"
                  required
                  error={errors.instrumentInterestOther?.message}
                >
                  {(props) => (
                    <input
                      {...register('instrumentInterestOther')}
                      {...props}
                      type="text"
                      readOnly={isSubmitting}
                    />
                  )}
                </FormField>
              )}
            </ChoiceField>
          )}
        />
        <Controller
          control={control}
          name="visitPurposes"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(8)}
              multiple
              options={activityFormOptionLabels.visitPurposes}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.visitPurposes?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="followUpPreferences"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(9)}
              multiple
              options={activityFormOptionLabels.followUpPreferences}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.followUpPreferences?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contactPreference"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(10)}
              options={activityFormOptionLabels.contactPreference}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.contactPreference?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="onsiteAvailability"
          render={({ field }) => (
            <ChoiceField
              id={field.name}
              {...question(11)}
              options={activityFormOptionLabels.onsiteAvailability}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              controlRef={field.ref}
              disabled={isSubmitting}
              error={errors.onsiteAvailability?.message}
            />
          )}
        />
        <FormField
          id="otherNeeds"
          {...question(12)}
          error={errors.otherNeeds?.message}
        >
          {(props) => (
            <textarea
              {...register('otherNeeds')}
              {...props}
              className="resize-none"
              rows={6}
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <div className="registration-footer">
          <div className="registration-consent">
            <Controller
              control={control}
              name="privacyAccepted"
              render={({ field }) => (
                <label
                  className="registration-consent-label"
                  data-disabled={isSubmitting || undefined}
                >
                  <Checkbox
                    color="gray"
                    highContrast
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    onBlur={field.onBlur}
                    ref={field.ref}
                    required
                    disabled={isSubmitting}
                    aria-label="我已阅读并同意用户活动隐私协议"
                    aria-invalid={Boolean(errors.privacyAccepted)}
                    aria-describedby="privacyAccepted-error"
                  />
                  <span>我已阅读并同意</span>
                </label>
              )}
            />
            <ContentDialog
              title="用户活动隐私协议"
              trigger={
                <button
                  className="registration-privacy-link"
                  type="button"
                >
                  用户活动隐私协议
                </button>
              }
            >
              <PrivacyAgreementContent activityName={activity.title} />
            </ContentDialog>
          </div>
          <p
            id="privacyAccepted-error"
            className="registration-error"
          >
            {errors.privacyAccepted?.message}
          </p>
          <div
            className="registration-summary"
            role="alert"
            aria-atomic="true"
          >
            {summary}
          </div>
          <ActionButton
            type="submit"
            className="registration-submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? '提交中…' : '提交信息'}
          </ActionButton>
        </div>
      </form>
    </main>
  );
}
