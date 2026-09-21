import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { Upload, FileText, AlertCircle, Plus, Trash2, Search, Loader2, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  parseNavCSV,
  type StrategyTier,
  type TierConditionType,
  type TierActionType,
  type TierSellMode,
  type RebuyAmountMode,
} from '@/lib/backtest';
import { fetchFundHistory, formatNavCSV } from '@/lib/fund-api';
import type { INavData } from '@/data/fund';
import { cn } from '@/lib/utils';

interface InputConfigProps {
  navData: INavData[];
  onNavDataChange: (
    data: INavData[],
    source?: 'file' | 'manual' | 'fundCode',
    fileName?: string,
    fundCode?: string,
  ) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  initialAmount: number;
  onInitialAmountChange: (amount: number) => void;
  initialReturnRate: number;
  onInitialReturnRateChange: (rate: number) => void;
  onResetDates: () => void;
  strategyATiers: StrategyTier[];
  strategyBTiers: StrategyTier[];
  schemeNameA: string;
  schemeNameB: string;
  onSchemeNameAChange: (name: string) => void;
  onSchemeNameBChange: (name: string) => void;
  onStrategyAChange: (tiers: StrategyTier[]) => void;
  onStrategyBChange: (tiers: StrategyTier[]) => void;
  clearThresholdA: number;
  clearThresholdB: number;
  clearRebuyA: number;
  clearRebuyB: number;
  clearRebuyModeA: RebuyAmountMode;
  clearRebuyModeB: RebuyAmountMode;
  onClearThresholdAChange: (amount: number) => void;
  onClearThresholdBChange: (amount: number) => void;
  onClearRebuyAChange: (amount: number) => void;
  onClearRebuyBChange: (amount: number) => void;
  onClearRebuyModeAChange: (mode: RebuyAmountMode) => void;
  onClearRebuyModeBChange: (mode: RebuyAmountMode) => void;
  onBacktest: () => void;
  isRunning: boolean;
  fundName?: string;
  fundCode?: string;
  onFundNameChange?: (name: string, code: string) => void;
}

export default function InputConfigSection({
  navData,
  onNavDataChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  initialAmount,
  onInitialAmountChange,
  initialReturnRate,
  onInitialReturnRateChange,
  onResetDates,
  strategyATiers,
  strategyBTiers,
  schemeNameA,
  schemeNameB,
  onSchemeNameAChange,
  onSchemeNameBChange,
  onStrategyAChange,
  onStrategyBChange,
  clearThresholdA,
  clearThresholdB,
  clearRebuyA,
  clearRebuyB,
  clearRebuyModeA,
  clearRebuyModeB,
  onClearThresholdAChange,
  onClearThresholdBChange,
  onClearRebuyAChange,
  onClearRebuyBChange,
  onClearRebuyModeAChange,
  onClearRebuyModeBChange,
  onBacktest,
  isRunning,
  fundCode,
  onFundNameChange,
}: InputConfigProps) {
  const [csvText, setCsvText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [initialReturnRateDisplay, setInitialReturnRateDisplay] = useState(
    String(initialReturnRate * 100),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fundCodeInput, setFundCodeInput] = useState('');
  const [fundQueryLoading, setFundQueryLoading] = useState(false);
  const fundCodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInitialReturnRateDisplay(String(initialReturnRate * 100));
  }, [initialReturnRate]);

  const handleFundQuery = async () => {
    const code = fundCodeInput.trim();
    if (!code) {
      toast.error('请输入基金代码');
      fundCodeRef.current?.focus();
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error('基金代码必须是 6 位数字');
      return;
    }
    setFundQueryLoading(true);
    setParseError('');
    try {
      const result = await fetchFundHistory(code);
      const data = result.data;
      const csv = formatNavCSV(data);
      setCsvText(csv);
      onNavDataChange(data, 'fundCode', `${code}.csv`, code);
      if (onFundNameChange && result.fundName) {
        onFundNameChange(result.fundName, result.fundCode);
      }
      toast.success(`已获取 ${data.length} 条数据，可直接开始回测`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '查询失败，请稍后重试';
      setParseError(msg);
      toast.error(msg);
    } finally {
      setFundQueryLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      tryParse(text, 'file', file.name);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.type === 'text/plain')) {
      handleFileUpload(file);
    } else {
      toast.error('请上传 CSV 或 TXT 文件');
    }
  };

  const tryParse = (text: string, source: 'file' | 'manual' = 'manual', fileName?: string) => {
    setParseError('');
    const parsed = parseNavCSV(text);
    if (parsed.length === 0) {
      setParseError('未能解析出有效数据，请检查格式是否正确（日期,净值,涨跌幅）');
      return;
    }
    onNavDataChange(parsed, source, fileName);
    toast.success(`成功解析 ${parsed.length} 条数据`);
  };

  const handleTextareaBlur = () => {
    if (csvText.trim()) tryParse(csvText);
  };

  const dataCount = navData.length;
  const dateRange =
    dataCount > 0 ? `${navData[0].date} ~ ${navData[navData.length - 1].date}` : '暂无数据';

  const updateTierField = <K extends keyof StrategyTier>(
    tiers: StrategyTier[],
    index: number,
    field: K,
    value: StrategyTier[K],
  ): StrategyTier[] => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: value };
    return updated;
  };

  const addTier = (tiers: StrategyTier[]): StrategyTier[] => {
    if (tiers.length >= 8) {
      toast.warning('最多支持 8 个档位');
      return tiers;
    }
    return [...tiers, {
      conditionType: 'loss',
      triggerPercent: 0.1,
      actionType: 'buy',
      buyAmount: 50,
      sellMode: 'amount',
      sellAmount: 50,
      clearAfterRebuy: false,
      rebuildBuyMode: 'fixed',
      rebuildBuyAmount: 0,
    }];
  };

  const removeTier = (tiers: StrategyTier[], index: number): StrategyTier[] => {
    if (tiers.length <= 1) {
      toast.warning('至少保留一个档位');
      return tiers;
    }
    return tiers.filter((_, i) => i !== index);
  };

  return (
    <div className="space-y-6">
      {/* 净值数据输入 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            净值数据
          </CardTitle>
          <CardDescription>
            支持 CSV 文件上传或直接粘贴，格式：日期,净值,涨跌幅
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 基金代码查询 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">基金代码查询</Label>
            <div className="flex gap-2">
              <Input
                ref={fundCodeRef}
                type="text"
                value={fundCodeInput}
                onChange={(e) => setFundCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !fundQueryLoading) {
                    e.preventDefault();
                    handleFundQuery();
                  }
                }}
                placeholder="输入基金代码，如 000001"
                maxLength={6}
                className="font-mono"
                disabled={fundQueryLoading}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFundQuery}
                disabled={fundQueryLoading}
                className="shrink-0"
              >
                {fundQueryLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    查询中
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    查询
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">上传文件 / 手动粘贴</span>
            </div>
          </div>

          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">点击或拖拽上传 CSV 文件</p>
            <p className="text-xs text-muted-foreground mt-1">支持 .csv / .txt 格式</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">或手动粘贴</span>
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              onBlur={handleTextareaBlur}
              placeholder={"日期,净值,涨跌幅\n2024-01-02,1.5000,0.0\n2024-01-03,1.4925,-0.5\n2024-01-04,1.4850,-0.5"}
              className="font-mono text-xs h-32 resize-y"
            />
            <div className="flex items-center justify-between text-xs">
              {parseError ? (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  {parseError}
                </span>
              ) : dataCount > 0 ? (
                <span className="text-muted-foreground">
                  共 <span className="text-foreground font-medium">{dataCount}</span> 条 · {dateRange}
                </span>
              ) : (
                <span className="text-muted-foreground">尚未解析数据</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  onNavDataChange([], 'manual');
                  setCsvText('');
                  setParseError('');
                }}
              >
                清空
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 参数设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">参数设置</CardTitle>
          <CardDescription>配置回测起止条件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>回测区间</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onResetDates}
              >
                <RotateCcw className="size-3 mr-1" />
                重置
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  min={navData[0]?.date}
                  max={navData[navData.length - 1]?.date}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  min={navData[0]?.date}
                  max={navData[navData.length - 1]?.date}
                  className="text-xs h-9"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-amount">初始投入（元）</Label>
            <Input
              id="initial-amount"
              type="number"
              min={1}
              value={initialAmount}
              onChange={(e) => onInitialAmountChange(Number(e.target.value) || 0)}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-return-rate">初始涨跌幅（%）</Label>
            <div className="relative">
              <Input
                id="initial-return-rate"
                type="text"
                inputMode="decimal"
                value={initialReturnRateDisplay}
                onChange={(e) => {
                  const raw = e.target.value;
                  setInitialReturnRateDisplay(raw);
                  const trimmed = raw.trim();
                  if (trimmed === '' || trimmed === '-') {
                    onInitialReturnRateChange(0);
                    return;
                  }
                  const num = Number(trimmed);
                  if (!Number.isNaN(num)) {
                    onInitialReturnRateChange(num / 100);
                  }
                }}
                onBlur={() => {
                  setInitialReturnRateDisplay(String(initialReturnRate * 100));
                }}
                className="h-9 pr-7 font-mono"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 策略参数（可编辑） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">策略参数</CardTitle>
          <CardDescription>自定义条件与动作档位，两种策略对比</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 方案一 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SchemeNameEditor
                name={schemeNameA}
                onChange={onSchemeNameAChange}
                variant="primary"
              />
              <span className="text-xs text-muted-foreground shrink-0">
                {strategyATiers.length} 档
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onStrategyAChange(addTier(strategyATiers))}
              >
                <Plus className="size-3.5 mr-1" />
                添加档位
              </Button>
            </div>
            <div className="space-y-2">
              {strategyATiers.map((tier, i) => (
                <StrategyTierRow
                  key={i}
                  tier={tier}
                  onChange={(field, value) =>
                    onStrategyAChange(
                      updateTierField(strategyATiers, i, field, value as never),
                    )
                  }
                  onRemove={() => onStrategyAChange(removeTier(strategyATiers, i))}
                />
              ))}
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">清仓阈值</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={clearThresholdA}
                    onChange={(e) => onClearThresholdAChange(Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                  />
                  <span className="text-muted-foreground">元</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">跌后买入</span>
                  <Select
                    value={clearRebuyModeA}
                    onValueChange={(v) => onClearRebuyModeAChange(v as RebuyAmountMode)}
                  >
                    <SelectTrigger className="h-6 text-xs w-[104px] px-2 [&_[data-slot=select-value]]:line-clamp-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[110px]">
                      <SelectItem value="fixed">固定金额</SelectItem>
                      <SelectItem value="totalInvested">总投入金额</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {clearRebuyModeA === 'fixed' && (
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={clearRebuyA}
                      onChange={(e) => onClearRebuyAChange(Math.max(0, Number(e.target.value) || 0))}
                      className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">元</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 方案二 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SchemeNameEditor
                name={schemeNameB}
                onChange={onSchemeNameBChange}
                variant="secondary"
              />
              <span className="text-xs text-muted-foreground shrink-0">
                {strategyBTiers.length} 档
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onStrategyBChange(addTier(strategyBTiers))}
              >
                <Plus className="size-3.5 mr-1" />
                添加档位
              </Button>
            </div>
            <div className="space-y-2">
              {strategyBTiers.map((tier, i) => (
                <StrategyTierRow
                  key={i}
                  tier={tier}
                  onChange={(field, value) =>
                    onStrategyBChange(
                      updateTierField(strategyBTiers, i, field, value as never),
                    )
                  }
                  onRemove={() => onStrategyBChange(removeTier(strategyBTiers, i))}
                />
              ))}
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">清仓阈值</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={clearThresholdB}
                    onChange={(e) => onClearThresholdBChange(Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                  />
                  <span className="text-muted-foreground">元</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">跌后买入</span>
                  <Select
                    value={clearRebuyModeB}
                    onValueChange={(v) => onClearRebuyModeBChange(v as RebuyAmountMode)}
                  >
                    <SelectTrigger className="h-6 text-xs w-[104px] px-2 [&_[data-slot=select-value]]:line-clamp-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[110px]">
                      <SelectItem value="fixed">固定金额</SelectItem>
                      <SelectItem value="totalInvested">总投入金额</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {clearRebuyModeB === 'fixed' && (
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={clearRebuyB}
                      onChange={(e) => onClearRebuyBChange(Math.max(0, Number(e.target.value) || 0))}
                      className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">元</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 回测按钮 */}
      <Button
        onClick={onBacktest}
        disabled={dataCount === 0 || isRunning || !startDate || !endDate}
        className="w-full h-12 text-base"
      >
        {isRunning ? '回测中...' : '开始回测'}
      </Button>
    </div>
  );
}

interface SchemeNameEditorProps {
  name: string;
  onChange: (name: string) => void;
  variant: 'primary' | 'secondary';
}

function SchemeNameEditor({ name, onChange, variant }: SchemeNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onChange(trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(name);
    setEditing(false);
  };

  const badgeClass = variant === 'primary'
    ? 'bg-primary text-primary-foreground'
    : 'bg-secondary text-secondary-foreground';

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={handleSubmit}
          className="h-7 text-sm px-2 py-0"
          maxLength={20}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleSubmit}
          aria-label="确认"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleCancel}
          aria-label="取消"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 group flex-1 min-w-0 justify-start"
    >
      <Badge variant="default" className={`${badgeClass} shrink-0 text-xs`}>
        {name}
      </Badge>
      <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

interface StrategyTierRowProps {
  tier: StrategyTier;
  onChange: <K extends keyof StrategyTier>(field: K, value: StrategyTier[K]) => void;
  onRemove: () => void;
}

function StrategyTierRow({ tier, onChange, onRemove }: StrategyTierRowProps) {
  const conditionColor = tier.conditionType === 'loss' ? 'text-destructive' : 'text-success';

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 flex flex-col gap-1.5 bg-muted/40 rounded-md px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            value={tier.conditionType}
            onValueChange={(v) => onChange('conditionType', v as TierConditionType)}
          >
            <SelectTrigger className="h-7 text-xs w-[70px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loss">亏损</SelectItem>
              <SelectItem value="profit">盈利</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground shrink-0">≥</span>

          <Input
            type="number"
            step="1"
            min={0}
            value={Math.round(tier.triggerPercent * 1000) / 10}
            onChange={(e) => {
              const v = Math.max(0, Math.abs(Number(e.target.value) || 0)) / 100;
              onChange('triggerPercent', v);
            }}
            className="h-7 text-xs px-1.5 w-14 text-center tabular-nums"
          />
          <span className={`text-xs font-medium shrink-0 ${conditionColor}`}>%</span>

          <span className="text-xs text-muted-foreground mx-0.5 shrink-0">→</span>

          <Select
            value={tier.actionType}
            onValueChange={(v) => onChange('actionType', v as TierActionType)}
          >
            <SelectTrigger className="h-7 text-xs w-[104px] px-2 [&_[data-slot=select-value]]:line-clamp-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[110px]">
              <SelectItem value="buy">跌后加仓</SelectItem>
              <SelectItem value="sell">涨后减仓</SelectItem>
            </SelectContent>
          </Select>

          {tier.actionType === 'buy' ? (
            <>
              <Input
                type="number"
                min={0}
                step={10}
                value={tier.buyAmount}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  onChange('buyAmount', v);
                }}
                className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
              />
              <span className="text-xs text-muted-foreground shrink-0">元</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Select
                value={tier.sellMode}
                onValueChange={(v) => onChange('sellMode', v as TierSellMode)}
              >
                <SelectTrigger className="h-7 text-xs w-[108px] px-2 [&_[data-slot=select-value]]:line-clamp-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-[108px]">
                  <SelectItem value="amount">按金额</SelectItem>
                  <SelectItem value="quarter">1/4 仓位</SelectItem>
                  <SelectItem value="third">1/3 仓位</SelectItem>
                  <SelectItem value="half">1/2 仓位</SelectItem>
                  <SelectItem value="all">全部清仓</SelectItem>
                </SelectContent>
              </Select>
              {tier.sellMode === 'amount' && (
                <>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={tier.sellAmount}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      onChange('sellAmount', v);
                    }}
                    className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">元</span>
                </>
              )}
            </div>
          )}
        </div>
        {tier.actionType === 'sell' && tier.sellMode === 'all' && (
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <button
              type="button"
              onClick={() => onChange('clearAfterRebuy', !tier.clearAfterRebuy)}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                tier.clearAfterRebuy ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center size-4 rounded border',
                  tier.clearAfterRebuy
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border bg-background',
                )}
              >
                {tier.clearAfterRebuy && <Check className="size-3" />}
              </span>
              清仓后跌后买入
            </button>
            {tier.clearAfterRebuy && (
              <>
                <Select
                  value={tier.rebuildBuyMode}
                  onValueChange={(v) => onChange('rebuildBuyMode', v as RebuyAmountMode)}
                >
                  <SelectTrigger className="h-7 text-xs w-[104px] px-2 [&_[data-slot=select-value]]:line-clamp-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[110px]">
                    <SelectItem value="fixed">固定金额</SelectItem>
                    <SelectItem value="totalInvested">总投入金额</SelectItem>
                  </SelectContent>
                </Select>
                {tier.rebuildBuyMode === 'fixed' && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={tier.rebuildBuyAmount}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        onChange('rebuildBuyAmount', v);
                      }}
                      className="h-7 text-xs px-1.5 w-16 text-center tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">元</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label="删除档位"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
