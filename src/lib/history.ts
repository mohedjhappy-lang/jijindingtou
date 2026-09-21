/**
 * 历史记录管理模块
 * 使用 localStorage 持久化保存回测记录
 */
import type { INavData } from '@/data/fund';
import type { BacktestResult, StrategyTier, RebuyAmountMode } from './backtest';

export interface BacktestHistoryItem {
  id: string;
  name: string;
  createdAt: number;
  navData: INavData[];
  startDate: string;
  endDate: string;
  initialAmount: number;
  initialReturnRate: number;
  strategyATiers: StrategyTier[];
  strategyBTiers: StrategyTier[];
  resultA: BacktestResult;
  resultB: BacktestResult;
  dataSource: 'file' | 'manual' | 'fundCode';
  fileName?: string;
  fundCode?: string;
  fundName?: string;
  schemeNameA: string;
  schemeNameB: string;
  clearThresholdA: number;
  clearThresholdB: number;
  clearRebuyA: number;
  clearRebuyB: number;
  clearRebuyModeA: RebuyAmountMode;
  clearRebuyModeB: RebuyAmountMode;
}

const STORAGE_KEY = 'fund_backtest_history_v1';

/** 获取所有历史记录 */
export function loadHistory(): BacktestHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as BacktestHistoryItem[];
    return [];
  } catch {
    return [];
  }
}

/** 保存一条历史记录（自动去重：同 id 替换），返回最新列表 */
export function saveHistory(item: BacktestHistoryItem): BacktestHistoryItem[] {
  const list = loadHistory();
  const idx = list.findIndex((r) => r.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.unshift(item);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略
  }
  return list;
}

/** 删除单条记录，返回最新列表 */
export function deleteHistory(id: string): BacktestHistoryItem[] {
  const list = loadHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略
  }
  return list;
}

/** 批量删除，返回最新列表 */
export function deleteHistoryBatch(ids: string[]): BacktestHistoryItem[] {
  const list = loadHistory().filter((r) => !ids.includes(r.id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略
  }
  return list;
}

/** 重命名，返回最新列表 */
export function renameHistory(id: string, name: string): BacktestHistoryItem[] {
  const list = loadHistory();
  const idx = list.findIndex((r) => r.id === id);
  if (idx >= 0) {
    list[idx].name = name;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // 忽略
    }
  }
  return list;
}
