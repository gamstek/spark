/**
 * 蓝湖切片爬取脚本（可复用）。
 *
 * 用法：
 *   node scripts/lanhu-slices.mjs <detailDetachURL> [outDir]
 *
 * 其中 <detailDetachURL> 是类似
 *   https://lanhuapp.com/web/#/item/project/detailDetach?pid=xx&project_id=xx&image_id=xx
 * 的页面地址。脚本请求蓝湖切片数据接口，解析出 alipic.lanhuapp.com 的 PNG 切片并下载。
 *
 * Cookie 来源：优先环境变量 LANHU_COOKIE；否则自动从 Trae 的 MCP 配置
 * （User/mcp.json 的 lanhu.env.LANHU_COOKIE）读取。也可用环境变量 MCP_CONFIG_PATH
 * 指定其它配置路径。Cookie 不写入本文件/仓库。
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [, , urlArg, outDirArg] = process.argv;
const outDir = outDirArg ?? 'apps/staff/src/assets/slices/lanhu';

function resolveCookie() {
  if (process.env.LANHU_COOKIE?.trim()) return process.env.LANHU_COOKIE.trim();
  const cfgPaths = [
    process.env.MCP_CONFIG_PATH,
    'C:/Users/lenovo/AppData/Roaming/Trae CN/User/mcp.json',
  ].filter(Boolean);
  for (const p of cfgPaths) {
    try {
      const raw = readFileSync(p, 'utf8');
      const o = JSON.parse(raw);
      const servers = o.mcpServers ?? o;
      for (const key of ['lanhu', 'mcp-lanhu']) {
        const v = servers?.[key]?.env?.LANHU_COOKIE;
        if (v) return v;
      }
      // 兜底：从原文正则提取
      const m = raw.match(
        /LANHU_COOKIE\s*"\s*:\s*"([^"]*)"|LANHU_COOKIE\s*=\s*([^"\s;\r\n]*)/,
      );
      if (m?.[1] || m?.[2]) return (m[1] ?? m[2]).trim();
    } catch {
      /* 忽略读取失败 */
    }
  }
  return '';
}

const cookie = resolveCookie();

if (!urlArg || !cookie) {
  console.error(
    '用法: LANHU_COOKIE="..." node scripts/lanhu-slices.mjs <detailDetachURL> [outDir]',
  );
  console.error('（未设 LANHU_COOKIE 时，会尝试从 Trae mcp.json 自动读取）');
  process.exit(1);
}

const q = new URLSearchParams(urlArg.split('?')[1] ?? '');
const imageId = q.get('image_id');
const pid = q.get('pid') || q.get('project_id');
const tid = q.get('tid');
if (!imageId) {
  console.error('无法从 URL 解析 image_id');
  process.exit(1);
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const HOST = 'https://lanhuapp.com';

function buildEndpoints() {
  const base = `${HOST}/api/project/image?project_id=${pid}&image_id=${imageId}`;
  const variants = [base];
  if (tid) variants.push(`${base}&tid=${tid}`);
  variants.push(
    `${HOST}/api/project/detail?project_id=${pid}&image_id=${imageId}`,
  );
  return variants;
}

async function request(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Cookie: cookie,
      Referer: urlArg,
      Accept: 'application/json, text/plain, */*',
    },
  });
  return { status: r.status, text: await r.text() };
}

/** 递归收集响应对象中形如 alipic.lanhuapp.com 的 png url */
function collectPngs(node, out = new Set()) {
  if (typeof node === 'string') {
    if (node.includes('alipic.lanhuapp.com') && node.endsWith('.png')) {
      out.add(node);
    }
    return out;
  }
  if (Array.isArray(node) || (node && typeof node === 'object')) {
    for (const v of Array.isArray(node) ? node : Object.values(node)) {
      collectPngs(v, out);
    }
  }
  return out;
}

async function main() {
  const endpoints = buildEndpoints();
  let urls = [];
  for (const ep of endpoints) {
    const { status, text } = await request(ep);
    console.log(`GET ${ep} -> ${status}`);
    if (status !== 200) continue;
    let urlsHere = [];
    try {
      const j = JSON.parse(text);
      const d = j?.data?.data ?? j?.data ?? j;
      let hasSlices = Array.isArray(d?.slices) && d.slices.length > 0;
      if (hasSlices) {
        for (const s of d.slices) {
          if (!s?.url) continue;
          const size =
            s.width && s.height ? `${s.width}x${s.height}` : '?';
          console.log(`切片: ${s.name || '(unnamed)'} ${size} ${s.url.slice(-45)}`);
          urlsHere.push(s.url);
        }
      }
      if (d?.imgUrl) urlsHere.push(d.imgUrl);
      const collected = collectPngs(j);
      if (collected.size) urlsHere.push(...collected);
    } catch {
      /* 非 JSON，回落兜底 */
    }
    if (!urlsHere.length) {
      urlsHere = [
        ...new Set(
          [...text.matchAll(/https?:\/\/[^"\s\\]+?\.png/gi)].map((m) =>
            m[0].replace(/\\\//g, '/'),
          ),
        ),
      ];
    }
    urls = [...new Set(urlsHere)];
    if (urls.length) break;
  }

  console.log(`发现切片资源: ${urls.length}`);
  if (!urls.length) {
    console.log('未取到可下载切片（可能是接口路径/登录态问题，可调整 buildEndpoints）。');
    process.exit(2);
  }

  await mkdir(outDir, { recursive: true });
  let ok = 0;
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    try {
      const r = await fetch(u, {
        headers: { 'User-Agent': UA, Referer: HOST },
      });
      if (r.status !== 200) {
        console.log(`下载失败 skip ${i + 1} -> ${r.status}`);
        continue;
      }
      const file = path.join(outDir, `slice-${i + 1}.png`);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
      ok++;
      console.log(`已下载 ${file} (${r.status})`);
    } catch (e) {
      console.log(`下载失败 ${i + 1}: ${e.message}`);
    }
  }
  console.log(`完成：${ok}/${urls.length} 张切片已保存到 ${outDir}`);
}

main().catch((e) => {
  console.error('运行出错：', e);
  process.exit(1);
});