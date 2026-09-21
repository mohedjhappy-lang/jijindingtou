import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { ECharts } from 'echarts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  Activity,
  Info,
  ArrowDownUp,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowUpDown,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  RefreshCcw,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  BacktestResult,
  BenchmarkRecord,
  DailyRecord,
  InvestmentCycle,
} from '@/lib/backtest';

interface ResultDisplayProps {
  resultA: BacktestResult | null;
  resultB: BacktestResult | null;
  benchmark: BenchmarkRecord[];
  previewData?: BenchmarkRecord[];
  schemeNameA?: string;
  schemeNameB?: string;
  fundName?: string;
  fundCode?: string;
  mode?: 'chart' | 'table' | 'both';
}

const CHART_COLOR_BENCH = '#64748b';
const CHART_COLOR_A = '#0d9488';
const CHART_COLOR_B = '#d97706';

type SortField =
  | 'date'
  | 'nav'
  | 'change'
  | 'addAmount'
  | 'totalInvested'
  | 'totalWithdrawn'
  | 'profit'
  | 'returnRate'
  | 'cycleInvested'
  | 'cycleProfit'
  | 'cycleReturn';
type SortOrder = 'asc' | 'desc' | null;

interface NumberFilter {
  min?: number;
  max?: number;
}

interface TableFilters {
  nav: NumberFilter;
  change: NumberFilter;
  addAmount: NumberFilter;
  totalInvested: NumberFilter;
  totalWithdrawn: NumberFilter;
  profit: NumberFilter;
  returnRate: NumberFilter;
  cycleInvested: NumberFilter;
  cycleProfit: NumberFilter;
  cycleReturn: NumberFilter;
}

const COLUMN_ORDER_KEY = 'fund_backtest_column_order';

const DEFAULT_COLUMNS: SortField[] = [
  'date',
  'nav',
  'change',
  'addAmount',
  'totalInvested',
  'totalWithdrawn',
  'profit',
  'returnRate',
  'cycleInvested',
  'cycleProfit',
  'cycleReturn',
];

const COLUMN_CONFIG: Record<SortField, { label: string; align: 'left' | 'center' | 'right'; filterStep?: string; filterPlaceholder?: string; isPercent?: boolean }> = {
  date: { label: '日期', align: 'left' },
  nav: { label: '基金净值', align: 'right', filterStep: '0.001', filterPlaceholder: '净值' },
  change: { label: '日涨跌幅', align: 'right', filterStep: '0.1', filterPlaceholder: '涨跌幅', isPercent: true },
  addAmount: { label: '操作明细', align: 'center' },
  totalInvested: { label: '总投入', align: 'right', filterStep: '50', filterPlaceholder: '金额' },
  totalWithdrawn: { label: '累计收回', align: 'right', filterStep: '50', filterPlaceholder: '金额' },
  profit: { label: '总收益', align: 'right', filterStep: '10', filterPlaceholder: '金额' },
  returnRate: { label: '总收益率', align: 'right', filterStep: '1', filterPlaceholder: '收益率', isPercent: true },
  cycleInvested: { label: '周期投入', align: 'right', filterStep: '50', filterPlaceholder: '金额' },
  cycleProfit: { label: '周期收益', align: 'right', filterStep: '10', filterPlaceholder: '金额' },
  cycleReturn: { label: '周期收益率', align: 'right', filterStep: '1', filterPlaceholder: '收益率', isPercent: true },
};

function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(2)}%`;
}

function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StrategyMetricCard({
  title,
  result,
  accentColor,
  icon: Icon,
}: {
  title: string;
  result: BacktestResult | null;
  accentColor: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const hasResult = result !== null;
  const returnRate = result?.totalAssetsReturn ?? 0;
  const isPositive = returnRate >= 0;
  const totalInvested = result?.totalInvested ?? 0;
  const totalProfit = result?.totalAssetsProfit ?? 0;
  const clearCount = result?.clearCount ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div
              className="size-6 rounded-md flex items-center justify-center text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Icon className="size-3.5" />
            </div>
            {title}
          </CardTitle>
        </div>
        <CardDescription>
          {hasResult ? `总投入 ${formatMoney(totalInvested)} 元` : '暂无数据'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasResult ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">总收益率</div>
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  isPositive ? 'text-success' : 'text-destructive',
                )}
              >
                {isPositive ? '+' : ''}
                {formatPercent(returnRate)}
                {isPositive ? (
                  <TrendingUp className="size-5 inline ml-1 align-middle" />
                ) : (
                  <TrendingDown className="size-5 inline ml-1 align-middle" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="size-3" />
                  总投入
                </div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">
                  ¥{formatMoney(totalInvested)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Coins className="size-3" />
                  总收益
                </div>
                <div
                  className={cn(
                    'text-sm font-semibold tabular-nums mt-0.5',
                    isPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {isPositive ? '+' : ''}¥{formatMoney(totalProfit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="size-3" />
                  最大回撤
                </div>
                <div className="text-sm font-semibold tabular-nums mt-0.5 text-destructive">
                  {formatPercent(result!.maxDrawdown)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCcw className="size-3" />
                  清仓次数
                </div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">
                  {clearCount} 次
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
            请先运行回测
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 投入周期表格 */
function CycleTable({ cycles }: { cycles: InvestmentCycle[] }) {
  if (cycles.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        暂无投入周期记录
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">周期</TableHead>
            <TableHead className="whitespace-nowrap">开始日期</TableHead>
            <TableHead className="whitespace-nowrap">结束日期</TableHead>
            <TableHead className="whitespace-nowrap text-right">周期投入</TableHead>
            <TableHead className="whitespace-nowrap text-right">期末价值</TableHead>
            <TableHead className="whitespace-nowrap text-right">收益</TableHead>
            <TableHead className="whitespace-nowrap text-right">收益率</TableHead>
            <TableHead className="whitespace-nowrap">状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles.map((c, idx) => {
            const isPositive = c.profit >= 0;
            return (
              <TableRow key={idx}>
                <TableCell className="font-medium">#{c.cycleIndex}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {c.startDate}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {c.endDate}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  ¥{formatMoney(c.totalInvested)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  ¥{formatMoney(c.endValue)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-xs font-medium',
                    isPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {isPositive ? '+' : ''}¥{formatMoney(c.profit)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-xs font-medium',
                    isPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {isPositive ? '+' : ''}
                  {formatPercent(c.returnRate)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px] h-5',
                      c.status === 'active'
                        ? 'border-success/30 text-success bg-success/5'
                        : 'text-muted-foreground',
                    )}
                  >
                    {c.status === 'active' ? '进行中' : '已结束'}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ResultDisplaySection({
  resultA,
  resultB,
  benchmark,
  previewData,
  schemeNameA = '方案一',
  schemeNameB = '方案二',
  fundName,
  fundCode,
  mode = 'both',
}: ResultDisplayProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [filters, setFilters] = useState<Partial<TableFilters>>({});
  const [activeStrategy, setActiveStrategy] = useState<'A' | 'B' | 'both'>('both');
  const [showFilters, setShowFilters] = useState(false);
  const [columnOrder, setColumnOrder] = useState<SortField[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SortField[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // 忽略
    }
    return DEFAULT_COLUMNS;
  });
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  const chartRef = useRef<ReactECharts>(null);
  const hasResult = resultA !== null && resultB !== null;

  // 保存列顺序
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    } catch {
      // 忽略
    }
  }, [columnOrder]);

  // 排序处理
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder]);

  // 筛选处理
  const handleFilterChange = useCallback(
    (field: keyof TableFilters, range: 'min' | 'max', value: string) => {
      const num = value === '' ? undefined : Number(value);
      setFilters((prev) => {
        const existing = prev[field] ?? {};
        return {
          ...prev,
          [field]: { ...existing, [range]: num },
        };
      });
    },
    [],
  );

  const clearFilter = useCallback((field: keyof TableFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  // 获取当前激活策略的日线数据
  const currentRecords = useMemo((): DailyRecord[] => {
    if (activeStrategy === 'A') return resultA?.dailyRecords ?? [];
    if (activeStrategy === 'B') return resultB?.dailyRecords ?? [];
    return resultA?.dailyRecords ?? [];
  }, [activeStrategy, resultA, resultB]);

  // 应用筛选
  const filteredRecords = useMemo(() => {
    if (!filters || Object.keys(filters).length === 0) return currentRecords;

    return currentRecords.filter((record) => {
      for (const [field, range] of Object.entries(filters) as [
        keyof TableFilters,
        NumberFilter,
      ][]) {
        let value: number;
        switch (field) {
          case 'nav':
            value = record.nav;
            break;
          case 'change':
            value = record.change;
            break;
          case 'addAmount':
            value = record.addAmount;
            break;
          case 'totalInvested':
            value = record.totalInvested;
            break;
          case 'totalWithdrawn':
            value = record.totalWithdrawn;
            break;
          case 'profit':
            value = record.marketValue + record.totalWithdrawn - record.totalInvested;
            break;
          case 'returnRate':
            value = record.totalAssetsReturn * 100;
            break;
          case 'cycleInvested':
            value = record.cycleInvested;
            break;
          case 'cycleProfit':
            value = record.cycleProfit;
            break;
          case 'cycleReturn':
            value = record.cycleReturn * 100;
            break;
          default:
            continue;
        }
        if (range.min !== undefined && value < range.min) return false;
        if (range.max !== undefined && value > range.max) return false;
      }
      return true;
    });
  }, [currentRecords, filters]);

  // 应用排序
  const sortedRecords = useMemo(() => {
    if (!sortField || !sortOrder) return filteredRecords;

    const sorted = [...filteredRecords].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case 'date':
          valA = a.date;
          valB = b.date;
          break;
        case 'nav':
          valA = a.nav;
          valB = b.nav;
          break;
        case 'change':
          valA = a.change;
          valB = b.change;
          break;
        case 'addAmount':
          valA = a.addAmount;
          valB = b.addAmount;
          break;
        case 'totalInvested':
          valA = a.totalInvested;
          valB = b.totalInvested;
          break;
        case 'totalWithdrawn':
          valA = a.totalWithdrawn;
          valB = b.totalWithdrawn;
          break;
        case 'profit':
          valA = a.marketValue + a.totalWithdrawn - a.totalInvested;
          valB = b.marketValue + b.totalWithdrawn - b.totalInvested;
          break;
        case 'returnRate':
          valA = a.totalAssetsReturn;
          valB = b.totalAssetsReturn;
          break;
        case 'cycleInvested':
          valA = a.cycleInvested;
          valB = b.cycleInvested;
          break;
        case 'cycleProfit':
          valA = a.cycleProfit;
          valB = b.cycleProfit;
          break;
        case 'cycleReturn':
          valA = a.cycleReturn;
          valB = b.cycleReturn;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });

    return sorted;
  }, [filteredRecords, sortField, sortOrder]);

  // 图表配置
  const chartOption: EChartsOption = useMemo(() => {
    const dates = benchmark.length > 0
      ? benchmark.map((b) => b.date)
      : previewData?.map((b) => b.date) ?? [];

    const series: EChartsOption['series'] = [];

    if (benchmark.length > 0 || (previewData && previewData.length > 0)) {
      const benchRate = benchmark.length > 0
        ? benchmark.map((b) => +(b.returnRate * 100).toFixed(2))
        : previewData!.map((b) => +(b.returnRate * 100).toFixed(2));
      series.push({
        name: '基金基准',
        type: 'line',
        data: benchRate,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: CHART_COLOR_BENCH, width: 1.5, type: 'dashed' },
        itemStyle: { color: CHART_COLOR_BENCH },
      });
    }

    if (resultA && resultA.dailyRecords.length > 0) {
      series.push({
        name: schemeNameA,
        type: 'line',
        data: resultA.dailyRecords.map((r) => +(r.totalAssetsReturn * 100).toFixed(2)),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: CHART_COLOR_A, width: 2.5 },
        itemStyle: { color: CHART_COLOR_A },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${CHART_COLOR_A}22` },
              { offset: 1, color: `${CHART_COLOR_A}00` },
            ],
          },
        },
      });
    }

    if (resultB && resultB.dailyRecords.length > 0) {
      series.push({
        name: schemeNameB,
        type: 'line',
        data: resultB.dailyRecords.map((r) => +(r.totalAssetsReturn * 100).toFixed(2)),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: CHART_COLOR_B, width: 2.5 },
        itemStyle: { color: CHART_COLOR_B },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${CHART_COLOR_B}22` },
              { offset: 1, color: `${CHART_COLOR_B}00` },
            ],
          },
        },
      });
    }

    return {
      grid: {
        left: 50,
        right: 20,
        top: 40,
        bottom: 40,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: 12 },
        padding: [8, 12],
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const arr = params as Array<{ axisValue: string; seriesName: string; value: number; color: string }>;
          const date = arr[0].axisValue as string;
          let html = `<div style="font-weight:600;margin-bottom:6px">${date}</div>`;
          for (const p of arr) {
            const color = p.color;
            const val = p.value as number;
            const isPositive = val >= 0;
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;margin:2px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
                ${p.seriesName}
              </span>
              <span style="font-weight:600;font-variant-numeric:tabular-nums;color:${isPositive ? '#15803d' : '#dc2626'}">
                ${isPositive ? '+' : ''}${val.toFixed(2)}%
              </span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        data: [
          '基金基准',
          schemeNameA,
          schemeNameB,
        ].filter((n) =>
          series?.some((s) => (s as { name?: string }).name === n),
        ),
        top: 8,
        right: 20,
        textStyle: { fontSize: 12, color: '#64748b' },
        itemWidth: 20,
        itemHeight: 2,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: '#94a3b8',
          formatter: (value: string) => {
            return value.slice(5);
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: { color: '#f1f5f9', type: 'dashed' },
        },
        axisLabel: {
          fontSize: 11,
          color: '#94a3b8',
          formatter: (value: number) => `${value}%`,
        },
      },
      series,
    };
  }, [resultA, resultB, benchmark, previewData, schemeNameA, schemeNameB]);

  // 排序图标
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortOrder === 'asc') return <ChevronUp className="size-3 text-primary" />;
    return <ChevronDown className="size-3 text-primary" />;
  };

  // 过滤状态标记
  const activeFilterCount = Object.values(filters).filter(
    (f) => f && (f.min !== undefined || f.max !== undefined),
  ).length;

  const resetSortAndFilter = () => {
    setSortField(null);
    setSortOrder(null);
    setFilters({});
  };

  // 拖拽排序列
  const dragColRef = useRef<SortField | null>(null);

  const handleDragStart = (field: SortField) => {
    dragColRef.current = field;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetField: SortField) => {
    const src = dragColRef.current;
    if (!src || src === targetField) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const srcIdx = next.indexOf(src);
      const tgtIdx = next.indexOf(targetField);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, src);
      return next;
    });
    dragColRef.current = null;
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMNS);
  };

  // 渲染表格单元格内容
  const renderCell = (record: DailyRecord, field: SortField) => {
    switch (field) {
      case 'date':
        return (
          <span className="whitespace-nowrap text-xs text-foreground font-medium">
            {record.date}
          </span>
        );
      case 'nav':
        return (
          <span className="tabular-nums text-xs">
            {record.nav.toFixed(4)}
          </span>
        );
      case 'change': {
        const isPositive = record.change > 0;
        const isNegative = record.change < 0;
        return (
          <span
            className={cn(
              'tabular-nums text-xs font-medium',
              isPositive && 'text-success',
              isNegative && 'text-destructive',
              !isPositive && !isNegative && 'text-muted-foreground',
            )}
          >
            {isPositive ? '+' : ''}
            {record.change.toFixed(2)}%
          </span>
        );
      }
      case 'addAmount': {
        const actions = record.actions;
        if (!actions || actions.length === 0) {
          return <span className="text-xs text-muted-foreground/50">—</span>;
        }
        const primary = actions[0];
        const isBuy = primary.type === 'buy';
        const tooltip = actions
          .map((a) =>
            a.type === 'buy'
              ? `${a.description}（+¥${formatMoney(a.amount)}）`
              : `${a.description}（-¥${formatMoney(a.amount)}）`,
          )
          .join('\n');
        return (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] h-5 font-normal cursor-help whitespace-nowrap max-w-[120px] truncate',
                isBuy
                  ? 'border-success/30 text-success bg-success/5'
                  : 'border-destructive/30 text-destructive bg-destructive/5',
              )}
              title={tooltip}
            >
              {primary.description}
            </Badge>
          </div>
        );
      }
      case 'totalInvested':
        return (
          <span className="tabular-nums text-xs">
            ¥{formatMoney(record.totalInvested)}
          </span>
        );
      case 'totalWithdrawn':
        return (
          <span className="tabular-nums text-xs">
            ¥{formatMoney(record.totalWithdrawn)}
          </span>
        );
      case 'profit': {
        const profit = record.marketValue + record.totalWithdrawn - record.totalInvested;
        const isPositive = profit >= 0;
        return (
          <span
            className={cn(
              'tabular-nums text-xs font-medium',
              isPositive ? 'text-success' : 'text-destructive',
            )}
          >
            {isPositive ? '+' : ''}¥{formatMoney(profit)}
          </span>
        );
      }
      case 'returnRate': {
        const isPositive = record.totalAssetsReturn >= 0;
        return (
          <span
            className={cn(
              'tabular-nums text-xs font-medium',
              isPositive ? 'text-success' : 'text-destructive',
            )}
          >
            {isPositive ? '+' : ''}
            {formatPercent(record.totalAssetsReturn)}
          </span>
        );
      }
      case 'cycleInvested':
        return (
          <span className="tabular-nums text-xs text-muted-foreground">
            {record.cycleInvested > 0 ? `¥${formatMoney(record.cycleInvested)}` : '—'}
          </span>
        );
      case 'cycleProfit': {
        if (record.cycleInvested === 0 && record.cycleProfit === 0) {
          return <span className="text-xs text-muted-foreground/50">—</span>;
        }
        const isPositive = record.cycleProfit >= 0;
        return (
          <span
            className={cn(
              'tabular-nums text-xs',
              isPositive ? 'text-success' : 'text-destructive',
            )}
          >
            {isPositive ? '+' : ''}¥{formatMoney(record.cycleProfit)}
          </span>
        );
      }
      case 'cycleReturn': {
        if (record.cycleInvested === 0) {
          return <span className="text-xs text-muted-foreground/50">—</span>;
        }
        const isPositive = record.cycleReturn >= 0;
        return (
          <span
            className={cn(
              'tabular-nums text-xs',
              isPositive ? 'text-success' : 'text-destructive',
            )}
          >
            {isPositive ? '+' : ''}
            {formatPercent(record.cycleReturn)}
          </span>
        );
      }
      default:
        return null;
    }
  };

  // 渲染列头（含排序 + 筛选）
  const renderHeaderCell = (field: SortField) => {
    const config = COLUMN_CONFIG[field];
    const hasFilter = config.filterStep !== undefined;
    const filterValue = filters[field as keyof TableFilters];
    const isFilterActive = filterValue && (filterValue.min !== undefined || filterValue.max !== undefined);

    return (
      <div
        className={cn(
          'flex items-center gap-1 group',
          config.align === 'right' && 'justify-end',
          config.align === 'center' && 'justify-center',
        )}
      >
        {config.align === 'left' && (
          <GripVertical
            className="size-3 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            draggable
            onDragStart={() => handleDragStart(field)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(field)}
          />
        )}
        <button
          type="button"
          onClick={() => handleSort(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
        >
          {config.label}
          <SortIcon field={field} />
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              if (isFilterActive) {
                clearFilter(field as keyof TableFilters);
              } else {
                setShowFilters((v) => !v);
              }
            }}
            className={cn(
              'shrink-0',
              isFilterActive
                ? 'text-primary'
                : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity',
            )}
            aria-label="筛选"
          >
            <Filter className="size-3" />
          </button>
        )}
        {config.align === 'right' && (
          <GripVertical
            className="size-3 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
            draggable
            onDragStart={() => handleDragStart(field)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(field)}
          />
        )}
      </div>
    );
  };

  // 筛选输入行
  const renderFilterRow = () => {
    if (!showFilters) return null;
    return (
      <TableRow className="hover:bg-transparent">
        {columnOrder.map((field) => {
          const config = COLUMN_CONFIG[field];
          if (!config.filterStep) {
            return <TableHead key={field} className="h-9 py-1" />;
          }
          const filterValue = filters[field as keyof TableFilters];
          return (
            <TableHead key={field} className="h-9 py-1">
              <div
                className={cn(
                  'flex items-center gap-1',
                  config.align === 'right' && 'justify-end',
                  config.align === 'center' && 'justify-center',
                )}
              >
                <Input
                  type="number"
                  value={filterValue?.min ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      field as keyof TableFilters,
                      'min',
                      e.target.value,
                    )
                  }
                  placeholder="最小"
                  step={config.filterStep}
                  className="h-6 text-[11px] px-1.5 w-full tabular-nums"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">~</span>
                <Input
                  type="number"
                  value={filterValue?.max ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      field as keyof TableFilters,
                      'max',
                      e.target.value,
                    )
                  }
                  placeholder="最大"
                  step={config.filterStep}
                  className="h-6 text-[11px] px-1.5 w-full tabular-nums"
                />
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    );
  };


  return (
    <div className="space-y-4 md:space-y-6">
      {/* 基金信息条 */}
      {(fundName || fundCode) && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
          {fundName && (
            <span className="font-semibold text-foreground">{fundName}</span>
          )}
          {fundCode && (
            <Badge variant="outline" className="text-xs font-mono font-normal">
              {fundCode}
            </Badge>
          )}
        </div>
      )}

      {/* 策略指标对比卡 */}
      {mode !== 'table' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <StrategyMetricCard
          title={schemeNameA}
          result={resultA}
          accentColor={CHART_COLOR_A}
          icon={TrendingUp}
        />
        <StrategyMetricCard
          title={schemeNameB}
          result={resultB}
          accentColor={CHART_COLOR_B}
          icon={TrendingUp}
        />
      </div>
      )}

      {/* 结果展示 Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              回测结果
            </CardTitle>
            {hasResult && mode === 'both' && (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="w-auto overflow-x-auto">
                <TabsList className="min-w-max">
                  <TabsTrigger value="chart" className="text-xs h-8 px-3">
                    收益曲线
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs h-8 px-3">
                    交易明细
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!hasResult && previewData && previewData.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">预览模式</p>
                  <p>下方为基金基准净值走势预览。调整参数后点击「开始回测」查看策略对比结果。</p>
                </div>
              </div>
              <div className="w-full h-[280px] sm:h-[360px]">
                <ReactECharts
                  ref={chartRef}
                  option={chartOption}
                  style={{ height: '100%', width: '100%' }}
                  notMerge
                />
              </div>
            </div>
          ) : !hasResult ? (
            <div className="h-[300px] sm:h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="size-12 mb-3 opacity-20" />
              <p className="text-sm">请输入净值数据并点击开始回测</p>
              <p className="text-xs mt-1">支持 CSV 文件上传或手动粘贴</p>
            </div>
          ) : (
            <>
              {(mode !== 'table') && (mode === 'chart' || (mode === 'both' && activeTab === 'chart')) && (
                <div className="space-y-4">

                  {/* 图表 */}
                  <div className="w-full h-[300px] sm:h-[380px]">
                    <ReactECharts
                      ref={chartRef}
                      option={chartOption}
                      style={{ height: '100%', width: '100%' }}
                      notMerge
                    />
                  </div>

                  {/* 图表操作栏 */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="text-xs text-muted-foreground">
                      共 {benchmark.length} 个交易日
                    </div>

                  </div>
                </div>
              )}

              {(mode === 'table' || (mode === 'both' && activeTab === 'table')) && (
                <div className="space-y-3">
                  {/* 筛选工具栏 */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-normal h-5">
                        共 {sortedRecords.length} 条
                        {activeFilterCount > 0 && (
                          <span className="text-primary ml-1">已筛选 {activeFilterCount} 项</span>
                        )}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-normal h-5 cursor-pointer"
                        onClick={() => setShowFilters((v) => !v)}
                      >
                        <Filter className="size-3 mr-1" />
                        {showFilters ? '隐藏筛选' : '显示筛选'}
                      </Badge>
                      {activeFilterCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={clearAllFilters}
                        >
                          <X className="size-3 mr-1" />
                          清除筛选
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {sortField && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={resetSortAndFilter}
                        >
                          <ArrowDownUp className="size-3 mr-1" />
                          重置排序
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={resetColumnOrder}
                      >
                        <Layers className="size-3 mr-1" />
                        重置列
                      </Button>
                    </div>
                  </div>

                  {/* 数据表 */}
                  <div className="w-full overflow-x-auto rounded-md border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columnOrder.map((field) => (
                            <TableHead
                              key={field}
                              className={cn(
                                'whitespace-nowrap',
                                COLUMN_CONFIG[field].align === 'right' && 'text-right',
                                COLUMN_CONFIG[field].align === 'center' && 'text-center',
                              )}
                            >
                              {renderHeaderCell(field)}
                            </TableHead>
                          ))}
                        </TableRow>
                        {renderFilterRow()}
                      </TableHeader>
                      <TableBody>
                        {sortedRecords.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={columnOrder.length}
                              className="text-center py-8 text-muted-foreground text-sm"
                            >
                              暂无匹配数据
                              {activeFilterCount > 0 && (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 ml-1 text-xs"
                                  onClick={clearAllFilters}
                                >
                                  清除筛选
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedRecords.map((record, idx) => (
                            <TableRow key={`${record.date}-${idx}`} className="hover:bg-muted/30">
                              {columnOrder.map((field) => (
                                <TableCell
                                  key={field}
                                  className={cn(
                                    COLUMN_CONFIG[field].align === 'right' && 'text-right',
                                    COLUMN_CONFIG[field].align === 'center' && 'text-center',
                                  )}
                                >
                                  {renderCell(record, field)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 表格底部统计 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      显示 {sortedRecords.length} 条
                      {activeFilterCount > 0 && sortedRecords.length !== currentRecords.length
                        ? ` / 共 ${currentRecords.length} 条`
                        : ''}
                    </span>
                    <span>拖拽列头可调整顺序</span>
                  </div>
                </div>
              )}

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
