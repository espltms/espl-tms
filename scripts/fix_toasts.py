import os
import re

files = [
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\do-master\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\rr-entry\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\quality-tracking\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\deduction-penalty\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\billing-payment\page.tsx",
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\maintenance\page.tsx"
]

for filepath in files:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - file does not exist")
        continue
        
    print(f"Processing {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update toast state definition
    old_state = "const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);"
    new_state = "const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);"
    content = content.replace(old_state, new_state)

    # 2. Update toast title in JSX (Coal RCR pages)
    old_jsx_title = "{toast.type === 'success' ? 'Import Succeeded' : toast.type === 'error' ? 'Import Failed' : 'Import Status'}"
    new_jsx_title = "{toast.title || (toast.type === 'success' ? 'Succeeded' : toast.type === 'error' ? 'Failed' : 'Status')}"
    content = content.replace(old_jsx_title, new_jsx_title)

    # 3. Update toast title in JSX (maintenance page)
    old_maint_title = "{toast.type === 'success' ? 'Succeeded' : toast.type === 'error' ? 'Failed' : 'Status'}"
    content = content.replace(old_maint_title, new_jsx_title)

    # 4. Add title to Excel import setToast call
    # e.g., setToast({ message: ..., type: ... }) -> add title: errorCount > 0 ? 'Import Status' : 'Import Succeeded'
    # We search for the Excel import setToast pattern
    content = re.sub(
        r"(setToast\(\{\s*message:\s*`Excel Import completed:[^`]*`,\s*type:\s*errorCount\s*>\s*0\s*\?\s*'info'\s*:\s*'success')(\s*\}\);)",
        r"\1,\n        title: errorCount > 0 ? 'Import Status' : 'Import Succeeded'\2",
        content
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Toast fixes applied successfully!")
