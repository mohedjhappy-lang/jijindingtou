// EXPORTS: StrategyTier, TierConditionType, TierActionType, TierSellMode, DailyAction, DailyRecord, BacktestResult, BenchmarkRecord, runBacktest, calculateBenchmark, parseNavCSV, calculateMaxDrawdown, countAdds, normalizeStrategyTiers

import type { INavData } from '@/data/fund';

export type TierConditionType = 'loss' | 'profit';
export type TierActionType = 'buy' | 'sell';
export type TierSellMode = 'amount' | 'quarter' | 'third' | 'half' | 'all' | 'rebuild';
export type RebuyAmountMode = 'fixed' | 'totalInvested';

export interface StrategyTier {
  conditionType: TierConditionType;
  triggerPercent: number;
  actionType: TierActionType;
  buyAmount: number;
  sellMode: TierSellMode;
  sellAmount: number;
  clearAfterRebuy: boolean;
  rebuildBuyMode: RebuyAmountMode;
  rebuildBuyAmount: number;
}

export interface DailyAction {
  type: 'buy' | 'sell';
  amount: number;
  shareChange: number;
  description: string;
}

export interface DailyRecord {
  date: string;
  nav: number;
  change: number;
  marketValue: number;
  totalPrincipal: number;
  totalInvested: number;
  totalWithdrawn: number;
  totalAssetsReturn: number;
  returnRate: number;
  addAmount: number;
  sellAmount: number;
  actions: DailyAction[];
  cycleInvested: number;
  cycleWithdrawn: number;
  cycleProfit: number;
  cycleReturn: number;
}

export interface BacktestResult {
  finalReturnRate: number;
  totalPrincipal: number;
  totalProfit: number;
  maxDrawdown: number;
  addCount: number;
  totalAddAmount: number;
  sellCount: number;
  totalSellAmount: number;
  totalInvested: number;
  totalWithdrawn: number;
  totalAssetsProfit: number;
  totalAssetsReturn: number;
  clearCount: number;
  currentCycleInvested: number;
  currentCycleProfit: number;
  currentCycleReturn: number;
  cycles: InvestmentCycle[];
  dailyRecords: DailyRecord[];
}

export interface BenchmarkRecord {
  date: string;
  nav: number;
  returnRate: number;
  change: number;
}

export interface InvestmentCycle {
  cycleIndex: number;
  startDate: string;
  endDate: string;
  totalInvested: number;
  endValue: number;
  cycleWithdrawn: number;
  profit: number;
  returnRate: number;
  status: 'active' | 'closed';
}

/**
 * 兼容旧版档位数据：将 lossPercent/addAmount 格式迁移为新的 conditionType/triggerPercent/actionType 等格式
 */
export function normalizeStrategyTiers(tiers: Array<Record<string, unknown> | StrategyTier>): StrategyTier[] {
  return tiers.map((t) => {
    if ('conditionType' in t && typeof t.conditionType === 'string') {
      const rawMode = ((t as { sellMode?: TierSellMode }).sellMode) || 'amount';
      const migratedMode = rawMode === 'rebuild' ? 'all' : rawMode;
      const migratedClearAfterRebuy = rawMode === 'rebuild'
        ? true
        : ((t as { clearAfterRebuy?: boolean }).clearAfterRebuy ?? false);
      return {
        conditionType: t.conditionType as TierConditionType,
        triggerPercent: (t as { triggerPercent?: number }).triggerPercent ?? 0.05,
        actionType: (t as { actionType?: TierActionType }).actionType ?? 'buy',
        buyAmount: (t as { buyAmount?: number }).buyAmount ?? 50,
        sellMode: migratedMode,
        sellAmount: (t as { sellAmount?: number }).sellAmount ?? 50,
        clearAfterRebuy: migratedClearAfterRebuy,
        rebuildBuyMode: ((t as { rebuildBuyMode?: RebuyAmountMode }).rebuildBuyMode) || 'fixed',
        rebuildBuyAmount: (t as { rebuildBuyAmount?: number }).rebuildBuyAmount ?? 0,
      };
    }
    const lossPercent = (t as { lossPercent?: number }).lossPercent;
    const addAmount = (t as { addAmount?: number }).addAmount;
    const triggerPct = lossPercent !== undefined ? Math.abs(lossPercent) : 0.05;
    return {
      conditionType: 'loss',
      triggerPercent: triggerPct,
      actionType: 'buy',
      buyAmount: addAmount ?? 50,
      sellMode: 'amount',
      sellAmount: addAmount ?? 50,
      clearAfterRebuy: false,
      rebuildBuyMode: 'fixed',
      rebuildBuyAmount: 0,
    };
  });
}

/**
 * 执行单策略回测
 */
export function runBacktest(
  navData: INavData[],
  startDate: string,
  endDate: string,
  initialAmount: number,
  strategyTiers: StrategyTier[],
  initialReturnRate: number = 0,
  clearRebuyThreshold: number = 50,
  clearRebuyAmount: number = 50,
  clearRebuyMode: RebuyAmountMode = 'fixed',
): BacktestResult {
  const startIdx = navData.findIndex((item) => item.date === startDate);
  const endIdx = navData.findIndex((item) => item.date === endDate);
  if (startIdx === -1) {
    return emptyResult();
  }

  const realEndIdx = endIdx === -1 ? navData.length - 1 : endIdx;
  if (realEndIdx < startIdx) {
    return emptyResult();
  }

  const dataSlice = navData.slice(startIdx, realEndIdx + 1);
  const dailyRecords: DailyRecord[] = [];

  const initialNav = dataSlice[0].nav;
  let shares = initialAmount / initialNav;
  let totalPrincipal = initialAmount;
  let totalInvested = initialAmount;
  let totalWithdrawn = 0;
  let clearCount = 0;
  let currentCycleInvested = initialAmount;
  let currentCycleStartDate = dataSlice[0].date;
  let currentCycleWithdrawn = 0;
  let pendingRebuyAmount = 0;
  let pendingRebuyIsTotalInvested = false;
  let waitingForDrop = false;
  const cycles: InvestmentCycle[] = [];

  function closeCycle(endDate: string, clearCash: number, invested: number) {
    const totalReturned = currentCycleWithdrawn + clearCash;
    const totalAssetsProfit = totalReturned - invested;
    const totalAssetsRate = invested > 0 ? totalAssetsProfit / invested : 0;
    const adjustedRate = (1 + totalAssetsRate) * (1 + initialReturnRate) - 1;
    const cycle: InvestmentCycle = {
      cycleIndex: cycles.length + 1,
      startDate: currentCycleStartDate,
      endDate,
      totalInvested: invested,
      endValue: clearCash,
      cycleWithdrawn: currentCycleWithdrawn,
      profit: totalAssetsProfit,
      returnRate: adjustedRate,
      status: 'closed',
    };
    cycles.push(cycle);
  }

  const sortedTiers = [...strategyTiers].sort((a, b) => b.triggerPercent - a.triggerPercent);

  for (let i = 0; i < dataSlice.length; i++) {
    const day = dataSlice[i];
    const marketValue = shares * day.nav;
    const profitRatio = (marketValue - totalPrincipal) / totalPrincipal;

    let dayAddAmount = 0;
    let daySellAmount = 0;
    const dayActions: DailyAction[] = [];

    // 清仓后跌后买入
    if (waitingForDrop && day.change < 0) {
      const actualRebuyAmount = pendingRebuyIsTotalInvested ? totalInvested : pendingRebuyAmount;
      if (actualRebuyAmount <= 0) {
        pendingRebuyAmount = 0;
        pendingRebuyIsTotalInvested = false;
        waitingForDrop = false;
      } else {
        const rebuyShares = actualRebuyAmount / day.nav;
        shares += rebuyShares;
        totalPrincipal += actualRebuyAmount;
        totalInvested += actualRebuyAmount;
        currentCycleInvested += actualRebuyAmount;
        if (currentCycleInvested === actualRebuyAmount) {
          currentCycleStartDate = day.date;
          currentCycleWithdrawn = 0;
        }
        dayAddAmount += actualRebuyAmount;
        dayActions.push({
          type: 'buy',
          amount: actualRebuyAmount,
          shareChange: rebuyShares,
          description: pendingRebuyIsTotalInvested
            ? `跌后买入（总投入）${actualRebuyAmount.toFixed(0)}元`
            : `跌后买入${actualRebuyAmount.toFixed(0)}元`,
        });
        pendingRebuyAmount = 0;
        pendingRebuyIsTotalInvested = false;
        waitingForDrop = false;
      }
    } else if (waitingForDrop) {
      dayActions.push({
        type: 'buy',
        amount: 0,
        shareChange: 0,
        description: '等待下跌买入',
      });
    }

    if (i > 0 && shares > 0) {
      const adjustedProfitRatio = (1 + profitRatio) * (1 + initialReturnRate) - 1;
      const isDownDay = day.change < 0;
      const isUpDay = day.change > 0;

      let triggeredTier: StrategyTier | null = null;
      for (const tier of sortedTiers) {
        if (tier.conditionType === 'loss') {
          if (adjustedProfitRatio <= -tier.triggerPercent) {
            triggeredTier = tier;
            break;
          }
        } else {
          if (adjustedProfitRatio >= tier.triggerPercent) {
            triggeredTier = tier;
            break;
          }
        }
      }

      if (triggeredTier) {
        if (triggeredTier.actionType === 'buy') {
          if (isDownDay && triggeredTier.buyAmount > 0) {
            const buyShares = triggeredTier.buyAmount / day.nav;
            shares += buyShares;
            totalPrincipal += triggeredTier.buyAmount;
            totalInvested += triggeredTier.buyAmount;
            currentCycleInvested += triggeredTier.buyAmount;
            dayAddAmount = triggeredTier.buyAmount;
            dayActions.push({
              type: 'buy',
              amount: triggeredTier.buyAmount,
              shareChange: buyShares,
              description: `跌后加仓${triggeredTier.buyAmount.toFixed(0)}元`,
            });
          }
        } else {
          if (!isDownDay) {
            let sellShares = 0;
            let sellCash = 0;
            let desc = '';

            switch (triggeredTier.sellMode) {
              case 'amount': {
                const amt = Math.min(triggeredTier.sellAmount, marketValue);
                sellShares = amt / day.nav;
                sellCash = amt;
                desc = `涨后减仓${amt.toFixed(0)}元`;
                break;
              }
              case 'quarter': {
                sellShares = shares * 0.25;
                sellCash = sellShares * day.nav;
                desc = '涨后减仓1/4';
                break;
              }
              case 'third': {
                sellShares = shares / 3;
                sellCash = sellShares * day.nav;
                desc = '涨后减仓1/3';
                break;
              }
              case 'half': {
                sellShares = shares * 0.5;
                sellCash = sellShares * day.nav;
                desc = '涨后减仓1/2';
                break;
              }
              case 'all': {
                sellShares = shares;
                sellCash = sellShares * day.nav;
                desc = triggeredTier.clearAfterRebuy ? '清仓（跌后重建）' : '全部清仓';
                break;
              }
              case 'rebuild': {
                sellShares = shares;
                sellCash = sellShares * day.nav;
                desc = '清仓（跌后重建）';
                break;
              }
              default: {
                sellShares = shares;
                sellCash = sellShares * day.nav;
                desc = '全部清仓';
                break;
              }
            }

            if (sellShares > 0) {
              const isFullClear = sellShares >= shares - 1e-9;
              const principalReduction = totalPrincipal * (sellShares / shares);
              shares -= sellShares;
              totalPrincipal -= principalReduction;
              daySellAmount = sellCash;
              totalWithdrawn += sellCash;
              if (!isFullClear) {
                currentCycleWithdrawn += sellCash;
              }
              dayActions.push({
                type: 'sell',
                amount: sellCash,
                shareChange: -sellShares,
                description: desc,
              });

              if (isFullClear) {
                clearCount += 1;
                closeCycle(day.date, sellCash, currentCycleInvested);
                currentCycleInvested = 0;
                currentCycleWithdrawn = 0;
              }

              // 清仓重建：减仓后若剩余市值低于阈值，则全部清仓并于次日重建
              const remainingMarketValue = shares * day.nav;
              if (
                remainingMarketValue < clearRebuyThreshold
                && clearRebuyThreshold > 0
                && shares > 0
                && clearRebuyAmount > 0
              ) {
                const clearShares = shares;
                const clearCash = clearShares * day.nav;
                const clearPrincipalReduction = totalPrincipal * (clearShares / shares);
                shares -= clearShares;
                totalPrincipal -= clearPrincipalReduction;
                daySellAmount += clearCash;
                totalWithdrawn += clearCash;
                dayActions.push({
                  type: 'sell',
                  amount: clearCash,
                  shareChange: -clearShares,
                  description: '清仓（低于阈值）',
                });
                if (i < dataSlice.length - 1) {
                  if (clearRebuyMode === 'totalInvested') {
                    pendingRebuyIsTotalInvested = true;
                    pendingRebuyAmount = 0;
                  } else {
                    pendingRebuyAmount = clearRebuyAmount;
                    pendingRebuyIsTotalInvested = false;
                  }
                  waitingForDrop = true;
                }
                clearCount += 1;
                closeCycle(day.date, clearCash, currentCycleInvested);
                currentCycleInvested = 0;
                currentCycleWithdrawn = 0;
              }

              // 全部清仓 + 跌后买入：设置等待下跌重建买入金额
              if (
                (triggeredTier.sellMode === 'all' && triggeredTier.clearAfterRebuy && (triggeredTier.rebuildBuyMode === 'totalInvested' || triggeredTier.rebuildBuyAmount > 0)) ||
                (triggeredTier.sellMode === 'rebuild' && triggeredTier.rebuildBuyAmount > 0)
              ) {
                if (i < dataSlice.length - 1) {
                  if (triggeredTier.rebuildBuyMode === 'totalInvested') {
                    pendingRebuyIsTotalInvested = true;
                    pendingRebuyAmount = 0;
                  } else {
                    pendingRebuyAmount = triggeredTier.rebuildBuyAmount;
                    pendingRebuyIsTotalInvested = false;
                  }
                  waitingForDrop = true;
                }
              }
            }
          }
        }
      }
    }

    const updatedMarketValue = shares * day.nav;
    const safeMarketValue = Number.isFinite(updatedMarketValue) ? updatedMarketValue : 0;
    const baseReturnRate = totalPrincipal > 0
      ? (safeMarketValue - totalPrincipal) / totalPrincipal
      : 0;
    const returnRate = (1 + baseReturnRate) * (1 + initialReturnRate) - 1;

    const totalAssets = safeMarketValue + totalWithdrawn;
    const baseAssetsReturn = totalInvested > 0
      ? (totalAssets - totalInvested) / totalInvested
      : 0;
    const totalAssetsReturn = (1 + baseAssetsReturn) * (1 + initialReturnRate) - 1;

    const baseCycleReturn = currentCycleInvested > 0
      ? (safeMarketValue - currentCycleInvested) / currentCycleInvested
      : 0;
    const cycleReturn = Number.isFinite(baseCycleReturn)
      ? (1 + baseCycleReturn) * (1 + initialReturnRate) - 1
      : 0;

    const cycleProfit = currentCycleInvested > 0 || currentCycleWithdrawn > 0 || safeMarketValue > 0
      ? currentCycleWithdrawn + safeMarketValue - currentCycleInvested
      : 0;

    dailyRecords.push({
      date: day.date,
      nav: day.nav,
      change: day.change,
      marketValue: updatedMarketValue,
      totalPrincipal,
      totalInvested,
      totalWithdrawn,
      totalAssetsReturn,
      returnRate,
      addAmount: dayAddAmount,
      sellAmount: daySellAmount,
      actions: dayActions,
      cycleInvested: currentCycleInvested,
      cycleWithdrawn: currentCycleWithdrawn,
      cycleProfit,
      cycleReturn: Number.isFinite(cycleReturn) ? cycleReturn : 0,
    });
  }

  const lastRecord = dailyRecords[dailyRecords.length - 1];
  const finalMarketValue = lastRecord ? (Number.isFinite(lastRecord.marketValue) ? lastRecord.marketValue : 0) : 0;
  const stats = computeStats(dailyRecords);

  const finalTotalInvested = lastRecord ? lastRecord.totalInvested : 0;
  const finalTotalWithdrawn = lastRecord ? lastRecord.totalWithdrawn : 0;
  const totalAssetsProfit = finalMarketValue + finalTotalWithdrawn - finalTotalInvested;
  const finalTotalAssetsReturn = lastRecord ? lastRecord.totalAssetsReturn : 0;

  const finalCycleInvested = lastRecord ? lastRecord.cycleInvested : 0;
  const finalCycleReturn = lastRecord ? lastRecord.cycleReturn : 0;
  const currentCycleProfit = finalMarketValue - finalCycleInvested;

  const allCycles: InvestmentCycle[] = [...cycles];
  if (finalCycleInvested > 0) {
    const totalAssets = finalMarketValue + currentCycleWithdrawn;
    const cycleProfit = totalAssets - finalCycleInvested;
    const baseCycleRate = finalCycleInvested > 0 ? cycleProfit / finalCycleInvested : 0;
    const cycleRate = (1 + baseCycleRate) * (1 + initialReturnRate) - 1;
    allCycles.push({
      cycleIndex: cycles.length + 1,
      startDate: currentCycleStartDate,
      endDate: lastRecord ? lastRecord.date : currentCycleStartDate,
      totalInvested: finalCycleInvested,
      endValue: finalMarketValue,
      cycleWithdrawn: currentCycleWithdrawn,
      profit: cycleProfit,
      returnRate: cycleRate,
      status: 'active',
    });
  }

  return {
    finalReturnRate: lastRecord ? lastRecord.returnRate : 0,
    totalPrincipal,
    totalProfit: finalMarketValue - totalPrincipal,
    maxDrawdown: stats.maxDrawdown,
    addCount: stats.addCount,
    totalAddAmount: stats.totalAddAmount,
    sellCount: stats.sellCount,
    totalSellAmount: stats.totalSellAmount,
    totalInvested: finalTotalInvested,
    totalWithdrawn: finalTotalWithdrawn,
    totalAssetsProfit,
    totalAssetsReturn: finalTotalAssetsReturn,
    clearCount,
    currentCycleInvested: finalCycleInvested,
    currentCycleProfit,
    currentCycleReturn: finalCycleReturn,
    cycles: allCycles,
    dailyRecords,
  };
}

function emptyResult(): BacktestResult {
  return {
    finalReturnRate: 0,
    totalPrincipal: 0,
    totalProfit: 0,
    maxDrawdown: 0,
    addCount: 0,
    totalAddAmount: 0,
    sellCount: 0,
    totalSellAmount: 0,
    totalInvested: 0,
    totalWithdrawn: 0,
    totalAssetsProfit: 0,
    totalAssetsReturn: 0,
    clearCount: 0,
    currentCycleInvested: 0,
    currentCycleProfit: 0,
    currentCycleReturn: 0,
    dailyRecords: [],
    cycles: [],
  };
}

function computeStats(records: DailyRecord[]) {
  let maxDrawdown = 0;
  let addCount = 0;
  let totalAddAmount = 0;
  let sellCount = 0;
  let totalSellAmount = 0;

  for (const r of records) {
    if (r.totalAssetsReturn < maxDrawdown) maxDrawdown = r.totalAssetsReturn;
    if (r.addAmount > 0) {
      addCount += 1;
      totalAddAmount += r.addAmount;
    }
    if (r.sellAmount > 0) {
      sellCount += 1;
      totalSellAmount += r.sellAmount;
    }
  }

  return { maxDrawdown, addCount, totalAddAmount, sellCount, totalSellAmount };
}

/**
 * 计算基金基准走势
 */
export function calculateBenchmark(
  navData: INavData[],
  startDate: string,
  endDate?: string,
  initialReturnRate: number = 0,
): BenchmarkRecord[] {
  const startIdx = navData.findIndex((item) => item.date === startDate);
  if (startIdx === -1) return [];

  let endIdx = navData.length - 1;
  if (endDate) {
    const idx = navData.findIndex((item) => item.date === endDate);
    if (idx !== -1 && idx >= startIdx) endIdx = idx;
  }

  const dataSlice = navData.slice(startIdx, endIdx + 1);
  const startNav = dataSlice[0].nav;

  return dataSlice.map((day) => ({
    date: day.date,
    nav: day.nav,
    returnRate: (1 + (day.nav - startNav) / startNav) * (1 + initialReturnRate) - 1,
    change: day.change,
  }));
}

/**
 * 计算最大回撤
 */
export function calculateMaxDrawdown(rates: number[]): number {
  if (rates.length === 0) return 0;
  let minRate = 0;
  for (const r of rates) {
    if (r < minRate) minRate = r;
  }
  return minRate;
}

/**
 * 统计加仓次数
 */
export function countAdds(records: DailyRecord[]): number {
  return records.filter((r) => r.addAmount > 0).length;
}

/**
 * 解析 CSV 格式的净值数据
 */
export function parseNavCSV(csvText: string): INavData[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const result: INavData[] = [];
  let startIdx = 0;

  const firstLine = lines[0].split(/[,，\t\s]+/);
  const hasHeader = /日期|date|净值|nav|涨跌幅|change/i.test(firstLine.join(''));
  if (hasHeader) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/[,，\t\s]+/).filter(Boolean);
    if (parts.length < 2) continue;

    const date = normalizeDate(parts[0]);
    const nav = parseFloat(parts[1]);
    const change = parts[2] !== undefined ? parseChange(parts[2]) : 0;

    if (!date || isNaN(nav) || nav <= 0) continue;

    result.push({ date, nav, change });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function normalizeDate(raw: string): string {
  const match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return '';
  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseChange(raw: string): number {
  const cleaned = raw.replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
