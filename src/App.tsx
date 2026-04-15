import { useEffect, useState, useMemo } from 'react'
import './index.css'
 
interface DrugRecord {
  編號: string;
  中文品名: string;
  許可證字號: string;
  供應狀態: string;
  公告更新時間: string;
  藥商名稱?: string;
}
 
interface SupplyData {
  last_updated: string;
  datasets: { [key: string]: DrugRecord[] };
}
 
type Theme = 'red' | 'amber' | 'emerald';
 
// ----------------------------------------------------------------------
// 核心邏輯 & 統計 Hook (加入防禦性編程)
// ----------------------------------------------------------------------
 
const groupAndSortByYearAndMonth = (list: DrugRecord[]) => {
  const sorted = [...list].sort(
    (a, b) => new Date(b?.公告更新時間 || 0).getTime() - new Date(a?.公告更新時間 || 0).getTime()
  );
  return sorted.reduce((acc, curr) => {
    // 防護：確保是字串再 split
    const dateStr = curr?.公告更新時間 || '';
    const parts = dateStr.split('/');
    const yearKey  = parts[0] ? `${parts[0]}年` : '年份未知';
    const monthKey = parts[1] ? `${parts[1]}月` : '月份未知';
    
    if (!acc[yearKey]) acc[yearKey] = {};
    if (!acc[yearKey][monthKey]) acc[yearKey][monthKey] = [];
    acc[yearKey][monthKey].push(curr);
    return acc;
  }, {} as Record<string, Record<string, DrugRecord[]>>);
};
 
const extractRecoveryTime = (statusText: string): string | null => {
  if (!statusText) return null;
  // 防護：強制轉為字串
  const cleanText = String(statusText).replace(/\\r\\n/g, '');
  const match = cleanText.match(/(無法預計[^\u3002，,]*|預計[^\u3002，,]*(?:恢復|供應)[^\u3002，,]*)/);
  return match ? match[0] : null;
};
 
const getRecentItems = (
  datasets: SupplyData['datasets'],
  n = 10
): Array<DrugRecord & { _theme: Theme }> => {
  const tagged: Array<DrugRecord & { _theme: Theme }> = [
    ...(datasets['54505_no_alternative'] || []).map(r => ({ ...r, _theme: 'red'     as Theme })),
    ...(datasets['54504_with_alternative'] || []).map(r => ({ ...r, _theme: 'amber'   as Theme })),
    ...(datasets['54506_resolved'] || []).map(r => ({ ...r, _theme: 'emerald' as Theme })),
  ];
  return tagged
    .sort((a, b) => new Date(b?.公告更新時間 || 0).getTime() - new Date(a?.公告更新時間 || 0).getTime())
    .slice(0, n);
};

const useStats = (data: SupplyData | null) => {
  return useMemo(() => {
    if (!data || !data.datasets) return { companyCount: 0, totalCount: 0, timeline: {} as Record<string, number> };

    const allItems = [
      ...(data.datasets['54504_with_alternative'] || []),
      ...(data.datasets['54505_no_alternative'] || []),
      ...(data.datasets['54506_resolved'] || [])
    ];

    if (allItems.length === 0) return { companyCount: 0, totalCount: 0, timeline: {} };

    const companies = new Set(allItems.map(item => item?.藥商名稱 || '未知廠商'));

    const timeline = allItems.reduce((acc, item) => {
      const dateStr = item?.公告更新時間 || '';
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        const month = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const sortedTimeline = Object.keys(timeline).sort().reverse().reduce((obj, key) => {
      obj[key] = timeline[key];
      return obj;
    }, {} as Record<string, number>);

    return {
      companyCount: companies.size,
      totalCount: allItems.length,
      timeline: sortedTimeline
    };
  }, [data]);
};

// ----------------------------------------------------------------------
// 主元件
// ----------------------------------------------------------------------
 
export default function App() {
  const [data, setData]             = useState<SupplyData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'list' | 'stats'>('list');

  // 👇 關鍵修正 1：將統計 Hook 移到 loading 判斷之前
  const statsResult = useStats(data);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/supply_status_latest.json`)
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 👇 關鍵修正 2：資料過濾與最近動態也要移到 loading 之前，
  // 或者是確保它們在 loading 時不會執行出錯
  const filterList = (list: DrugRecord[]) =>
    list.filter(
      item =>
        (item?.中文品名 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.許可證字號 || '').includes(searchTerm)
    );

  const noAlt    = filterList(data?.datasets?.['54505_no_alternative'] || []);
  const withAlt  = filterList(data?.datasets?.['54504_with_alternative'] || []);
  const resolved = filterList(data?.datasets?.['54506_resolved'] || []);
  
  const recentItems = useMemo(() => {
    if (!data) return [];
    return getRecentItems(data.datasets);
  }, [data]);

  // ---------------------------------------------------------
  // 👆 以上所有的 Hook 呼叫都結束了，現在才可以進行 loading 判斷
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
        系統讀取中...
      </div>
    );
  }

  // 下面接 return ( <> ... </> );
 
  return (
    <>
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__brand">
            <div className="nav__icon">⚕</div>
            <div>
              <div className="nav__title">西藥供應資訊儀表板</div>
              <div className="nav__subtitle">NHI Drug Supply Monitor</div>
              {data?.last_updated && (
                <div className="nav__meta">UPDATED {data.last_updated}</div>
              )}
            </div>
          </div>
 
          <div className="nav__stats">
            <div className="stat-chip stat-chip--red">
              <span className="stat-chip__dot" />{noAlt.length} 無替代
            </div>
            <div className="stat-chip stat-chip--amber">
              <span className="stat-chip__dot" />{withAlt.length} 有替代
            </div>
            <div className="stat-chip stat-chip--emerald">
              <span className="stat-chip__dot" />{resolved.length} 已解除
            </div>
          </div>
 
          <div className="search-wrap">
            <span className="search-wrap__icon">⌕</span>
            <input
              type="text"
              className="search-input"
              placeholder="搜尋藥品名稱或許可證字號..."
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </nav>
 
      <main className="main" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button 
            onClick={() => setActiveTab('list')}
            style={{
              padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
              background: activeTab === 'list' ? '#3B82F6' : '#E2E8F0',
              color: activeTab === 'list' ? '#FFFFFF' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            清單列表
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
              background: activeTab === 'stats' ? '#3B82F6' : '#E2E8F0',
              color: activeTab === 'stats' ? '#FFFFFF' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            數據分析
          </button>
        </div>

        {activeTab === 'list' ? (
          <>
            {!searchTerm && <RecentDashboard items={recentItems} />}
            <Section title="經評估【無】替代藥品" colorTheme="red"     list={noAlt}    />
            <Section title="經評估【有】替代藥品" colorTheme="amber"   list={withAlt}  />
            <Section title="藥品已解除短缺"       colorTheme="emerald" list={resolved} />
          </>
        ) : (
          <section className="section" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
              📊 供應統計摘要
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#2563eb', fontSize: '0.9rem', marginBottom: '4px' }}>受影響廠商數</div>
                <div style={{ color: '#1e40af', fontSize: '2rem', fontWeight: 'bold' }}>{statsResult.companyCount} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>家</span></div>
              </div>
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#d97706', fontSize: '0.9rem', marginBottom: '4px' }}>累計通報件數</div>
                <div style={{ color: '#92400e', fontSize: '2rem', fontWeight: 'bold' }}>{statsResult.totalCount} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span></div>
              </div>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#059669', fontSize: '0.9rem', marginBottom: '4px' }}>已解除件數</div>
                <div style={{ color: '#065f46', fontSize: '2rem', fontWeight: 'bold' }}>{resolved.length} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span></div>
              </div>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#475569', marginBottom: '16px' }}>每月通報趨勢 (年月)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>月份</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>通報次數</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsResult.timeline).map(([month, count]) => (
                    <tr key={month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#334155' }}>{month}</td>
                      <td style={{ padding: '12px', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            background: '#93c5fd', 
                            height: '8px', 
                            borderRadius: '4px', 
                            width: `${(count as number) * 8}px`, 
                            minWidth: '4px',
                            maxWidth: '300px'
                          }} />
                          <span style={{ fontSize: '0.9rem' }}>{count as number} 次</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
 
// ----------------------------------------------------------------------
// 子元件區
// ----------------------------------------------------------------------
 
const THEME_LABEL: Record<Theme, string> = {
  red:     '無替代',
  amber:   '有替代',
  emerald: '已解除',
};
 
function RecentDashboard({ items }: { items: Array<DrugRecord & { _theme: Theme }> }) {
  if (items.length === 0) return null;
  return (
    <section className="recent">
      <div className="recent__header">
        <div className="recent__header-left">
          <span className="recent__pulse" />
          <h2 className="recent__title">最新公告動態</h2>
          <span className="recent__subtitle">近 10 筆</span>
        </div>
        <span className="recent__badge">LIVE</span>
      </div>
      <div className="recent__grid">
        {items.map((item, idx) => (
          <RecentCard key={idx} item={item} rank={idx + 1} />
        ))}
      </div>
    </section>
  );
}
 
function RecentCard({ item, rank }: { item: DrugRecord & { _theme: Theme }; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const recoveryTag = extractRecoveryTime(item?.供應狀態 || '');
  const theme = item._theme;
 
  return (
    <div
      className={`rc rc--${theme}${expanded ? ' rc--expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="rc__top">
        <span className="rc__rank">#{rank.toString().padStart(2, '0')}</span>
        <span className="rc__date">{item?.公告更新時間 || '未知日期'}</span>
        <span className={`rc__tag rc__tag--${theme}`}>{THEME_LABEL[theme]}</span>
      </div>
      <div className="rc__name">{item?.中文品名 || '無品名資料'}</div>
      <div className="rc__code">{item?.許可證字號 || '無字號資料'}</div>
      {recoveryTag && <div className="rc__recovery">⏳ {recoveryTag}</div>}
      {expanded && (
        <div className="rc__detail">
          {String(item?.供應狀態 || '無狀態說明').replace(/\\r\\n/g, '\n')}
        </div>
      )}
      <div className={`rc__chevron${expanded ? ' rc__chevron--open' : ''}`}>▼</div>
    </div>
  );
}
 
const SECTION_ICONS: Record<Theme, string> = {
  red:     '⚠',
  amber:   '↻',
  emerald: '✓',
};
 
function Section({ title, colorTheme, list }: {
  title: string;
  colorTheme: Theme;
  list: DrugRecord[];
}) {
  const grouped  = groupAndSortByYearAndMonth(list);
  const yearKeys = Object.keys(grouped);
  if (list.length === 0) return null;
 
  return (
    <section className={`section section--${colorTheme}`}>
      <div className="section__header">
        <div className="section__bar" />
        <h2 className="section__title">{SECTION_ICONS[colorTheme]}&nbsp; {title}</h2>
        <div className="section__divider" />
        <span className="section__count">{list.length} 筆</span>
      </div>
      <div className="section__body">
        {yearKeys.map(yearKey => (
          <YearGroup key={yearKey} yearKey={yearKey} months={grouped[yearKey]} colorTheme={colorTheme} />
        ))}
      </div>
    </section>
  );
}
 
function YearGroup({ yearKey, months, colorTheme }: {
  yearKey: string;
  months: Record<string, DrugRecord[]>;
  colorTheme: Theme;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const monthKeys   = Object.keys(months);
  const totalInYear = monthKeys.reduce((sum, m) => sum + months[m].length, 0);
 
  return (
    <div className="year-group">
      <button className="year-group__toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="year-group__label">{yearKey}</span>
        <span className="year-group__meta">
          年度累計 {totalInYear} 筆
          <span className={`year-group__chevron${isOpen ? ' year-group__chevron--open' : ''}`}>▼</span>
        </span>
      </button>
      {isOpen && (
        <div className="year-group__content">
          {monthKeys.map(monthKey => (
            <MonthGroup key={monthKey} monthKey={monthKey} items={months[monthKey]} colorTheme={colorTheme} />
          ))}
        </div>
      )}
    </div>
  );
}
 
function MonthGroup({ monthKey, items, colorTheme }: {
  monthKey: string;
  items: DrugRecord[];
  colorTheme: Theme;
}) {
  const [isOpen, setIsOpen] = useState(true);
 
  return (
    <div className="month-group">
      <button className="month-group__toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="month-group__label">{monthKey}</span>
        <span className={`month-group__chevron${isOpen ? ' month-group__chevron--open' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="month-group__list">
          {items.map((item, idx) => (
            <DrugExpandableCard key={idx} item={item} colorTheme={colorTheme} />
          ))}
        </div>
      )}
    </div>
  );
}
 
function DrugExpandableCard({ item, colorTheme }: { item: DrugRecord; colorTheme: Theme }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const recoveryTag = extractRecoveryTime(item?.供應狀態 || '');
 
  return (
    <div className="drug-card">
      <div
        className={`drug-card__row${isExpanded ? ' drug-card__row--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="drug-card__info">
          <div className="drug-card__name">{item?.中文品名 || '無品名'}</div>
          <div className="drug-card__code">{item?.許可證字號 || '無字號'}</div>
          <div className="drug-card__date">{item?.公告更新時間 || '未知日期'}</div>
        </div>
        <div className="drug-card__right">
          {recoveryTag ? (
            <span className={`recovery-tag recovery-tag--${colorTheme}`}>⏳ {recoveryTag}</span>
          ) : (
            <span className="recovery-tag recovery-tag--default">詳見說明</span>
          )}
          <span className={`drug-card__chevron${isExpanded ? ' drug-card__chevron--open' : ''}`}>▼</span>
        </div>
      </div>
 
      {isExpanded && (
        <div className="drug-detail">
          <div className="drug-detail__inner">
            <div className="drug-detail__titlebar">
              <span className="drug-detail__dot drug-detail__dot--red"   />
              <span className="drug-detail__dot drug-detail__dot--amber" />
              <span className="drug-detail__dot drug-detail__dot--green" />
              <span className="drug-detail__label">供應狀態說明</span>
            </div>
            <div className="drug-detail__body">
              {String(item?.供應狀態 || '無狀態說明').replace(/\\r\\n/g, '\n')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}