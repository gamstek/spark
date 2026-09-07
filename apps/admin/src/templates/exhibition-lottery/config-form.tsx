import { Flex, Text, TextArea, TextField } from '@radix-ui/themes';
type ConfigValue = Record<string, unknown>;
export function ConfigForm({
  locked = false,
  value = {},
}: {
  locked?: boolean;
  value?: ConfigValue;
}) {
  return (
    <Flex
      direction="column"
      gap="3"
    >
      <Text weight="bold">展会抽奖模板</Text>
      <TextField.Root
        name="formId"
        placeholder="钉钉表单 ID"
        defaultValue={String(value.formId ?? '')}
        required
        disabled={locked}
      />
      <TextField.Root
        name="formUrl"
        placeholder="已验证的钉钉预填链接"
        required
        disabled={locked}
        defaultValue={String(value.formUrl ?? '')}
      />
      <TextField.Root
        name="prefillField"
        placeholder="预填参数名"
        defaultValue={String(value.prefillField ?? 'participant')}
        required
        disabled={locked}
      />
      <TextField.Root
        name="heroAssetId"
        placeholder="主图资源 ID"
        defaultValue={String(value.heroAssetId ?? '')}
        disabled={locked}
      />
      {!locked && (
        <input
          name="heroFile"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        />
      )}
      <TextArea
        name="rulesText"
        placeholder="活动规则"
        defaultValue={String(value.rulesText ?? '')}
        required
        disabled={locked}
      />
    </Flex>
  );
}
