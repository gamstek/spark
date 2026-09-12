import { Flex, Heading, Text, TextArea, TextField } from '@radix-ui/themes';

import { RequiredFieldMark } from '../../components/required-field-mark';

type ConfigValue = Record<string, unknown>;

export function getLotteryConfigError(config: ConfigValue): string | null {
  if (!String(config.heroAssetId ?? '').trim())
    return '请上传活动主图，或填写已有的主图资源 ID。';
  if (!String(config.rulesText ?? '').trim()) return '请填写活动规则。';
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
