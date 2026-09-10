import { Flex, Heading, Text, TextArea, TextField } from '@radix-ui/themes';
import { useState } from 'react';

import { RequiredFieldMark } from '../../components/required-field-mark';

type ConfigValue = Record<string, unknown>;

export function extractDingTalkFormId(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname !== 'alidocs.dingtalk.com') return '';
    const segments = url.pathname.split('/').filter(Boolean);
    const formIndex = segments.findIndex((segment) => segment === 'form');
    return formIndex >= 0
      ? decodeURIComponent(segments[formIndex + 1] ?? '')
      : '';
  } catch {
    return '';
  }
}

export function getLotteryConfigError(config: ConfigValue): string | null {
  try {
    const formUrl = new URL(String(config.formUrl ?? ''));
    if (
      formUrl.protocol !== 'https:' ||
      formUrl.hostname !== 'alidocs.dingtalk.com'
    )
      throw new Error('INVALID_DINGTALK_FORM_URL');
  } catch {
    return '请输入 alidocs.dingtalk.com 域名下的 HTTPS 表单链接。';
  }
  if (!String(config.heroAssetId ?? '').trim())
    return '请上传活动主图，或填写已有的主图资源 ID。';
  return null;
}

function FieldLabel({
  htmlFor,
  title,
  description,
  required = false,
}: {
  htmlFor: string;
  title: string;
  description?: string;
  required?: boolean;
}) {
  return (
    <label
      className="field-label"
      htmlFor={htmlFor}
    >
      <Text
        size="2"
        weight="medium"
      >
        {title}
        {required && <RequiredFieldMark />}
      </Text>
      {description && (
        <Text
          size="1"
          color="gray"
        >
          {description}
        </Text>
      )}
    </label>
  );
}

export function ConfigForm({
  locked = false,
  value = {},
}: {
  locked?: boolean;
  value?: ConfigValue;
}) {
  const initialFormUrl = String(value.formUrl ?? '');
  const [formId, setFormId] = useState(
    String(value.formId ?? extractDingTalkFormId(initialFormUrl)),
  );
  const [formUrl, setFormUrl] = useState(initialFormUrl);

  return (
    <>
      <section className="form-section activity-form-section">
        <div className="form-section-heading">
          <Text
            size="1"
            color="iris"
            weight="bold"
          >
            模板配置
          </Text>
          <Heading
            as="h2"
            size="4"
          >
            钉钉留资表单
          </Heading>
          <Text
            as="p"
            size="2"
            color="gray"
          >
            活动参与者跳转到该表单，提交后通过回调获得抽奖资格。
          </Text>
        </div>
        <div className="form-grid">
          <Flex
            direction="column"
            gap="2"
            className="form-grid-wide"
          >
            <FieldLabel
              htmlFor="form-url"
              title="钉钉表单链接"
              description="系统会自动识别表单 ID，并追加参与编号参数"
              required
            />
            <TextField.Root
              size="2"
              variant="soft"
              color="gray"
              type="url"
              id="form-url"
              name="formUrl"
              placeholder="钉钉表单 HTTPS 分享链接"
              required
              disabled={locked}
              value={formUrl}
              onChange={(event) => {
                const nextUrl = event.target.value;
                setFormUrl(nextUrl);
                const extractedFormId = extractDingTalkFormId(nextUrl);
                if (extractedFormId) setFormId(extractedFormId);
              }}
            />
          </Flex>
          <Flex
            direction="column"
            gap="2"
          >
            <FieldLabel
              htmlFor="form-id"
              title="钉钉表单 ID"
              required
            />
            <TextField.Root
              size="2"
              variant="soft"
              color="gray"
              id="form-id"
              name="formId"
              placeholder="钉钉表单 ID"
              value={formId}
              onChange={(event) => setFormId(event.target.value)}
              required
              disabled={locked}
            />
          </Flex>
          <Flex
            direction="column"
            gap="2"
          >
            <FieldLabel
              htmlFor="prefill-field"
              title="参与编号参数"
              description="用于把 participationId 写入表单记录"
              required
            />
            <TextField.Root
              size="2"
              variant="soft"
              color="gray"
              id="prefill-field"
              name="prefillField"
              placeholder="预填参数名"
              defaultValue={String(value.prefillField ?? 'prefill_participant')}
              required
              disabled={locked}
            />
          </Flex>
        </div>
      </section>

      <section className="form-section activity-form-section">
        <div className="form-section-heading">
          <Text
            size="1"
            color="iris"
            weight="bold"
          >
            页面内容
          </Text>
          <Heading
            as="h2"
            size="4"
          >
            主视觉与活动规则
          </Heading>
          <Text
            as="p"
            size="2"
            color="gray"
          >
            上传活动主图，填写参与者在活动页面看到的规则说明。
          </Text>
        </div>
        <div className="form-grid">
          <Flex
            direction="column"
            gap="2"
          >
            <FieldLabel
              htmlFor="hero-asset-id"
              title="主图资源 ID"
              description="可以填写已有资源 ID，或上传新主图自动生成"
              required
            />
            <TextField.Root
              size="2"
              variant="soft"
              color="gray"
              id="hero-asset-id"
              name="heroAssetId"
              aria-label="主图资源 ID"
              placeholder="主图资源 ID"
              defaultValue={String(value.heroAssetId ?? '')}
              disabled={locked}
            />
          </Flex>
          {!locked && (
            <Flex
              direction="column"
              gap="2"
            >
              <FieldLabel
                htmlFor="hero-file"
                title="上传新主图"
                description="JPEG、PNG 或 WebP，最大 5 MB"
              />
              <input
                id="hero-file"
                className="file-input"
                name="heroFile"
                aria-label="上传新主图"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </Flex>
          )}
          <Flex
            direction="column"
            gap="2"
            className="form-grid-wide"
          >
            <FieldLabel
              htmlFor="rules-text"
              title="活动规则"
              required
            />
            <TextArea
              size="2"
              variant="soft"
              color="gray"
              id="rules-text"
              name="rulesText"
              placeholder="活动规则"
              defaultValue={String(value.rulesText ?? '')}
              required
              disabled={locked}
              resize="none"
              rows={5}
            />
          </Flex>
        </div>
      </section>
    </>
  );
}
