import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './index.css'

// ----------------------------------------------------------------------
// 型別定義
// ----------------------------------------------------------------------
interface DrugRecord {
  編號: string;
  中文品名: string;
  許可證字號: string;
  供應狀態: string;
  公告更新時間: string;
  _theme?: Theme;
}

interface SupplyData {
  last_updated: string;
  datasets: { [key: string]: DrugRecord[] };
}

type Theme = 'red' | 'amber' | 'emerald';

// ----------------------------------------------------------------------
// 統計與清洗邏輯 Hook
// ----------------------------------------------------------------------
const useCompositeStats = (allData: DrugRecord[]) => {
  return useMemo(() => {
    if (!allData.length) return { uniqueDrugCount: 0, monthlyChart: [], yearlyChart: [] };

    const uniqueDrugs = new Set(allData.map(item => item.許可證字號 || '未知字號'));
    const monthlyMap: Record<string, any> = {};
    const yearlyMap: Record<string, any> = {};

    allData.forEach(item => {
      const dateStr = item.公告更新時間 || '';
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        const year = parts[0];
        const month = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        const theme = item._theme;

        if (!monthlyMap[month]) monthlyMap[month] = { label: month, red: 0, amber: 0, emerald: 0 };
        if (theme === 'red') monthlyMap[month].red++;
        else if (theme === 'amber') monthlyMap[month].amber++;
        else if (theme === 'emerald') monthlyMap[month].emerald++;

        if (!yearlyMap[year]) yearlyMap[year] = { label: `${year}年`, red: 0, amber: 0, emerald: 0 };
        if (theme === 'red') yearlyMap[year].red++;
        else if (theme === 'amber') yearlyMap[year].amber++;
        else if (theme === 'emerald') yearlyMap[year].emerald++;
      }
    });

    const format = (map: Record<string, any>) =>
      Object.values(map).sort((a: any, b: any) => a.label.localeCompare(b.label)).map(d => ({
        name: d.label,
        '無替代(紅)': d.red,
        '有替代(黃)': d.amber,
        '已解除(綠)': d.emerald
      }));

    return {
      uniqueDrugCount: uniqueDrugs.size,
      monthlyChart: format(monthlyMap),
      yearlyChart: format(yearlyMap)
    };
  }, [allData]);
};

// ----------------------------------------------------------------------
// 工具函數
// ----------------------------------------------------------------------
const groupAndSortByYearAndMonth = (list: DrugRecord[]) => {
  const sorted = [...list].sort((a, b) => new Date(b.公告更新時間).getTime() - new Date(a.公告更新時間).getTime());
  return sorted.reduce((acc, curr) => {
    const parts = (curr.公告更新時間 || '').split('/');
    const yearKey = parts[0] ? `${parts[0]}年` : '未知';
    const monthKey = parts[1] ? `${parts[1]}月` : '未知';
    if (!acc[yearKey]) acc[yearKey] = {};
    if (!acc[yearKey][monthKey]) acc[yearKey][monthKey] = [];
    acc[yearKey][monthKey].push(curr);
    return acc;
  }, {} as any);
};

const extractRecoveryTime = (text: string) => {
  if (!text) return null;
  const match = text.replace(/\\r\\n/g, '').match(/(無法預計[^\u3002，,]*|預計[^\u3002，]*(恢復|供應)[^\u3002，]*)/);
  return match ? match[0] : null;
};

// ----------------------------------------------------------------------
// 主元件
// ----------------------------------------------------------------------
export default function App() {
  const [data, setData] = useState<SupplyData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [timeMode, setTimeMode] = useState<'month' | 'year'>('month');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/supply_status_latest.json`)
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const processedData = useMemo(() => {
    const filter = (list: DrugRecord[] = [], theme: Theme) =>
      list.filter(i =>
        (i.中文品名 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.許可證字號 || '').includes(searchTerm)
      ).map(i => ({ ...i, _theme: theme }));

    const noAlt = filter(data?.datasets['54505_no_alternative'], 'red');
    const withAlt = filter(data?.datasets['54504_with_alternative'], 'amber');
    const resolved = filter(data?.datasets['54506_resolved'], 'emerald');

    const all = [...noAlt, ...withAlt, ...resolved].sort((a, b) =>
      new Date(b.公告更新時間).getTime() - new Date(a.公告更新時間).getTime()
    );

    return { noAlt, withAlt, resolved, all };
  }, [data, searchTerm]);

  const stats = useCompositeStats(processedData.all);
  const chartData = timeMode === 'month' ? stats.monthlyChart : stats.yearlyChart;

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f4f8',
      gap: '16px'
    }}>
      <div style={{
        width: '48px', height: '48px',
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: '#64748b', fontWeight: 600, fontSize: '15px', letterSpacing: '0.05em' }}>系統讀取中…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '64px', fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif' }}>

      {/* ── 導覽列 ── */}
      <nav style={{
        backgroundColor: '#0f172a',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)'
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          padding: '0 16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          paddingTop: '14px', paddingBottom: '14px'
        }}>

          {/* 上排：品牌 + 狀態晶片 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            {/* 品牌區 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0, boxShadow: '0 0 0 2px rgba(59,130,246,0.4)'
              }}>⚕</div>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 'clamp(14px, 3vw, 17px)', lineHeight: 1.2 }}>
                  西藥供應資訊儀表板
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', letterSpacing: '0.06em' }}>NHI Drug Supply Monitor</span>
                  {data?.last_updated && (
                    <span style={{
                      backgroundColor: '#1e3a5f', color: '#60a5fa',
                      fontSize: '10px', fontWeight: 700, padding: '1px 7px',
                      borderRadius: '99px', letterSpacing: '0.05em'
                    }}>
                      更新 {data.last_updated}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 狀態晶片 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <StatusChip count={processedData.noAlt.length} label="無替代" color="#fee2e2" textColor="#991b1b" dot="#ef4444" />
              <StatusChip count={processedData.withAlt.length} label="有替代" color="#fef3c7" textColor="#92400e" dot="#f59e0b" />
              <StatusChip count={processedData.resolved.length} label="已解除" color="#d1fae5" textColor="#065f46" dot="#10b981" />
            </div>
          </div>

          {/* 下排：搜尋框 */}
          <div style={{
            display: 'flex', alignItems: 'center',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '9px 14px',
            gap: '8px',
            transition: 'border-color 0.2s',
          }}>
            <span style={{ color: '#475569', fontSize: '18px', lineHeight: 1 }}>🔍</span>
            <input
              type="text"
              placeholder="搜尋藥品名稱或許可證字號…"
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                border: 'none', outline: 'none', flex: 1,
                fontSize: '16px', color: '#e2e8f0',
                background: 'transparent', padding: 0,
                '::placeholder': { color: '#475569' }
              } as any}
            />
          </div>
        </div>
      </nav>

      {/* ── 主內容 ── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px 0' }}>

        {/* 分頁切換 */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '24px',
          backgroundColor: '#e2e8f0',
          padding: '4px', borderRadius: '12px',
          width: 'fit-content'
        }}>
          {(['list', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '9px 20px', borderRadius: '9px',
                fontWeight: 700, fontSize: '14px',
                cursor: 'pointer', border: 'none',
                transition: 'all 0.2s',
                backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
                color: activeTab === tab ? '#1e40af' : '#64748b',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                letterSpacing: '0.02em'
              }}
            >
              {tab === 'list' ? '📋 清單列表' : '📊 數據分析'}
            </button>
          ))}
        </div>

        {activeTab === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {!searchTerm && <RecentDashboard items={processedData.all.slice(0, 10)} />}
            <Section title="經評估【無】替代藥品" colorTheme="red" list={processedData.noAlt} />
            <Section title="經評估【有】替代藥品" colorTheme="amber" list={processedData.withAlt} />
            <Section title="藥品已解除短缺" colorTheme="emerald" list={processedData.resolved} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* 指標卡片 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <StatCard label="受影響藥品項數" value={stats.uniqueDrugCount} unit="項" color="blue" icon="💊" />
              <StatCard label="累計通報件數" value={processedData.noAlt.length + processedData.withAlt.length} unit="件" color="amber" icon="⚠️" />
              <StatCard label="已解除短缺件數" value={processedData.resolved.length} unit="件" color="emerald" icon="✅" />
            </div>

            {/* 圖表卡片 */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '24px',
                flexWrap: 'wrap', gap: '12px'
              }}>
                <h2 style={{ fontSize: 'clamp(15px, 3vw, 18px)', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  {timeMode === 'month' ? '每月' : '每年'}缺藥通報與解除對比
                </h2>
                <div style={{
                  display: 'flex', backgroundColor: '#f1f5f9',
                  padding: '4px', borderRadius: '8px', gap: '2px'
                }}>
                  {(['month', 'year'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTimeMode(mode)}
                      style={{
                        padding: '6px 16px', borderRadius: '6px',
                        fontWeight: 700, fontSize: '13px',
                        cursor: 'pointer', border: 'none',
                        backgroundColor: timeMode === mode ? '#ffffff' : 'transparent',
                        color: timeMode === mode ? '#2563eb' : '#64748b',
                        boxShadow: timeMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {mode === 'month' ? '月統計' : '年統計'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 圖表可橫向滑動（手機友善） */}
              <div style={{ overflowX: 'auto', marginLeft: '-8px', marginRight: '-8px' }}>
                <div style={{ minWidth: '500px', height: '380px', paddingLeft: '8px', paddingRight: '8px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '10px', border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          fontSize: '13px', fontWeight: 600
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }}
                        iconType="circle"
                      />
                      <Bar dataKey="無替代(紅)" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="有替代(黃)" stackId="a" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="已解除(綠)" fill="#10b981" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// 子元件
// ----------------------------------------------------------------------

function StatusChip({ count, label, color, textColor, dot }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      backgroundColor: color, borderRadius: '99px',
      padding: '4px 10px 4px 8px',
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      <span style={{ color: textColor, fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
        {count} {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, unit, color, icon }: any) {
  const themes: any = {
    blue: { bg: '#eff6ff', value: '#1d4ed8', border: '#bfdbfe', label: '#3b82f6', iconBg: '#dbeafe' },
    amber: { bg: '#fffbeb', value: '#b45309', border: '#fde68a', label: '#d97706', iconBg: '#fef3c7' },
    emerald: { bg: '#f0fdf4', value: '#065f46', border: '#a7f3d0', label: '#059669', iconBg: '#dcfce7' }
  };
  const t = themes[color];
  return (
    <div style={{
      backgroundColor: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: '16px', padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        width: '48px', height: '48px',
        backgroundColor: t.iconBg, borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px', flexShrink: 0
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: t.label, marginBottom: '4px', letterSpacing: '0.03em' }}>{label}</div>
        <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 900, color: t.value, lineHeight: 1 }}>
          {value.toLocaleString()}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '4px', color: t.label }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ── 最新動態 ──
function RecentDashboard({ items }: any) {
  if (!items.length) return null;
  return (
    <section style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '20px 20px 24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: '#22c55e',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
            display: 'inline-block', flexShrink: 0
          }} />
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>最新公告動態</h2>
        </div>
        <span style={{
          backgroundColor: '#22c55e', color: '#fff',
          fontSize: '10px', fontWeight: 800, padding: '2px 8px',
          borderRadius: '99px', letterSpacing: '0.1em'
        }}>LIVE</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '10px'
      }}>
        {items.map((item: any, i: number) => <RecentCard key={i} item={item} rank={i + 1} />)}
      </div>
    </section>
  );
}

function RecentCard({ item, rank }: any) {
  const [open, setOpen] = useState(false);
  const labels: any = { red: '無替代', amber: '有替代', emerald: '已解除' };
  const palettes: any = {
    red: { bg: '#fff5f5', border: '#fecaca', tag: '#fee2e2', tagText: '#991b1b', tagDot: '#ef4444' },
    amber: { bg: '#fffdf5', border: '#fde68a', tag: '#fef3c7', tagText: '#92400e', tagDot: '#f59e0b' },
    emerald: { bg: '#f0fdf7', border: '#a7f3d0', tag: '#d1fae5', tagText: '#065f46', tagDot: '#10b981' },
  };
  const p = palettes[item._theme];
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        backgroundColor: p.bg, border: `1px solid ${p.border}`,
        borderRadius: '12px', padding: '14px 16px',
        cursor: 'pointer', transition: 'box-shadow 0.2s',
        boxShadow: open ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>#{String(rank).padStart(2, '0')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{item.公告更新時間}</span>
          <span style={{
            backgroundColor: p.tag, color: p.tagText,
            fontSize: '11px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: p.tagDot }} />
            {labels[item._theme]}
          </span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '2px', lineHeight: 1.4 }}>
        {item.中文品名}
      </div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>{item.許可證字號}</div>
      {open && (
        <div style={{
          marginTop: '12px', paddingTop: '12px',
          borderTop: `1px solid ${p.border}`,
          fontSize: '13px', color: '#475569', lineHeight: 1.7,
          whiteSpace: 'pre-line'
        }}>
          {item.供應狀態?.replace(/\\r\\n/g, '\n')}
        </div>
      )}
      <div style={{
        textAlign: 'center', marginTop: '8px',
        color: '#94a3b8', fontSize: '12px',
        transition: 'transform 0.2s',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
      }}>▾</div>
    </div>
  );
}

// ── 分類區塊 ──
function Section({ title, colorTheme, list }: any) {
  const grouped = groupAndSortByYearAndMonth(list);
  if (!list.length) return null;

  const palettes: any = {
    red: { bar: '#ef4444', header: '#fff5f5', border: '#fecaca', count: '#dc2626' },
    amber: { bar: '#f59e0b', header: '#fffdf5', border: '#fde68a', count: '#d97706' },
    emerald: { bar: '#10b981', header: '#f0fdf7', border: '#a7f3d0', count: '#059669' },
  };
  const p = palettes[colorTheme];

  return (
    <section style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: `1px solid ${p.border}`,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      {/* 區塊標頭 */}
      <div style={{
        backgroundColor: p.header,
        borderBottom: `1px solid ${p.border}`,
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <div style={{ width: '4px', height: '24px', backgroundColor: p.bar, borderRadius: '2px', flexShrink: 0 }} />
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0, flex: 1 }}>{title}</h2>
        <span style={{
          backgroundColor: p.bar, color: '#fff',
          fontSize: '12px', fontWeight: 700,
          padding: '3px 10px', borderRadius: '99px'
        }}>{list.length} 筆</span>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {Object.keys(grouped).map(y => (
          <YearGroup key={y} yearKey={y} months={grouped[y]} colorTheme={colorTheme} />
        ))}
      </div>
    </section>
  );
}

function YearGroup({ yearKey, months, colorTheme }: any) {
  const [open, setOpen] = useState(true);
  const total = Object.keys(months).reduce((sum, m) => sum + months[m].length, 0);
  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '8px 12px', borderRadius: '8px',
          backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
          cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: '#475569'
        }}
      >
        <span>{yearKey}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          累計 {total} 筆
          <span style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block'
          }}>▾</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.keys(months).map(m => (
            <div key={m}>
              <div style={{
                fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                padding: '4px 4px 8px', letterSpacing: '0.06em',
                borderBottom: '1px dashed #e2e8f0', marginBottom: '8px'
              }}>
                {m}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {months[m].map((item: any, i: number) => (
                  <DrugCard key={i} item={item} theme={colorTheme} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrugCard({ item, theme }: any) {
  const [open, setOpen] = useState(false);
  const rec = extractRecoveryTime(item.供應狀態);

  const tagStyles: any = {
    red: { bg: '#fee2e2', text: '#991b1b' },
    amber: { bg: '#fef3c7', text: '#92400e' },
    emerald: { bg: '#d1fae5', text: '#065f46' },
  };
  const t = tagStyles[theme];

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
      boxShadow: open ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
    }}>
      {/* 主列：點擊展開 */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '12px 14px', gap: '10px',
          cursor: 'pointer', backgroundColor: '#fff',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '14px', color: '#1e293b',
            marginBottom: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {item.中文品名}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{item.許可證字號}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {rec ? (
            <span style={{
              backgroundColor: t.bg, color: t.text,
              fontSize: '11px', fontWeight: 600,
              padding: '3px 8px', borderRadius: '6px',
              maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              ⏳ {rec}
            </span>
          ) : (
            <span style={{
              backgroundColor: '#f1f5f9', color: '#64748b',
              fontSize: '11px', fontWeight: 600,
              padding: '3px 8px', borderRadius: '6px'
            }}>
              詳見說明
            </span>
          )}
          <span style={{
            color: '#94a3b8', fontSize: '14px',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block'
          }}>▾</span>
        </div>
      </div>

      {/* 展開內容 */}
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '14px 16px' }}>
          {/* macOS 視窗裝飾 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
              <span key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c, display: 'inline-block' }} />
            ))}
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px', fontWeight: 600 }}>供應狀態說明</span>
          </div>
          <div style={{
            fontSize: '13px', color: '#334155', lineHeight: 1.8,
            whiteSpace: 'pre-line', fontFamily: '"Noto Sans TC", monospace'
          }}>
            {item.供應狀態?.replace(/\\r\\n/g, '\n')}
          </div>
        </div>
      )}
    </div>
  );
}