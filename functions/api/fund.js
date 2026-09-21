export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get('code');

  if (!code) {
    return new Response(JSON.stringify({ error: '缺少基金代码' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const resp = await fetch(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
      headers: {
        'Referer': 'https://fund.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: '基金数据请求失败' }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = await resp.text();

    // 提取基金名称
    const nameMatch = text.match(/var\s+fS_name\s*=\s*"([^"]+)"/);
    const fundName = nameMatch ? nameMatch[1] : '未知基金';

    // 提取净值走势数据
    const trendMatch = text.match(/var\s+Data_netWorthTrend\s*=\s*(\[.*?\]);/s);
    if (!trendMatch) {
      return new Response(JSON.stringify({ error: '未获取到净值数据' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const trend = JSON.parse(trendMatch[1]);

    // 转换数据格式
    const data = trend
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

    return new Response(JSON.stringify({ fundName, fundCode: code, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
