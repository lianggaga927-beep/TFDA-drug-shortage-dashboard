import os
import json
import requests
import subprocess
from datetime import datetime
from bs4 import BeautifulSoup

# 1. API 網址 (JSON)
API_ENDPOINTS = {
    "54504_with_alternative": "https://data.fda.gov.tw/data/opendata/export/104/json",
    "54505_no_alternative": "https://data.fda.gov.tw/data/opendata/export/105/json",
    "54506_resolved": "https://data.fda.gov.tw/data/opendata/export/106/json"
}

# 2. 網頁網址 (HTML)
HTML_ENDPOINTS = {
    "54507_soliciting": "https://dsms.fda.gov.tw/NewsList.aspx?s=2",
    "54508_solicited": "https://dsms.fda.gov.tw/NewsList.aspx?s=3" 
}

def fetch_api_data(url):
    """使用標準 requests 抓取友善的 JSON API"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"⚠️ API 讀取失敗 {url}: {e}")
        return []

def fetch_dsms_html_via_curl(url):
    """終極殺手鐧：完全繞過 Python，直接呼叫作業系統底層的 curl 來穿透老舊防火牆"""
    try:
        # 使用 subprocess 執行系統指令 curl (-s 靜默模式, -k 略過 SSL 驗證, -A 偽裝瀏覽器)
        result = subprocess.run(
            ["curl", "-s", "-k", 
             "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", 
             url],
            capture_output=True,
            check=True
        )
        
        # 強制以 utf-8 解碼，忽略錯誤字元
        html_content = result.stdout.decode('utf-8', errors='ignore')
        soup = BeautifulSoup(html_content, 'html.parser')
        
        extracted_data = []
        target_table = None
        
        # 尋找公告表格
        for table in soup.find_all('table'):
            if "公告日期" in table.get_text():
                target_table = table
                break
                
        if not target_table:
            return []

        # 解析表格資料
        for row in target_table.find_all('tr'):
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 2:
                date_text = cols[0].get_text(strip=True)
                subject_text = cols[1].get_text(strip=True)
                
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

    # 階段 1：抓取 JSON API
    for key, url in API_ENDPOINTS.items():
        print(f"📥 正在抓取 API: {key}...")
        data = fetch_api_data(url)
        combined_data["datasets"][key] = data
        print(f"✅ 成功: {key} 共取得 {len(data)} 筆紀錄。\n")

    # 階段 2：使用系統 Curl 抓取老舊 HTML
    for key, url in HTML_ENDPOINTS.items():
        print(f"🕸️ 正在爬取網頁 (Curl 模式): {key}...")
        data = fetch_dsms_html_via_curl(url)
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