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
  draw_ends_at?: string;
  ends_at?: string;
  redeem_ends_at?: string;
  config?: Record<string, unknown>;
  published_version_id?: string | null;
};
const toShanghaiInput = (value?: string) =>
  value
    ? new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : '';
const fromShanghaiInput = (value: FormDataEntryValue | null) =>
  `${String(value)}:00+08:00`;
const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
export function ActivityEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('');
  const locked = Boolean(
    detail?.published_version_id &&
    detail.starts_at &&
    new Date(detail.starts_at) <= new Date(),
  );
  useEffect(() => {
    if (id && id !== 'new')
      api<Detail>(`admin/activities/${id}`).then(setDetail);
  }, [id]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let heroAssetId = f.get('heroAssetId');
    const heroFile = f.get('heroFile');
    if (heroFile instanceof File && heroFile.size > 0) {
      const uploaded = await api<{ id: string }>('admin/media', {
        method: 'POST',
        body: JSON.stringify({
          fileName: heroFile.name,
          contentBase64: await readBase64(heroFile),
        }),
      });
      heroAssetId = uploaded.id;
    }
    const config = {
      formId: f.get('formId'),
      formUrl: f.get('formUrl'),
      prefillField: f.get('prefillField'),
      fieldMapping: {
        participationId: '参与编号',
        name: '姓名',
        phone: '手机号',
      },
      requireSubscribe: true,
      heroAssetId,
      rulesText: f.get('rulesText'),
    };
    try {
      if (id === 'new') {
        const r = await api<{ id: string }>('admin/activities', {
          method: 'POST',
          body: JSON.stringify({
            name: f.get('name'),
            templateId: 'exhibition-lottery',
            templateVersion: 1,
            config,
            startsAt: fromShanghaiInput(f.get('startsAt')),
            drawEndsAt: fromShanghaiInput(f.get('drawEndsAt')),
            endsAt: fromShanghaiInput(f.get('endsAt')),
            redeemEndsAt: fromShanghaiInput(f.get('redeemEndsAt')),
          }),
        });
        nav(`/activities/${r.id}`);
      } else {
        const saved = await api<{ revision: number }>(
          `admin/activities/${id}/draft`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              expectedRevision: detail?.revision,
              name: f.get('name'),
              config,
              startsAt: fromShanghaiInput(f.get('startsAt')),
              drawEndsAt: fromShanghaiInput(f.get('drawEndsAt')),
              endsAt: fromShanghaiInput(f.get('endsAt')),
              redeemEndsAt: fromShanghaiInput(f.get('redeemEndsAt')),
            }),
          },
        );
        setDetail(
          (current) => current && { ...current, revision: saved.revision },
        );
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
      setDetail(await api<Detail>(`admin/activities/${id}`));
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
          <Flex
            direction="column"
            gap="3"
          >
            <TextField.Root
              name="name"
              placeholder="活动名称"
              defaultValue={detail?.name}
              required
            />
            {detail?.code && <p>活动地址：/activity/{detail.code}</p>}
            <ConfigForm
              locked={locked}
              value={detail?.config}
            />
            {locked && <p>活动已经开始，模板、规则、时间和奖项配置已锁定。</p>}
            {(
              [
                ['startsAt', detail?.starts_at],
                ['drawEndsAt', detail?.draw_ends_at],
                ['endsAt', detail?.ends_at],
                ['redeemEndsAt', detail?.redeem_ends_at],
              ] as const
            ).map(([x, value]) => (
              <TextField.Root
                key={x}
                name={x}
                type="datetime-local"
                required={id === 'new'}
                defaultValue={toShanghaiInput(value)}
                disabled={locked}
              />
            ))}
            <Flex gap="3">
              <Button
                type="submit"
                disabled={locked}
              >
                保存草稿
              </Button>
              {id !== 'new' && (
                <Button
                  type="button"
                  onClick={publish}
                >
                  发布
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  type="button"
                  color="red"
                  variant="soft"
                  onClick={endDraw}
                >
                  提前结束抽奖
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  asChild
                  variant="soft"
                >
                  <Link to="participants">参与者</Link>
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  asChild
                  variant="soft"
                >
                  <Link to="report">数据概览</Link>
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  asChild
                  variant="soft"
                >
                  <Link to="redemptions">核销列表</Link>
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  asChild
                  variant="soft"
                >
                  <Link to="exports">导出线索</Link>
                </Button>
              )}
              {id !== 'new' && (
                <Button
                  asChild
                  variant="soft"
                >
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
