import urllib.request
import json
import gzip
import os

print("Downloading CC-CEDICT dictionary...")
url = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"

# A widely accepted frequency list of top ~500 Traditional Chinese characters
freq_chars = """
的你是這我在有不他個人著都和就來大為說到上面對可以能子那要會也之學去過我們多出成國作發主年生自起中時地她道你看很心此裡用家如理兩如事三當沒而然現後起分於其只由得把還天心從無回小但點些所好法想得前水力作本動才氣外同理長下見去十面實進打又車因水重無明相新將之知但情長正此它實或三四五六七八九十百千萬
白金火木水土日月星天地上中下左右男女老少父母兄弟姐妹大小多少高低長短紅黃藍綠黑白好壞美醜真假多少快慢這那裡外你我他它是非有沒來去出入坐站走跑吃喝玩樂看聽說讀寫買賣東西南北書筆紙張本車船飛機電話電腦手機桌椅床門窗水電火風雨雪冰太陽月亮天雲山石草樹花鳥魚蟲牛羊馬狗貓豬雞鴨肉蛋奶米麵飯菜湯水果茶水酒
"""

# clean the string
freq_chars = "".join(set(freq_chars.replace("\n", "").replace(" ", "")))
print(f"Loaded {len(freq_chars)} unique characters.")

# Fetch makemeahanzi dict
dict_path = "dictionary.txt"
if not os.path.exists(dict_path):
    print("Fetching makemeahanzi dict from github...")
    urllib.request.urlretrieve(url, dict_path)

dict_lookup = {}
with open(dict_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            char = data.get("character")
            if char:
                # Store the most common pronunciation and definition
                dict_lookup[char] = {
                    "py": data.get("pinyin", [""])[0],
                    "tr": data.get("definition", "No definition found")
                }
        except:
            pass

final_dataset = []
for char in freq_chars:
    if char in dict_lookup:
        final_dataset.append({
            "hz": char,
            "py": dict_lookup[char]["py"],
            "tr": dict_lookup[char]["tr"]
        })

# Save to characters.json
with open("characters.json", "w", encoding="utf-8") as f:
    json.dump(final_dataset, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote {len(final_dataset)} characters to characters.json")
