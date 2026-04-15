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

    // 1. 藥品項數統計 (利用許可證字號去重複，取代無效的廠商欄位)
    const uniqueDrugs = new Set(
      allData.map(item => item.許可證字號 || '未知字號')
    );

    // 2. 初始化統計容器
    const monthlyMap: Record<string, any> = {};
    const yearlyMap: Record<string, any> = {};

    allData.forEach(item => {
      const dateStr = item.公告更新時間 || '';
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        const year = parts[0];
        const month = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        const theme = item._theme;

        // 月統計累積
        if (!monthlyMap[month]) monthlyMap[month] = { label: month, red: 0, amber: 0, emerald: 0 };
        if (theme === 'red') monthlyMap[month].red++;
        else if (theme === 'amber') monthlyMap[month].amber++;
        else if (theme === 'emerald') monthlyMap[month].emerald++;

        // 年統計累積
        if (!yearlyMap[year]) yearlyMap[year] = { label: `${year}年`, red: 0, amber: 0, emerald: 0 };
        if (theme === 'red') yearlyMap[year].red++;
        else if (theme === 'amber') yearlyMap[year].amber++;
        else if (theme === 'emerald') yearlyMap[year].emerald++;
      }
    });

    // 格式化為 Recharts 格式
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
  
  // 狀態管理
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [timeMode, setTimeMode] = useState<'month' | 'year'>('month');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/supply_status_latest.json`)
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 資料前處理與過濾
  const processedData = useMemo(() => {
    const filter = (list: DrugRecord[] = [], theme: Theme) => 
      list.filter(i => 
        (i.中文品名 || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.許可證字號 || '').includes(searchTerm)
      ).map(i => ({ ...i, _theme: theme }));

    const noAlt = filter(data?.datasets['54505_no_alternative'], 'red');
    const withAlt = filter(data?.datasets['54504_with_alternative'], 'amber');
    const resolved = filter(data?.datasets['54506_resolved'], 'emerald');
    
    return { noAlt, withAlt, resolved, all: [...noAlt, ...withAlt, ...resolved] };
  }, [data, searchTerm]);

  const stats = useCompositeStats(processedData.all);
  const chartData = timeMode === 'month' ? stats.monthlyChart : stats.yearlyChart;

  if (loading) return <div className="loading"><div className="loading__spinner" />系統讀取中...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '48px' }}>
      
      {/* 導覽列 (保留您原有的 index.css 樣式) */}
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__brand">
            <div className="nav__icon">⚕</div>
            <div>
              <div className="nav__title">西藥供應資訊儀表板</div>
              <div className="nav__subtitle">NHI Drug Supply Monitor</div>
              <div className="nav__meta">UPDATED {data?.last_updated}</div>
            </div>
          </div>
          <div className="nav__stats">
            <div className="stat-chip stat-chip--red">{processedData.noAlt.length} 無替代</div>
            <div className="stat-chip stat-chip--amber">{processedData.withAlt.length} 有替代</div>
            <div className="stat-chip stat-chip--emerald">{processedData.resolved.length} 已解除</div>
          </div>
          <div className="search-wrap">
            <span className="search-wrap__icon">⌕</span>
            <input type="text" className="search-input" placeholder="搜尋藥品名稱或字號..." onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1152px', margin: '32px auto 0', padding: '0 24px' }}>
        
        {/* 分頁切換按鈕 (Inline Style 修正版) */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <button 
            onClick={() => setActiveTab('list')} 
            style={{ 
              padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              backgroundColor: activeTab === 'list' ? '#2563eb' : '#e2e8f0', color: activeTab === 'list' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'list' ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            清單列表
          </button>
          <button 
            onClick={() => setActiveTab('stats')} 
            style={{ 
              padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              backgroundColor: activeTab === 'stats' ? '#2563eb' : '#e2e8f0', color: activeTab === 'stats' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'stats' ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            數據分析
          </button>
        </div>

        {activeTab === 'list' ? (
          /* 清單列表模式 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {!searchTerm && <RecentDashboard items={processedData.all.slice(0, 10)} />}
            <Section title="經評估【無】替代藥品" colorTheme="red" list={processedData.noAlt} />
            <Section title="經評估【有】替代藥品" colorTheme="amber" list={processedData.withAlt} />
            <Section title="藥品已解除短缺" colorTheme="emerald" list={processedData.resolved} />
          </div>
        ) : (
          /* 數據分析模式 (Inline Style 修正版) */
          <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
            
            {/* 分析標題與切換 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📊 供應趨勢與統計分析</h2>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button 
                  onClick={() => setTimeMode('month')} 
                  style={{ padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', border: 'none', backgroundColor: timeMode === 'month' ? '#ffffff' : 'transparent', color: timeMode === 'month' ? '#2563eb' : '#64748b', boxShadow: timeMode === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                >月統計</button>
                <button 
                  onClick={() => setTimeMode('year')} 
                  style={{ padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', border: 'none', backgroundColor: timeMode === 'year' ? '#ffffff' : 'transparent', color: timeMode === 'year' ? '#2563eb' : '#64748b', boxShadow: timeMode === 'year' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                >年統計</button>
              </div>
            </div>

            {/* 指標卡片區 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              <StatCard label="受影響藥品項數" value={stats.uniqueDrugCount} unit="項" color="blue" />
              <StatCard label="累計通報件數" value={processedData.noAlt.length + processedData.withAlt.length} unit="件" color="amber" />
              <StatCard label="已解除短缺件數" value={processedData.resolved.length} unit="件" color="emerald" />
            </div>

            {/* Recharts 圖表區 */}
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#475569', marginBottom: '24px' }}>
              {timeMode === 'month' ? '每月' : '每年'}缺藥通報與解除對比
            </h3>
            <div style={{ height: '400px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={{stroke: '#cbd5e1'}} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={{stroke: '#cbd5e1'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                  <Legend wrapperStyle={{paddingTop: '20px'}} />
                  
                  {/* 紅黃堆疊 */}
                  <Bar dataKey="無替代(紅)" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={40} />
                  <Bar dataKey="有替代(黃)" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
                  {/* 綠色獨立 */}
                  <Bar dataKey="已解除(綠)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
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
    <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: t.label, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: t.text }}>{value} <span style={{ fontSize: '1.125rem', fontWeight: 'normal' }}>{unit}</span></div>
    </div>
  );
}

// 以下保留您原本的清單元件 (完全未動)
function RecentDashboard({ items }: any) {
  if (!items.length) return null;
  return (
    <section className="recent">
      <div className="recent__header">
        <div className="recent__header-left"><span className="recent__pulse" /><h2 className="recent__title">最新公告動態</h2></div>
        <span className="recent__badge">LIVE</span>
      </div>
      <div className="recent__grid">
        {items.map((item: any, i: number) => <RecentCard key={i} item={item} rank={i + 1} />)}
      </div>
    </section>
  );
}

function RecentCard({ item, rank }: any) {
  const [open, setOpen] = useState(false);
  const labels: any = { red: '無替代', amber: '有替代', emerald: '已解除' };
  return (
    <div className={`rc rc--${item._theme} ${open ? 'rc--expanded' : ''}`} onClick={() => setOpen(!open)}>
      <div className="rc__top"><span className="rc__rank">#{rank.toString().padStart(2, '0')}</span><span className="rc__date">{item.公告更新時間}</span><span className={`rc__tag rc__tag--${item._theme}`}>{labels[item._theme]}</span></div>
      <div className="rc__name">{item.中文品名}</div>
      <div className="rc__code">{item.許可證字號}</div>
      {open && <div className="rc__detail">{item.供應狀態?.replace(/\\r\\n/g, '\n')}</div>}
      <div className={`rc__chevron ${open ? 'rc__chevron--open' : ''}`}>▼</div>
    </div>
  );
}

function Section({ title, colorTheme, list }: any) {
  const grouped = groupAndSortByYearAndMonth(list);
  if (!list.length) return null;
  return (
    <section className={`section section--${colorTheme}`}>
      <div className="section__header"><div className="section__bar" /><h2 className="section__title">{title}</h2><span className="section__count">{list.length} 筆</span></div>
      <div className="section__body">
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
    <div className="year-group">
      <button className="year-group__toggle" onClick={() => setOpen(!open)}>
        <span className="year-group__label">{yearKey}</span>
        <span className="year-group__meta">年度累計 {total} 筆 <span className={`year-group__chevron ${open ? 'year-group__chevron--open' : ''}`}>▼</span></span>
      </button>
      {open && <div className="year-group__content">
        {Object.keys(months).map(m => (
          <div key={m} className="month-group">
            <div className="month-group__label">{m}</div>
            <div className="month-group__list">
              {months[m].map((item: any, i: number) => <DrugCard key={i} item={item} theme={colorTheme} />)}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

function DrugCard({ item, theme }: any) {
  const [open, setOpen] = useState(false);
  const rec = extractRecoveryTime(item.供應狀態);
  return (
    <div className="drug-card">
      <div className="drug-card__row" onClick={() => setOpen(!open)}>
        <div className="drug-card__info"><div className="drug-card__name">{item.中文品名}</div><div className="drug-card__code">{item.許可證字號}</div></div>
        <div className="drug-card__right">
          {rec ? <span className={`recovery-tag recovery-tag--${theme}`}>⏳ {rec}</span> : <span className="recovery-tag recovery-tag--default">詳見說明</span>}
          <span className={`drug-card__chevron ${open ? 'drug-card__chevron--open' : ''}`}>▼</span>
        </div>
      </div>
      {open && <div className="drug-detail">
         <div className="drug-detail__inner">
            <div className="drug-detail__titlebar">
              <span className="drug-detail__dot drug-detail__dot--red" />
              <span className="drug-detail__dot drug-detail__dot--amber" />
              <span className="drug-detail__dot drug-detail__dot--green" />
              <span className="drug-detail__label">供應狀態說明</span>
            </div>
            <div className="drug-detail__body">{item.供應狀態?.replace(/\\r\\n/g, '\n')}</div>
         </div>
      </div>}
    </div>
  );
}