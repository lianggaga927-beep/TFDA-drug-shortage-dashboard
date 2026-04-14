import os
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup # 新增這行 (需先在終端機執行 pip install beautifulsoup4)

# 採用您確認的最終正確版 API 網址
API_ENDPOINTS = {
    "54504_with_alternative": "https://data.fda.gov.tw/data/opendata/export/104/json",
    "54505_no_alternative": "https://data.fda.gov.tw/data/opendata/export/105/json",
    "54506_resolved": "https://data.fda.gov.tw/data/opendata/export/106/json"
}

def fetch_data(url):
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status() 
        return response.json()
    except Exception as e:
        print(f"⚠️ 讀取失敗 {url}: {e}")
        return []
    
def fetch_dsms_html(url):
    try:
        # 模擬瀏覽器，避免被阻擋
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        extracted_data = []
        
        # 尋找包含「公告日期」的表格
        tables = soup.find_all('table')
        target_table = None
        for table in tables:
            if "公告日期" in table.get_text():
                target_table = table
                break
                
        if not target_table:
            return []

        # 逐列解析
        rows = target_table.find_all('tr')
        for row in rows:
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 2:
                date_text = cols[0].get_text(strip=True)
                subject_text = cols[1].get_text(strip=True)
                
                # 排除表頭與空值
                if date_text == "公告日期" or not date_text:
                    continue
                    
                extracted_data.append({
                    "編號": "N/A",
                    "公告更新時間": date_text,
                    "中文品名": subject_text,
                    "許可證字號": "【專案輸入/徵求】",
                    "供應狀態": "詳細廠商資訊請至 DSMS 系統查看。"
                })
                
        return extracted_data

    except Exception as e:
        print(f"⚠️ HTML 爬取失敗 {url}: {e}")
        return []

def main():
    print(f"🚀 開始抓取 TFDA 藥品供應資料 ({datetime.now().isoformat()})...")
    
    combined_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "datasets": {}
    }

    # 1. 抓取原有的 JSON API (54504, 54505, 54506)
    for key, url in API_ENDPOINTS.items():
        print(f"📥 正在抓取 API: {key}...")
        data = fetch_data(url)
        combined_data["datasets"][key] = data
        print(f"✅ 成功: {key} 共取得 {len(data)} 筆紀錄。\n")

    # 2. 抓取新增的網頁 HTML 資料
    HTML_ENDPOINTS = {
        # 公開徵求供應廠商
        "54507_soliciting": "https://dsms.fda.gov.tw/NewsList.aspx?s=2",
        # 已徵得供應廠商 (請將下方網址替換為實際點擊該分頁後的正確 URL)
        "54508_solicited": "https://dsms.fda.gov.tw/NewsList.aspx?s=3" 
    }

    for key, url in HTML_ENDPOINTS.items():
        print(f"🕸️ 正在爬取網頁: {key}...")
        data = fetch_dsms_html(url)
        combined_data["datasets"][key] = data
        print(f"✅ 成功: {key} 共取得 {len(data)} 筆紀錄。\n")

    # 寫入檔案
    output_dir = "public/data"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "supply_status_latest.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 所有資料已成功寫入 {output_path}")

if __name__ == "__main__":
    main()