import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { History, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  runBacktest,
  calculateBenchmark,
  type BacktestResult,
  type BenchmarkRecord,
  type StrategyTier,
  type RebuyAmountMode,
  normalizeStrategyTiers,
} from '@/lib/backtest';
import {
  saveHistory,
  loadHistory,
  deleteHistory,
  deleteHistoryBatch,
  renameHistory,
  type BacktestHistoryItem,
} from '@/lib/history';
import { MOCK_FUND_NAV, type INavData } from '@/data/fund';
import InputConfigSection from './InputConfigSection';
import ResultDisplaySection from './ResultDisplaySection';
import HistoryPanel from './HistoryPanel';

const STORAGE_KEY_PARAMS = '__app_fund_backtest_params';

const DEFAULT_TIERS_A: StrategyTier[] = [
  { conditionType: 'loss', triggerPercent: 0.05, actionType: 'buy', buyAmount: 50, sellMode: 'amount', sellAmount: 50, clearAfterRebuy: false, rebuildBuyMode: 'fixed', rebuildBuyAmount: 0 },
  { conditionType: 'loss', triggerPercent: 0.15, actionType: 'buy', buyAmount: 100, sellMode: 'amount', sellAmount: 100, clearAfterRebuy: false, rebuildBuyMode: 'fixed', rebuildBuyAmount: 0 },
  { conditionType: 'loss', triggerPercent: 0.25, actionType: 'buy', buyAmount: 200, sellMode: 'amount', sellAmount: 200, clearAfterRebuy: false, rebuildBuyMode: 'fixed', rebuildBuyAmount: 0 },
];

const DEFAULT_TIERS_B: StrategyTier[] = [
  { conditionType: 'loss', triggerPercent: 0.10, actionType: 'buy', buyAmount: 50, sellMode: 'amount', sellAmount: 50, clearAfterRebuy: false, rebuildBuyMode: 'fixed', rebuildBuyAmount: 0 },
  { conditionType: 'loss', triggerPercent: 0.20, actionType: 'buy', buyAmount: 100, sellMode: 'amount', sellAmount: 100, clearAfterRebuy: false, rebuildBuyMode: 'fixed', rebuildBuyAmount: 0 },
];

interface SavedParams {
  initialAmount: number;
  strategyATiers: StrategyTier[];
  strategyBTiers: StrategyTier[];
  schemeNameA: string;
  schemeNameB: string;
  initialReturnRate: number;
  clearThresholdA: number;
  clearThresholdB: number;
  clearRebuyA: number;
  clearRebuyB: number;
  clearRebuyModeA: RebuyAmountMode;
  clearRebuyModeB: RebuyAmountMode;
}

function loadSavedParams(): SavedParams | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARAMS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedParams;
    return {
      initialAmount: parsed.initialAmount ?? 1000,
      strategyATiers: normalizeStrategyTiers(parsed.strategyATiers ?? DEFAULT_TIERS_A),
      strategyBTiers: normalizeStrategyTiers(parsed.strategyBTiers ?? DEFAULT_TIERS_B),
      schemeNameA: parsed.schemeNameA ?? '方案一',
      schemeNameB: parsed.schemeNameB ?? '方案二',
      initialReturnRate: parsed.initialReturnRate ?? 0,
      clearThresholdA: parsed.clearThresholdA ?? 50,
      clearThresholdB: parsed.clearThresholdB ?? 50,
      clearRebuyA: parsed.clearRebuyA ?? 50,
      clearRebuyB: parsed.clearRebuyB ?? 50,
      clearRebuyModeA: (parsed.clearRebuyModeA as RebuyAmountMode) ?? 'fixed',
      clearRebuyModeB: (parsed.clearRebuyModeB as RebuyAmountMode) ?? 'fixed',
    };
  } catch {
    return null;
  }
}

function buildDedupKey(params: {
  navData: INavData[];
  startDate: string;
  endDate: string;
  initialAmount: number;
  initialReturnRate: number;
  strategyATiers: StrategyTier[];
  strategyBTiers: StrategyTier[];
  clearThresholdA: number;
  clearThresholdB: number;
  clearRebuyA: number;
  clearRebuyB: number;
  clearRebuyModeA: RebuyAmountMode;
  clearRebuyModeB: RebuyAmountMode;
}): string {
  return JSON.stringify(params);
}

export default function BacktestPage() {
  const [navData, setNavData] = useState<INavData[]>(MOCK_FUND_NAV);
  const [dataSource, setDataSource] = useState<'file' | 'manual' | 'fundCode'>('manual');
  const [fileName, setFileName] = useState<string>('');
  const [fundName, setFundName] = useState<string>('');
  const [fundCode, setFundCode] = useState<string>('');

  const saved = loadSavedParams();
  const [initialAmount, setInitialAmount] = useState(saved?.initialAmount ?? 1000);
  const [initialReturnRate, setInitialReturnRate] = useState(saved?.initialReturnRate ?? 0);
  const [strategyATiers, setStrategyATiers] = useState<StrategyTier[]>(saved?.strategyATiers ?? DEFAULT_TIERS_A);
  const [strategyBTiers, setStrategyBTiers] = useState<StrategyTier[]>(saved?.strategyBTiers ?? DEFAULT_TIERS_B);
  const [schemeNameA, setSchemeNameA] = useState(saved?.schemeNameA ?? '方案一');
  const [schemeNameB, setSchemeNameB] = useState(saved?.schemeNameB ?? '方案二');
  const [clearThresholdA, setClearThresholdA] = useState(saved?.clearThresholdA ?? 50);
  const [clearThresholdB, setClearThresholdB] = useState(saved?.clearThresholdB ?? 50);
  const [clearRebuyA, setClearRebuyA] = useState(saved?.clearRebuyA ?? 50);
  const [clearRebuyB, setClearRebuyB] = useState(saved?.clearRebuyB ?? 50);
  const [clearRebuyModeA, setClearRebuyModeA] = useState<RebuyAmountMode>(saved?.clearRebuyModeA ?? 'fixed');
  const [clearRebuyModeB, setClearRebuyModeB] = useState<RebuyAmountMode>(saved?.clearRebuyModeB ?? 'fixed');

  const [startDate, setStartDate] = useState(navData[0]?.date ?? '');
  const [endDate, setEndDate] = useState(navData[navData.length - 1]?.date ?? '');

  const [resultA, setResultA] = useState<BacktestResult | null>(null);
  const [resultB, setResultB] = useState<BacktestResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkRecord[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [historyList, setHistoryList] = useState<BacktestHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const paramsRef = useRef({
    navData, startDate, endDate, initialAmount, initialReturnRate,
    strategyATiers, strategyBTiers, clearThresholdA, clearThresholdB,
    clearRebuyA, clearRebuyB, clearRebuyModeA, clearRebuyModeB,
    schemeNameA, schemeNameB, dataSource, fileName, fundName, fundCode,
  });

  useEffect(() => {
    paramsRef.current = {
      navData, startDate, endDate, initialAmount, initialReturnRate,
      strategyATiers, strategyBTiers, clearThresholdA, clearThresholdB,
      clearRebuyA, clearRebuyB, clearRebuyModeA, clearRebuyModeB,
      schemeNameA, schemeNameB, dataSource, fileName, fundName, fundCode,
    };
  });

  useEffect(() => {
    setHistoryList(loadHistory());
  }, []);

  const previewData = useMemo(() => {
    if (navData.length === 0 || !startDate || !endDate) return [];
    return calculateBenchmark(navData, startDate, endDate, initialReturnRate);
  }, [navData, startDate, endDate, initialReturnRate]);

  const saveParams = useCallback(() => {
    try {
      const params: SavedParams = {
        initialAmount,
        strategyATiers,
        strategyBTiers,
        schemeNameA,
        schemeNameB,
        initialReturnRate,
        clearThresholdA,
        clearThresholdB,
        clearRebuyA,
        clearRebuyB,
        clearRebuyModeA,
        clearRebuyModeB,
      };
      localStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(params));
    } catch {
      // 忽略
    }
  }, [initialAmount, strategyATiers, strategyBTiers, schemeNameA, schemeNameB, initialReturnRate, clearThresholdA, clearThresholdB, clearRebuyA, clearRebuyB, clearRebuyModeA, clearRebuyModeB]);

  const handleNavDataChange = useCallback((data: INavData[], source?: 'file' | 'manual' | 'fundCode', fname?: string, fcode?: string) => {
    setNavData(data);
    if (source) setDataSource(source);
    if (fname !== undefined) setFileName(fname);
    if (fcode !== undefined) setFundCode(fcode);
    if (data.length > 0) {
      setStartDate(data[0].date);
      setEndDate(data[data.length - 1].date);
    } else {
      setStartDate('');
      setEndDate('');
    }
    setResultA(null);
    setResultB(null);
    setBenchmark([]);
  }, []);

  const handleResetDates = useCallback(() => {
    if (navData.length > 0) {
      setStartDate(navData[0].date);
      setEndDate(navData[navData.length - 1].date);
    }
  }, [navData]);

  const handleBacktest = useCallback(() => {
    const p = paramsRef.current;
    if (p.navData.length === 0 || !p.startDate || !p.endDate) {
      toast.error('请先输入净值数据并选择回测区间');
      return;
    }
    if (p.initialAmount <= 0) {
      toast.error('初始投入金额必须大于 0');
      return;
    }
    setIsRunning(true);
    setTimeout(() => {
      try {
        const resA = runBacktest(
          p.navData, p.startDate, p.endDate, p.initialAmount,
          p.strategyATiers, p.initialReturnRate,
          p.clearThresholdA, p.clearRebuyA, p.clearRebuyModeA,
        );
        const resB = runBacktest(
          p.navData, p.startDate, p.endDate, p.initialAmount,
          p.strategyBTiers, p.initialReturnRate,
          p.clearThresholdB, p.clearRebuyB, p.clearRebuyModeB,
        );
        const bench = calculateBenchmark(p.navData, p.startDate, p.endDate, p.initialReturnRate);
        setResultA(resA);
        setResultB(resB);
        setBenchmark(bench);
        saveParams();
        toast.success('回测完成');
      } catch (error) {
        const msg = error instanceof Error ? error.message : '回测失败';
        toast.error(msg);
      } finally {
        setIsRunning(false);
      }
    }, 200);
  }, [saveParams]);

  const handleSaveToHistory = useCallback(() => {
    if (!resultA || !resultB) return;
    const p = paramsRef.current;
    const dedupKey = buildDedupKey(p);
    const existing = historyList.find((item) => {
      const itemKey = buildDedupKey({
        navData: item.navData,
        startDate: item.startDate,
        endDate: item.endDate,
        initialAmount: item.initialAmount,
        initialReturnRate: item.initialReturnRate,
        strategyATiers: item.strategyATiers,
        strategyBTiers: item.strategyBTiers,
        clearThresholdA: item.clearThresholdA,
        clearThresholdB: item.clearThresholdB,
        clearRebuyA: item.clearRebuyA,
        clearRebuyB: item.clearRebuyB,
        clearRebuyModeA: (item.clearRebuyModeA as RebuyAmountMode) ?? 'fixed',
        clearRebuyModeB: (item.clearRebuyModeB as RebuyAmountMode) ?? 'fixed',
      });
      return itemKey === dedupKey;
    });
    if (existing) {
      toast.warning('已存在相同参数的历史记录');
      return;
    }
    const item: BacktestHistoryItem = {
      id: `hist_${Date.now()}`,
      name: `${p.fundName || '基金回测'} - ${p.schemeNameA} vs ${p.schemeNameB}`,
      createdAt: Date.now(),
      navData: p.navData,
      startDate: p.startDate,
      endDate: p.endDate,
      initialAmount: p.initialAmount,
      strategyATiers: p.strategyATiers,
      strategyBTiers: p.strategyBTiers,
      resultA,
      resultB,
      dataSource: p.dataSource,
      fileName: p.fileName,
      fundCode: p.fundCode,
      fundName: p.fundName,
      schemeNameA: p.schemeNameA,
      schemeNameB: p.schemeNameB,
      initialReturnRate: p.initialReturnRate,
      clearThresholdA: p.clearThresholdA,
      clearThresholdB: p.clearThresholdB,
      clearRebuyA: p.clearRebuyA,
      clearRebuyB: p.clearRebuyB,
      clearRebuyModeA: p.clearRebuyModeA,
      clearRebuyModeB: p.clearRebuyModeB,
    };
    const newList = saveHistory(item);
    setHistoryList(newList);
    toast.success('已保存到历史记录');
  }, [resultA, resultB, historyList]);

  const handleRestoreHistory = useCallback((item: BacktestHistoryItem) => {
    setNavData(item.navData);
    setDataSource(item.dataSource);
    setFileName(item.fileName ?? '');
    setFundName(item.fundName ?? '');
    setFundCode(item.fundCode ?? '');
    setStartDate(item.startDate);
    setEndDate(item.endDate);
    setInitialAmount(item.initialAmount);
    setInitialReturnRate(item.initialReturnRate);
    setStrategyATiers(normalizeStrategyTiers(item.strategyATiers));
    setStrategyBTiers(normalizeStrategyTiers(item.strategyBTiers));
    setSchemeNameA(item.schemeNameA);
    setSchemeNameB(item.schemeNameB);
    setClearThresholdA(item.clearThresholdA ?? 50);
    setClearThresholdB(item.clearThresholdB ?? 50);
    setClearRebuyA(item.clearRebuyA ?? 50);
    setClearRebuyB(item.clearRebuyB ?? 50);
    setClearRebuyModeA((item.clearRebuyModeA as RebuyAmountMode) ?? 'fixed');
    setClearRebuyModeB((item.clearRebuyModeB as RebuyAmountMode) ?? 'fixed');
    setResultA(item.resultA);
    setResultB(item.resultB);
    const bench = calculateBenchmark(item.navData, item.startDate, item.endDate, item.initialReturnRate);
    setBenchmark(bench);
    setHistoryOpen(false);
    toast.success(`已恢复：${item.name}`);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    const newList = deleteHistory(id);
    setHistoryList(newList);
    toast.success('已删除');
  }, []);

  const handleClearHistory = useCallback(() => {
    const ids = historyList.map((h) => h.id);
    const newList = deleteHistoryBatch(ids);
    setHistoryList(newList);
    toast.success('已清空历史记录');
  }, [historyList]);

  const handleRenameHistory = useCallback((id: string, name: string) => {
    const newList = renameHistory(id, name);
    setHistoryList(newList);
  }, []);

  const handleFundNameChange = useCallback((name: string, code: string) => {
    setFundName(name);
    setFundCode(code);
  }, []);

  const hasResult = resultA !== null && resultB !== null;

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
              基金定投策略回测对比
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              基于历史净值数据，对比两种亏损加仓策略的收益表现
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToHistory}
                className="hidden sm:inline-flex"
              >
                <Save className="size-4 mr-1.5" />
                保存记录
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <History className="size-4 mr-1.5" />
              历史记录
              <span className="text-xs text-muted-foreground ml-1">({historyList.length})</span>
            </Button>
          </div>
        </div>
      </header>

      {historyOpen && (
        <HistoryPanel
          list={historyList}
          onRestore={handleRestoreHistory}
          onDelete={handleDeleteHistory}
          onRename={handleRenameHistory}
          onClearAll={handleClearHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div className="order-2 lg:order-1">
            <InputConfigSection
              navData={navData}
              onNavDataChange={handleNavDataChange}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              initialAmount={initialAmount}
              onInitialAmountChange={setInitialAmount}
              initialReturnRate={initialReturnRate}
              onInitialReturnRateChange={setInitialReturnRate}
              onResetDates={handleResetDates}
              strategyATiers={strategyATiers}
              strategyBTiers={strategyBTiers}
              schemeNameA={schemeNameA}
              schemeNameB={schemeNameB}
              onSchemeNameAChange={setSchemeNameA}
              onSchemeNameBChange={setSchemeNameB}
              onStrategyAChange={setStrategyATiers}
              onStrategyBChange={setStrategyBTiers}
              clearThresholdA={clearThresholdA}
              clearThresholdB={clearThresholdB}
              clearRebuyA={clearRebuyA}
              clearRebuyB={clearRebuyB}
              clearRebuyModeA={clearRebuyModeA}
              clearRebuyModeB={clearRebuyModeB}
              onClearThresholdAChange={setClearThresholdA}
              onClearThresholdBChange={setClearThresholdB}
              onClearRebuyAChange={setClearRebuyA}
              onClearRebuyBChange={setClearRebuyB}
              onClearRebuyModeAChange={setClearRebuyModeA}
              onClearRebuyModeBChange={setClearRebuyModeB}
              onBacktest={handleBacktest}
              isRunning={isRunning}
              fundName={fundName}
              fundCode={fundCode}
              onFundNameChange={handleFundNameChange}
            />
          </div>

          <div className="order-1 lg:order-2 min-w-0">
            <ResultDisplaySection
              resultA={resultA}
              resultB={resultB}
              benchmark={benchmark}
              previewData={previewData}
              schemeNameA={schemeNameA}
              schemeNameB={schemeNameB}
              fundName={fundName}
              fundCode={fundCode}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
