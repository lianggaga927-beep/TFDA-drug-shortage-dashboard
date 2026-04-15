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
  _days?: number;     // 新增：缺藥持續天數
  _altText?: string | null; // 新增：替代藥品建議
}

interface SupplyData {
  last_updated: string;
  datasets: { [key: string]: DrugRecord[] };
}

type Theme = 'red' | 'amber' | 'emerald';

// ----------------------------------------------------------------------
// 工具函數：天數計算與替代品萃取
// ----------------------------------------------------------------------
const getDaysDiff = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length < 2) return 0;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1));
  const diff = new Date().getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const extractAlternative = (text: string) => {
  if (!text) return null;
  // 利用 Regex 捕捉常見的替代品描述句型
  const match = text.match(/(?:建議替代|替代藥品|替代品項|改用|可由)[：:\s]*([^。，\n;；]+)/);
  return match ? match[1].trim() : null;
};

const extractRecoveryTime = (text: string) => {
  if (!text) return null;
  const match = text.replace(/\\r\\n/g, '').match(/(無法預計[^\u3002，,]*|預計[^\u3002，]*(恢復|供應)[^\u3002，]*)/);
  return match ? match[0] : null;
};

// ----------------------------------------------------------------------
// 統計 Hook
// ----------------------------------------------------------------------
const useCompositeStats = (allData: DrugRecord[]) => {
  return useMemo(() => {
    if (!allData.length) return { uniqueDrugCount: 0, monthlyChart: [], yearlyChart: [] };
    const uniqueDrugs = new Set(allData.map(item => item.許可證字號 || '未知字號'));
    const monthlyMap: Record<string, any> = {};
    const yearlyMap: Record<string, any> = {};

    allData.forEach(item => {
      const parts = (item.公告更新時間 || '').split('/');
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
        name: d.label, '無替代(紅)': d.red, '有替代(黃)': d.amber, '已解除(綠)': d.emerald
      }));

    return { uniqueDrugCount: uniqueDrugs.size, monthlyChart: format(monthlyMap), yearlyChart: format(yearlyMap) };
  }, [allData]);
};

// ----------------------------------------------------------------------
// 主元件
// ----------------------------------------------------------------------
export default function App() {
  const [data, setData] = useState<SupplyData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 介面狀態
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [timeMode, setTimeMode] = useState<'month' | 'year'>('month');
  
  // 搜尋與多條件篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'newest'|'longest'|'name'>('newest');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/supply_status_latest.json`)
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 核心資料管線：整理 -> 過濾 -> 排序
  const processedData = useMemo(() => {
    // 1. 扁平化並注入計算欄位 (_theme, _days, _altText)
    let all = [
      ...(data?.datasets['54505_no_alternative'] || []).map(i => ({ ...i, _theme: 'red' as Theme })),
      ...(data?.datasets['54504_with_alternative'] || []).map(i => ({ ...i, _theme: 'amber' as Theme })),
      ...(data?.datasets['54506_resolved'] || []).map(i => ({ ...i, _theme: 'emerald' as Theme }))
    ].map(item => ({
      ...item,
      _days: getDaysDiff(item.公告更新時間),
      _altText: extractAlternative(item.供應狀態)
    }));

    // 取得所有可用年份(供下拉選單使用)
    const availableYears = Array.from(new Set(all.map(i => (i.公告更新時間||'').split('/')[0]))).filter(Boolean).sort().reverse();

    // 2. 多條件篩選 (文字 + 狀態 + 年份)
    all = all.filter(i => {
      const matchSearch = (i.中文品名 || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.許可證字號 || '').includes(searchTerm);
      const matchStatus = filterStatus === 'all' ? true : i._theme === filterStatus;
      const matchYear = filterYear === 'all' ? true : (i.公告更新時間||'').startsWith(filterYear);
      return matchSearch && matchStatus && matchYear;
    });

    // 3. 排序邏輯
    all.sort((a, b) => {
      if (sortMode === 'newest') return new Date(b.公告更新時間).getTime() - new Date(a.公告更新時間).getTime();
      if (sortMode === 'longest') return (b._days || 0) - (a._days || 0);
      if (sortMode === 'name') return (a.中文品名 || '').localeCompare(b.中文品名 || '');
      return 0;
    });

    return { 
      all,
      availableYears,
      noAlt: all.filter(i => i._theme === 'red'),
      withAlt: all.filter(i => i._theme === 'amber'),
      resolved: all.filter(i => i._theme === 'emerald')
    };
  }, [data, searchTerm, filterStatus, filterYear, sortMode]);

  const stats = useCompositeStats(processedData.all);
  const chartData = timeMode === 'month' ? stats.monthlyChart : stats.yearlyChart;

  if (loading) return <div className="loading"><div className="loading__spinner" />系統讀取中...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '48px', fontFamily: '"Noto Sans TC", sans-serif' }}>
      
      {/* 導覽列 */}
      <nav style={{ backgroundColor: '#0f172a', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'white', boxShadow: '0 0 0 2px rgba(59,130,246,0.4)' }}>⚕</div>
            <div>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>西藥供應資訊儀表板</div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>NHI Drug Supply Monitor</div>
            </div>
          </div>

          {/* 搜尋框 */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '8px 16px', width: '100%', maxWidth: '350px' }}>
            <span style={{ color: '#475569', fontSize: '16px', marginRight: '8px' }}>🔍</span>
            <input 
              type="text" placeholder="搜尋藥品名稱或許可證字號…" 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '15px', color: '#e2e8f0', background: 'transparent' }}
            />
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1152px', margin: '24px auto 0', padding: '0 16px' }}>
        
        {/* 分頁切換 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
          <button onClick={() => setActiveTab('list')} style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', border: 'none', backgroundColor: activeTab === 'list' ? '#ffffff' : 'transparent', color: activeTab === 'list' ? '#1d4ed8' : '#64748b', boxShadow: activeTab === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>📋 清單列表</button>
          <button onClick={() => setActiveTab('stats')} style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', border: 'none', backgroundColor: activeTab === 'stats' ? '#ffffff' : 'transparent', color: activeTab === 'stats' ? '#1d4ed8' : '#64748b', boxShadow: activeTab === 'stats' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>📊 數據分析</button>
        </div>

        {activeTab === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 👇 新增：多條件控制台 (Control Panel) 👇 */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>⚙️</span> 篩選與排序
              </div>
              
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', outline: 'none', cursor: 'pointer' }}>
                <option value="all">所有狀態 ({processedData.all.length})</option>
                <option value="red">無替代 ({processedData.noAlt.length})</option>
                <option value="amber">有替代 ({processedData.withAlt.length})</option>
                <option value="emerald">已解除 ({processedData.resolved.length})</option>
              </select>

              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', outline: 'none', cursor: 'pointer' }}>
                <option value="all">所有年份</option>
                {processedData.availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>

              <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

              <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', outline: 'none', cursor: 'pointer' }}>
                <option value="newest">排序：最新公告優先</option>
                <option value="longest">排序：缺藥天數最長優先</option>
                <option value="name">排序：藥品名稱 A→Z</option>
              </select>
            </div>

            {/* 清單渲染 (依賴篩選結果) */}
            {(filterStatus === 'all' || filterStatus === 'red') && <Section title="經評估【無】替代藥品" colorTheme="red" list={processedData.noAlt} />}
            {(filterStatus === 'all' || filterStatus === 'amber') && <Section title="經評估【有】替代藥品" colorTheme="amber" list={processedData.withAlt} />}
            {(filterStatus === 'all' || filterStatus === 'emerald') && <Section title="藥品已解除短缺" colorTheme="emerald" list={processedData.resolved} />}
            
            {processedData.all.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                找不到符合篩選條件的藥品
              </div>
            )}
          </div>
        ) : (
          /* 數據分析模式 (保留之前完整的實作) */
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>📊 供應趨勢與統計分析</h2>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button onClick={() => setTimeMode('month')} style={{ padding: '6px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', border: 'none', backgroundColor: timeMode === 'month' ? '#ffffff' : 'transparent', color: timeMode === 'month' ? '#2563eb' : '#64748b', boxShadow: timeMode === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>月統計</button>
                <button onClick={() => setTimeMode('year')} style={{ padding: '6px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', border: 'none', backgroundColor: timeMode === 'year' ? '#ffffff' : 'transparent', color: timeMode === 'year' ? '#2563eb' : '#64748b', boxShadow: timeMode === 'year' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>年統計</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <StatCard label="受影響藥品項數" value={stats.uniqueDrugCount} unit="項" color="blue" />
              <StatCard label="累計通報件數" value={processedData.noAlt.length + processedData.withAlt.length} unit="件" color="amber" />
              <StatCard label="已解除短缺件數" value={processedData.resolved.length} unit="件" color="emerald" />
            </div>

            <div style={{ height: '400px', width: '100%', overflowX: 'auto' }}>
              <div style={{ minWidth: '500px', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={{stroke: '#cbd5e1'}} tickLine={false} />
                    <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px'}} />
                    <Legend wrapperStyle={{paddingTop: '20px', fontSize: '13px'}} iconType="circle" />
                    <Bar dataKey="無替代(紅)" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={35} />
                    <Bar dataKey="有替代(黃)" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={35} />
                    <Bar dataKey="已解除(綠)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// 子元件區
// ----------------------------------------------------------------------
function StatCard({ label, value, unit, color }: any) {
  const themes: any = { 
    blue: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: '#3b82f6' }, 
    amber: { bg: '#fef3c7', text: '#92400e', border: '#fde68a', label: '#d97706' }, 
    emerald: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: '#059669' } 
  };
  const t = themes[color];
  return (
    <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: t.label }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 900, color: t.text, lineHeight: 1 }}>{value} <span style={{ fontSize: '14px', fontWeight: 500 }}>{unit}</span></div>
    </div>
  );
}

function Section({ title, colorTheme, list }: any) {
  if (!list.length) return null;
  const palettes: any = {
    red: { bar: '#ef4444', header: '#fff5f5', border: '#fecaca', count: '#dc2626' },
    amber: { bar: '#f59e0b', header: '#fffdf5', border: '#fde68a', count: '#d97706' },
    emerald: { bar: '#10b981', header: '#f0fdf7', border: '#a7f3d0', count: '#059669' },
  };
  const p = palettes[colorTheme];

  // 不再進行年月分組，直接渲染扁平列表，以支援全域排序！
  return (
    <section style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: `1px solid ${p.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ backgroundColor: p.header, borderBottom: `1px solid ${p.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '4px', height: '24px', backgroundColor: p.bar, borderRadius: '2px', flexShrink: 0 }} />
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0, flex: 1 }}>{title}</h2>
        <span style={{ backgroundColor: p.bar, color: '#fff', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px' }}>{list.length} 筆</span>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {list.map((item: any, i: number) => <DrugCard key={i} item={item} theme={colorTheme} />)}
      </div>
    </section>
  );
}

function DrugCard({ item, theme }: any) {
  const [open, setOpen] = useState(false);
  const rec = extractRecoveryTime(item.供應狀態);
  
  const tagStyles: any = {
    red: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    amber: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    emerald: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  };
  const t = tagStyles[theme];

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', transition: 'box-shadow 0.2s', boxShadow: open ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.02)' }}>
      
      {/* 卡片主體 (可點擊展開) */}
      <div onClick={() => setOpen(!open)} style={{ padding: '16px', cursor: 'pointer', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* 第一排：日期 + 天數 + 替代品 Tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>{item.公告更新時間}</span>
            {/* 👇 新增：缺藥天數 Badge (綠色解除不顯示缺藥天數) 👇 */}
            {theme !== 'emerald' && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                🔥 缺藥 {item._days} 天
              </span>
            )}
          </div>
          <span style={{ color: '#94a3b8', fontSize: '14px', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>

        {/* 第二排：藥品名稱與字號 */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '4px', lineHeight: 1.4 }}>{item.中文品名}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{item.許可證字號}</div>
        </div>

        {/* 👇 新增：替代建議 / 恢復時間 (不需展開即可預覽) 👇 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
          {item._altText && theme !== 'emerald' && (
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '4px 8px', borderRadius: '6px', display: 'flex', gap: '4px', maxWidth: '100%' }}>
              <span>💡</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>替代：{item._altText}</span>
            </div>
          )}
          {rec && (
            <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, backgroundColor: t.bg, padding: '4px 8px', borderRadius: '6px' }}>
              ⏳ {rec}
            </div>
          )}
        </div>

      </div>

      {/* 展開之完整內文 */}
      {open && (
        <div style={{ borderTop: '1px dashed #cbd5e1', backgroundColor: '#f8fafc', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 700 }}>📄 官方供應狀態說明</div>
          <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {item.供應狀態?.replace(/\\r\\n/g, '\n')}
          </div>
        </div>
      )}
    </div>
  );
}