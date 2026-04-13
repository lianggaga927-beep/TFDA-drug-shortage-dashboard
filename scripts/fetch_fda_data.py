import os
import json
import requests
from datetime import datetime

# 衛福部開放資料 API 端點 (依據 InfoId 對應 54504, 54505, 54506)
API_ENDPOINTS = {
    "54504_with_alternative": "https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=104&Format=json",
    "54505_no_alternative": "https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=105&Format=json",
    "54506_resolved": "https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=106&Format=json"
}

def fetch_data(url):
    """發送 HTTP GET 請求並回傳 JSON 解析結果"""
    try:
        # 設定 timeout，防止政府 API 異常導致 GitHub Actions 執行逾時被扣額度
        response = requests.get(url, timeout=30)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"⚠️ 讀取失敗 {url}: {e}")
        # 若單一 API 失敗，回傳空陣列，避免整個系統崩潰
        return []

def main():
    print(f"🚀 開始抓取 TFDA 藥品供應資料 ({datetime.now().isoformat()})...")
    
    # 建立統一的資料結構
    combined_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "datasets": {}
    }

    # 平行/依序抓取三大資料集
    for key, url in API_ENDPOINTS.items():
        print(f"📥 正在抓取: {key}...")
        data = fetch_data(url)
        combined_data["datasets"][key] = data
        print(f"✅ 成功: {key} 共取得 {len(data)} 筆紀錄。")

    # 確保輸出的目錄存在 (對應前端 public 目錄)
    output_dir = "public/data"
    os.makedirs(output_dir, exist_ok=True)
    
    # 將清洗/合併後的資料寫入靜態 JSON 檔
    output_path = os.path.join(output_dir, "supply_status_latest.json")
    with open(output_path, "w", encoding="utf-8") as f:
        # ensure_ascii=False 確保中文字元正常顯示
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 資料已成功編譯並儲存至 {output_path}")

if __name__ == "__main__":
    main()
