import { Button, Card, Flex, Heading } from '@radix-ui/themes';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

type View = {
  id: string;
  status: string;
  downloadUrl: string | null;
  rowCount: number | null;
};

export function ExportsPage() {
  const { id } = useParams();
  const [view, setView] = useState<View | null>(null);

  async function create() {
    const created = await api<{ jobId: string }>(
      `admin/activities/${id}/exports`,
      {
        method: 'POST',
      },
    );
    setView({
      id: created.jobId,
      status: 'PENDING',
      downloadUrl: null,
      rowCount: null,
    });
  }

  async function refresh() {
    if (view) setView(await api<View>(`admin/exports/${view.id}`));
  }

  return (
    <>
      <Heading>线索导出</Heading>
      <Card>
        <Flex
          gap="3"
          align="center"
        >
          <Button onClick={create}>生成 XLSX</Button>
          {view && (
            <>
              <span>状态：{view.status}</span>
              <Button
                variant="soft"
                onClick={refresh}
              >
                刷新
              </Button>
              {view.downloadUrl && (
                <Button asChild>
                  <a href={view.downloadUrl}>鉴权下载</a>
                </Button>
              )}
            </>
          )}
        </Flex>
      </Card>
      <p>文件包含生成时刻的数据截点，24 小时后自动过期。</p>
    </>
  );
}
