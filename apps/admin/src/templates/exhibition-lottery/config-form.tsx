import { Flex, Text, TextArea, TextField } from '@radix-ui/themes';
export function ConfigForm({ locked = false }: { locked?: boolean }) {
  return (
    <Flex direction="column" gap="3">
      <Text weight="bold">展会抽奖模板</Text>
      <TextField.Root name="formId" placeholder="钉钉表单 ID" required disabled={locked} />
      <TextField.Root
        name="formUrl"
        placeholder="已验证的钉钉预填链接"
        required
        disabled={locked}
      />
      <TextField.Root
        name="prefillField"
        placeholder="预填参数名"
        defaultValue="participant"
        required
        disabled={locked}
      />
      <TextField.Root name="heroAssetId" placeholder="主图资源 ID" required disabled={locked} />
      <TextArea name="rulesText" placeholder="活动规则" required disabled={locked} />
    </Flex>
  );
}
