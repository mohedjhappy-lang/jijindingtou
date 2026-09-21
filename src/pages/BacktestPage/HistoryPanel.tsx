import { useState, useRef, useEffect } from 'react';
import { X, Trash2, Pencil, Check, Clock, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { BacktestHistoryItem } from '@/lib/history';

interface HistoryPanelProps {
  list: BacktestHistoryItem[];
  onRestore: (item: BacktestHistoryItem) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryPanel({
  list,
  onRestore,
  onDelete,
  onRename,
  onClearAll,
  onClose,
}: HistoryPanelProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const filtered = list.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleStartRename = (item: BacktestHistoryItem) => {
    setEditingId(item.id);
    setEditingValue(item.name);
  };

  const handleSubmitRename = () => {
    if (editingId && editingValue.trim()) {
      onRename(editingId, editingValue.trim());
    }
    setEditingId(null);
    setEditingValue('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    if (confirm(`确定要清空全部 ${list.length} 条历史记录吗？此操作不可撤销。`)) {
      onClearAll();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* 抽屉面板 */}
      <div className="relative w-full max-w-md bg-background shadow-2xl h-full overflow-y-auto">
        <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h2 className="text-base font-semibold">历史回测记录</h2>
            <span className="text-xs text-muted-foreground">({list.length} 条)</span>
          </div>
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleClearAll}
              >
                <Trash2 className="size-3.5 mr-1" />
                清空全部
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="关闭"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索历史记录..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {list.length === 0
                ? '暂无历史记录，保存回测结果后会显示在这里'
                : '没有匹配的记录'}
            </div>
          ) : (
            filtered.map((item) => {
              const isEditing = editingId === item.id;
              const rateA = item.resultA?.totalAssetsReturn ?? 0;
              const rateB = item.resultB?.totalAssetsReturn ?? 0;
              return (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => !isEditing && onRestore(item)}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    {isEditing ? (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          ref={inputRef}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          onBlur={handleSubmitRename}
                          className="h-7 text-sm px-2 py-0"
                          maxLength={40}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={handleSubmitRename}
                          aria-label="确认"
                        >
                          <Check className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{item.name}</span>
                        <button
                          type="button"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(item);
                          }}
                          aria-label="重命名"
                        >
                          <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 ml-6 text-xs text-muted-foreground">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>·</span>
                      <span>{item.navData.length} 条数据</span>
                      <span>·</span>
                      <Badge variant="outline" className="text-[11px] h-4 px-1 font-normal tabular-nums">
                        {item.schemeNameA}: {rateA >= 0 ? '+' : ''}{(rateA * 100).toFixed(2)}%
                      </Badge>
                      <Badge variant="outline" className="text-[11px] h-4 px-1 font-normal tabular-nums">
                        {item.schemeNameB}: {rateB >= 0 ? '+' : ''}{(rateB * 100).toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确定要删除这条历史记录吗？')) {
                        onDelete(item.id);
                      }
                    }}
                    aria-label="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
