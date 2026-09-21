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
 * 使用 JSONP 方式请求天天基金数据
 */
export function fetchFundHistory(code: string): Promise<FundHistoryResult> {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('请求超时，请检查基金代码是否正确'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      cleanup();
      try {
        const w = window as unknown as Record<string, unknown>;
        const name = (w.fS_name as string) || '未知基金';
        const trend = w.Data_netWorthTrend as Array<{
          x: number;
          y: number;
          equityReturn: number;
        }> | undefined;

        if (!trend || !Array.isArray(trend)) {
          reject(new Error('未获取到净值数据'));
          return;
        }

        const data: INavData[] = trend
          .filter((item) => item.y != null && item.x != null)
          .map((item) => {
            const d = new Date(item.x);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return {
              date: `${year}-${month}-${day}`,
              nav: Number(item.y.toFixed(4)),
              change: Number((item.equityReturn ?? 0).toFixed(2)),
            };
          });

        resolve({ fundName: name, fundCode: code, data });
      } catch (e) {
        reject(e instanceof Error ? e : new Error('数据解析失败'));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('网络请求失败，请检查网络连接'));
    };

    const ts = Date.now();
    script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${ts}&cb=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * 将净值数据格式化为 CSV 文本
 */
export function formatNavCSV(data: INavData[]): string {
  const lines = data.map((d) => `${d.date},${d.nav.toFixed(4)},${d.change}`);
  return ['日期,净值,涨跌幅', ...lines].join('\n');
}
