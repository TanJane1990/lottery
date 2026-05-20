#!/usr/bin/env python3
import sys

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: HomeView Hero Section
old_1 = "pt-[calc(env(safe-area-inset-top,20px)+30px)]"
new_1 = "pt-[calc(max(env(safe-area-inset-top),32px)+20px)]"
if old_1 in content:
    content = content.replace(old_1, new_1)
    print("Replaced 1")

# Fix 2: PickView and ResultsView headers
old_2 = "pt-[calc(env(safe-area-inset-top,44px)+6px)]"
new_2 = "pt-[calc(max(env(safe-area-inset-top),32px)+16px)]"
if old_2 in content:
    content = content.replace(old_2, new_2)
    print("Replaced 2")

# Fix 3: MineView Settings icon
old_3 = "top-[calc(env(safe-area-inset-top,24px)+8px)]"
new_3 = "top-[calc(max(env(safe-area-inset-top),32px)+8px)]"
if old_3 in content:
    content = content.replace(old_3, new_3)
    print("Replaced 3")

# Fix 4: MineView Header
old_4 = "pt-[calc(env(safe-area-inset-top,24px)+16px)]"
new_4 = "pt-[calc(max(env(safe-area-inset-top),32px)+20px)]"
if old_4 in content:
    content = content.replace(old_4, new_4)
    print("Replaced 4")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
