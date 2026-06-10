import os

files = [
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\do-master\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\rr-entry\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\quality-tracking\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\deduction-penalty\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\billing-payment\page.tsx"
]

for filepath in files:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - file does not exist")
        continue
        
    print(f"Processing {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace onClick={fetchData} with onClick={() => fetchData()}
    content = content.replace("            onClick={fetchData}", "            onClick={() => fetchData()}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Type conflicts resolved successfully!")
