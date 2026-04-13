import { useEffect, useState } from 'react'
import './index.css'
 
interface DrugRecord {
  編號: string;
  中文品名: string;
  許可證字號: string;
  供應狀態: string;
  公告更新時間: string;
}
 
interface SupplyData {
  last_updated: string;
  datasets: { [key: string]: DrugRecord[] };
}
 
type Theme = 'red' | 'amber' | 'emerald';
 
// ----------------------------------------------------------------------
// 核心邏輯
// ----------------------------------------------------------------------
 
const groupAndSortByYearAndMonth = (list: DrugRecord[]) => {
  const sorted = [...list].sort(
    (a, b) => new Date(b.公告更新時間).getTime() - new Date(a.公告更新時間).getTime()
  );
  return sorted.reduce((acc, curr) => {
    const parts = curr.公告更新時間.split('/');
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
  const cleanText = statusText.replace(/\\r\\n/g, '');
  const match = cleanText.match(/(無法預計[^\u3002，,]*|預計[^\u3002，,]*(?:恢復|供應)[^\u3002，,]*)/);
  return match ? match[0] : null;
};
 
// 合併所有資料集，標記來源，依時間排序，取前 N 筆
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
    .sort((a, b) => new Date(b.公告更新時間).getTime() - new Date(a.公告更新時間).getTime())
    .slice(0, n);
};
 
// ----------------------------------------------------------------------
// 主元件
// ----------------------------------------------------------------------
 
export default function App() {
  const [data, setData]             = useState<SupplyData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading]       = useState(true);
 
  useEffect(() => {
    fetch('/data/supply_status_latest.json')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
 
  if (loading) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
        系統讀取中...
      </div>
    );
  }
 
  const filterList = (list: DrugRecord[]) =>
    list.filter(
      item =>
        item.中文品名.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.許可證字號.includes(searchTerm)
    );
 
  const noAlt    = filterList(data?.datasets['54505_no_alternative'] || []);
  const withAlt  = filterList(data?.datasets['54504_with_alternative'] || []);
  const resolved = filterList(data?.datasets['54506_resolved'] || []);
  const recentItems = data ? getRecentItems(data.datasets) : [];
 
  return (
    <>
      {/* ── Navigation ── */}
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
 
      {/* ── Main ── */}
      <main className="main">
 
        {/* 最新動態儀表板 — 搜尋時隱藏 */}
        {!searchTerm && <RecentDashboard items={recentItems} />}
 
        <Section title="經評估【無】替代藥品" colorTheme="red"     list={noAlt}    />
        <Section title="經評估【有】替代藥品" colorTheme="amber"   list={withAlt}  />
        <Section title="藥品已解除短缺"       colorTheme="emerald" list={resolved} />
      </main>
    </>
  );
}
 
// ----------------------------------------------------------------------
// RecentDashboard — 最新十筆
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
      {/* Header */}
      <div className="recent__header">
        <div className="recent__header-left">
          <span className="recent__pulse" />
          <h2 className="recent__title">最新公告動態</h2>
          <span className="recent__subtitle">近 10 筆</span>
        </div>
        <span className="recent__badge">LIVE</span>
      </div>
 
      {/* Grid */}
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
  const recoveryTag = extractRecoveryTime(item.供應狀態);
  const theme = item._theme;
 
  return (
    <div
      className={`rc rc--${theme}${expanded ? ' rc--expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top row: rank + date */}
      <div className="rc__top">
        <span className="rc__rank">#{rank.toString().padStart(2, '0')}</span>
        <span className="rc__date">{item.公告更新時間}</span>
        <span className={`rc__tag rc__tag--${theme}`}>{THEME_LABEL[theme]}</span>
      </div>
 
      {/* Drug name */}
      <div className="rc__name">{item.中文品名}</div>
 
      {/* Code */}
      <div className="rc__code">{item.許可證字號}</div>
 
      {/* Recovery hint */}
      {recoveryTag && (
        <div className="rc__recovery">⏳ {recoveryTag}</div>
      )}
 
      {/* Expanded detail */}
      {expanded && (
        <div className="rc__detail">
          {item.供應狀態.replace(/\\r\\n/g, '\n')}
        </div>
      )}
 
      {/* Chevron */}
      <div className={`rc__chevron${expanded ? ' rc__chevron--open' : ''}`}>▼</div>
    </div>
  );
}
 
// ----------------------------------------------------------------------
// Section
// ----------------------------------------------------------------------
 
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
 
// ----------------------------------------------------------------------
// YearGroup
// ----------------------------------------------------------------------
 
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
 
// ----------------------------------------------------------------------
// MonthGroup
// ----------------------------------------------------------------------
 
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
 
// ----------------------------------------------------------------------
// DrugExpandableCard
// ----------------------------------------------------------------------
 
function DrugExpandableCard({ item, colorTheme }: { item: DrugRecord; colorTheme: Theme }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const recoveryTag = extractRecoveryTime(item.供應狀態);
 
  return (
    <div className="drug-card">
      <div
        className={`drug-card__row${isExpanded ? ' drug-card__row--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="drug-card__info">
          <div className="drug-card__name">{item.中文品名}</div>
          <div className="drug-card__code">{item.許可證字號}</div>
          <div className="drug-card__date">{item.公告更新時間}</div>
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
              {item.供應狀態.replace(/\\r\\n/g, '\n')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 