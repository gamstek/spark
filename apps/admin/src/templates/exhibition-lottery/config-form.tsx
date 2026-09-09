import {
  Card,
  Flex,
  Heading,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes';

import { RequiredFieldMark } from '../../components/required-field-mark';

type ConfigValue = Record<string, unknown>;

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
  return (
    <>
      <Card
        variant="classic"
        size="4"
        className="form-section"
      >
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
              defaultValue={String(value.formId ?? '')}
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
              defaultValue={String(value.prefillField ?? 'participant')}
              required
              disabled={locked}
            />
          </Flex>
          <Flex
            direction="column"
            gap="2"
            className="form-grid-wide"
          >
            <FieldLabel
              htmlFor="form-url"
              title="已验证的表单链接"
              description="仅支持 alidocs.dingtalk.com 的 HTTPS 预填链接"
              required
            />
            <TextField.Root
              size="2"
              variant="soft"
              color="gray"
              type="url"
              id="form-url"
              name="formUrl"
              placeholder="已验证的钉钉预填链接"
              required
              disabled={locked}
              defaultValue={String(value.formUrl ?? '')}
            />
          </Flex>
        </div>
      </Card>

      <Card
        variant="classic"
        size="4"
        className="form-section"
      >
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
      </Card>
    </>
  );
}
