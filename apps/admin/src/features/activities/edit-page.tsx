import { Button, Card, Flex, Heading, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ConfigForm } from '../../templates/exhibition-lottery/config-form';
type Detail = {
  name: string;
  code: string;
  revision: number;
  starts_at?: string;
  published_version_id?: string | null;
};
export function ActivityEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('');
  const locked = Boolean(
    detail?.published_version_id && detail.starts_at && new Date(detail.starts_at) <= new Date(),
  );
  useEffect(() => {
    if (id && id !== 'new') api<Detail>(`admin/activities/${id}`).then(setDetail);
  }, [id]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const config = {
      formId: f.get('formId'),
      formUrl: f.get('formUrl'),
      prefillField: f.get('prefillField'),
      fieldMapping: { participationId: '参与编号', name: '姓名', phone: '手机号' },
      requireSubscribe: true,
      heroAssetId: f.get('heroAssetId'),
      rulesText: f.get('rulesText'),
    };
    try {
      if (id === 'new') {
        const r = await api<{ id: string }>('admin/activities', {
          method: 'POST',
          body: JSON.stringify({
            code: f.get('code'),
            name: f.get('name'),
            templateId: 'exhibition-lottery',
            templateVersion: 1,
            config,
            startsAt: f.get('startsAt'),
            drawEndsAt: f.get('drawEndsAt'),
            endsAt: f.get('endsAt'),
            redeemEndsAt: f.get('redeemEndsAt'),
          }),
        });
        nav(`/activities/${r.id}`);
      } else {
        await api(`admin/activities/${id}/draft`, {
          method: 'PATCH',
          body: JSON.stringify({ expectedRevision: detail?.revision, name: f.get('name'), config }),
        });
        setMessage('草稿已保存');
      }
    } catch (err) {
      setMessage(
        String(err).includes('VERSION_CONFLICT')
          ? '版本已被其他人修改，请刷新后重试'
          : '保存失败，请检查配置',
      );
    }
  }
  async function publish() {
    try {
      await api(`admin/activities/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: detail?.revision }),
      });
      setMessage('发布成功');
    } catch {
      setMessage('发布失败，请检查时间、模板和奖项');
    }
  }
  async function endDraw() {
    await api(`admin/activities/${id}/end-draw`, { method: 'POST' });
    setMessage('抽奖已提前结束');
  }
  return (
    <>
      <Heading>{id === 'new' ? '新建活动' : '编辑活动'}</Heading>
      <Card>
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <TextField.Root
              name="name"
              placeholder="活动名称"
              defaultValue={detail?.name}
              required
            />
            <TextField.Root
              name="code"
              placeholder="活动路径代码"
              defaultValue={detail?.code}
              disabled={id !== 'new'}
              required
            />
            <ConfigForm locked={locked} />
            {locked && <p>活动已经开始，模板、规则、时间和奖项配置已锁定。</p>}
            {['startsAt', 'drawEndsAt', 'endsAt', 'redeemEndsAt'].map((x) => (
              <TextField.Root key={x} name={x} type="datetime-local" required={id === 'new'} />
            ))}
            <Flex gap="3">
              <Button type="submit">保存草稿</Button>
              {id !== 'new' && (
                <Button type="button" onClick={publish}>
                  发布
                </Button>
              )}
              {id !== 'new' && (
                <Button type="button" color="red" variant="soft" onClick={endDraw}>
                  提前结束抽奖
                </Button>
              )}
              {id !== 'new' && (
                <Button asChild variant="soft">
                  <Link to="participants">参与者</Link>
                </Button>
              )}
              {id !== 'new' && (
                <Button asChild variant="soft">
                  <Link to="prizes">奖品与库存</Link>
                </Button>
              )}
            </Flex>
            {message && <p>{message}</p>}
          </Flex>
        </form>
      </Card>
    </>
  );
}
