/**
 * 天天基金数据接口
 * 通过 JSONP 方式获取基金历史净值数据
 */
import type { INavData } from '@/data/fund';

export interface FundHistoryResult {
  fundName: string;
  fundCode: string;
  data: INavData[];
}

/**
 * 通过基金代码查询基金名称和历史净值
 * 通过后端代理请求天天基金数据，避免跨域问题
 */
export function fetchFundHistory(code: string): Promise<FundHistoryResult> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('请求超时，请检查基金代码是否正确'));
    }, 15000);

    fetch(`/api/fund?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(async (resp) => {
        clearTimeout(timeout);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: '请求失败' }));
          throw new Error(err.error || '请求失败');
        }
        const result = await resp.json();
        resolve(result);
      })
      .catch((e) => {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
          reject(new Error('请求超时，请检查基金代码是否正确'));
        } else {
          reject(e instanceof Error ? e : new Error('网络请求失败'));
        }
      });
  });
}

/**
 * 将净值数据格式化为 CSV 文本
 */
export function formatNavCSV(data: INavData[]): string {
  const lines = data.map((d) => `${d.date},${d.nav.toFixed(4)},${d.change}`);
  return ['日期,净值,涨跌幅', ...lines].join('\n');
}
