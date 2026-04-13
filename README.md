# 🏥 西藥供應資訊儀表板 (NHI Drug Supply Monitor)

專為臨床醫療人員、藥局採購與藥師設計的西藥供應狀態監測面板。本系統透過自動化排程介接衛福部食藥署開放資料，提供即時、視覺化且易於檢索的藥品短缺與替代資訊，大幅降低臨床盤點與交班的行政成本。

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646cff.svg?logo=vite)
![Python](https://img.shields.io/badge/Python-3.10+-3776ab.svg?logo=python)

## ✨ 核心功能 (Features)

* **🤖 自動化資料流 (Zero-Maintenance)**：內建 GitHub Actions 排程，每週自動向政府 API 抓取並清洗資料，產出靜態 JSON，實現零伺服器維運成本。
* **📊 視覺化風險分級 (Visual Hierarchy)**：
    * 🟥 **紅區**：經評估【無】替代藥品（最高警戒）
    * 🟨 **黃區**：經評估【有】替代藥品（需注意）
    * 🟩 **綠區**：藥品已解除短缺（安全）
* **📅 巢狀時間軸收摺 (Nested Accordion)**：自動依據公告時間進行「年 ➔ 月」雙層群組化，俐落收納龐大的歷史紀錄。
* **⏳ 智慧時間萃取 (Regex Extraction)**：運用正規表達式，自動從冗長公文中精萃出「預計恢復時間」並轉換為高亮度標籤 (Badge)。
* **🔍 即時檢索 (Live Search)**：支援以「中文品名」或「許可證字號」進行快速字串過濾。

---

## 🏗️ 系統架構 (Architecture)

本專案採用 **Serverless (無伺服器) + SSG (靜態網站生成)** 架構，確保最高等級的可用性與最低的託管成本。

| 階段 | 負責元件 | 執行邏輯與技術 |
| :--- | :--- | :--- |
| **資料來源** | 衛福部開放資料 API | 端點代碼：`104` (有替代), `105` (無替代), `106` (已解除) |
| **ETL 處理** | GitHub Actions + Python | 每週五凌晨執行 `fetch_fda_data.py`，清洗資料並合併為 `supply_status_latest.json` |
| **前端渲染** | React + TypeScript + Vite | 讀取靜態 JSON，使用自訂 CSS (BEM 命名法) 渲染響應式 UI |
| **網頁託管** | GitHub Pages | 由 GitHub 全球 CDN 分發，提供極速的載入體驗 |

---
## 📜 免責聲明 (Disclaimer)
* 本系統之原始資料皆來自 政府資料開放平臺 - 衛福部食藥署。
* 本儀表板僅供介面優化與資訊檢索參考，不構成任何醫療決策指引。實際藥品供應狀態與替代方案，請務必依據各醫療機構之正式公告與臨床藥師之專業評估為準。

---
## 💻 本機開發指南 (Local Development)

若您希望在本地端運行或修改此專案，請確保您的環境已安裝 Node.js (v18+) 與 Python (v3.10+)。

### 1. 取得專案
```bash
git clone [https://github.com/您的帳號/TFDA-drug-shortage-dashboard.git](https://github.com/您的帳號/TFDA-drug-shortage-dashboard.git)
cd TFDA-drug-shortage-dashboard
