import os
import json
import requests
from datetime import datetime

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
        print(f"⚠️ API 讀取失敗 {url}: {e}")
        return []

def main():
    print(f"🚀 開始抓取 TFDA 藥品供應 API 資料 ({datetime.now().isoformat()})...")
    
    combined_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "datasets": {}
    }

    for key, url in API_ENDPOINTS.items():
        print(f"📥 正在抓取 API: {key}...")
        data = fetch_data(url)
        combined_data["datasets"][key] = data
        print(f"✅ 成功: {key} 共取得 {len(data)} 筆紀錄。\n")

    output_dir = "public/data"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "supply_status_latest.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 所有 API 資料已成功寫入 {output_path}")

if __name__ == "__main__":
    main()