#!/usr/bin/env python3
"""Add 5 advanced lottery algorithm strategies to App.tsx."""
import sys

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

with open('algo_functions.ts.txt', 'r', encoding='utf-8') as f:
    algo_code = f.read()

# ============================================================
# STEP 1: Add algorithm field to pickViewStateCache
# ============================================================
old_cache = "  mode: 'smart' as 'smart' | 'manual',\n  sets: [] as any[],"
new_cache = "  mode: 'smart' as 'smart' | 'manual',\n  algorithm: 'random' as string,\n  sets: [] as any[],"
assert old_cache in content, "CACHE NOT FOUND"
content = content.replace(old_cache, new_cache)
print("Step 1: Cache updated")

# ============================================================
# STEP 2: Insert algorithm functions after generateSmartMix
# ============================================================
marker = "  return { reds, blues, isSmartAppended: true, id: Math.random().toString(36).substring(7) };\n};"
assert marker in content, "SMART MIX END NOT FOUND"
idx = content.index(marker) + len(marker)
content = content[:idx] + "\n" + algo_code + "\n" + content[idx:]
print("Step 2: Algorithm functions inserted")

# ============================================================
# STEP 3: Add algorithm state to PickView
# ============================================================
old_s = "  const [isDltExtra, setIsDltExtra] = useState(isSameLottery ? pickViewStateCache.isDltExtra : false);"
new_s = old_s + "\n  const [algorithm, setAlgorithm] = useState<AlgorithmId>(isSameLottery ? (pickViewStateCache.algorithm as AlgorithmId) : 'random');"
assert old_s in content, "PICK STATE NOT FOUND"
content = content.replace(old_s, new_s, 1)
print("Step 3: Algorithm state added")

# ============================================================
# STEP 4: Update cache sync
# ============================================================
old_sync = "    pickViewStateCache.isDltExtra = isDltExtra;\n  }, [selectedLotteryId, mode, sets, manualReds, manualBlues, multiplier, isDltExtra]);"
new_sync = "    pickViewStateCache.isDltExtra = isDltExtra;\n    pickViewStateCache.algorithm = algorithm;\n  }, [selectedLotteryId, mode, sets, manualReds, manualBlues, multiplier, isDltExtra, algorithm]);"
assert old_sync in content, "CACHE SYNC NOT FOUND"
content = content.replace(old_sync, new_sync)
print("Step 4: Cache sync updated")

# ============================================================
# STEP 5: Update handleGenerate
# ============================================================
old_gen = "             newSets.push({ ...generateUniqueNumbers(config, history), id: Math.random().toString(36).substring(7) });"
new_gen = "             const generated = generateByAlgorithm(algorithm, config, history);\n             newSets.push({ ...generated, id: Math.random().toString(36).substring(7) });"
assert old_gen in content, "OLD GENERATE LINE NOT FOUND"
content = content.replace(old_gen, new_gen)
print("Step 5: handleGenerate updated")

# ============================================================
# STEP 6: Add strategy pills UI
# ============================================================
# Find the closing of mode selector div + parent div
old_mode_end = """        </div>
      </div>

      {/* Content */}"""

pills_ui = '''        </div>

        {/* Algorithm Strategy Pills - only in smart mode */}
        {mode === 'smart' && (
          <div className="mt-1.5 mb-0">
            <div className="flex overflow-x-auto hide-scrollbar gap-1.5 px-2 pb-1">
              {ALGORITHMS.map(algo => {
                const isActive = algorithm === algo.id;
                return (
                  <button
                    key={algo.id}
                    onClick={() => setAlgorithm(algo.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition-all flex-shrink-0 border ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-sm shadow-amber-200/50 dark:shadow-amber-900/30 scale-[1.03]' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 active:scale-95'}`}
                  >
                    <span>{algo.emoji}</span>
                    <span>{algo.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-3 mt-0.5">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium truncate">{ALGORITHMS.find(a => a.id === algorithm)?.desc}</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}'''

assert old_mode_end in content, "MODE END NOT FOUND"
content = content.replace(old_mode_end, pills_ui)
print("Step 6: Strategy pills UI added")

# ============================================================
# STEP 7: Add algorithm tag badges on cards
# ============================================================
# Find the smartAppended badge
import re
new_badge_line = """                        ✨ 算法优选
                      </div>
                    )}
                    {!set.isSmartAppended && set.algorithmTag && (
                      <div className={`absolute top-0 right-0 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-bl-[12px] flex items-center gap-0.5 shadow-sm ${
                        set.algorithmTag === 'ai' ? 'bg-gradient-to-l from-purple-500 to-indigo-500' :
                        set.algorithmTag === 'kill' ? 'bg-gradient-to-l from-red-500 to-rose-600' :
                        set.algorithmTag === 'sumac' ? 'bg-gradient-to-l from-blue-500 to-cyan-500' :
                        set.algorithmTag === 'path012' ? 'bg-gradient-to-l from-green-500 to-emerald-500' :
                        set.algorithmTag === 'anchor' ? 'bg-gradient-to-l from-amber-500 to-yellow-500' :
                        'bg-gray-500'
                      }`}>
                        {ALGORITHMS.find(a => a.id === set.algorithmTag)?.emoji} {ALGORITHMS.find(a => a.id === set.algorithmTag)?.label}
                      </div>
                    )}"""
content = re.sub(r'(\s+✨ 算法优选\s+</div>\s+)}', r'\\1}\n' + new_badge_line.split(')}')[1], content)
print("Step 7: Algorithm tag badges added")

# ============================================================
# STEP 8: Add anchor gold ring styling
# ============================================================
new_ball = '''                        <div key={`r-${set.id || idx}-${i}`} className={`relative ${set.anchors && set.anchors.includes(n) ? 'ring-2 ring-amber-400 ring-offset-1 rounded-full' : ''}`}>
                          <Ball num={n} color="red" max={config.red.max} lotteryId={config.id} />
                          {set.anchors && set.anchors.includes(n) && (
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-[7px] text-white font-bold shadow-sm z-20">胆</div>
                          )}
                        </div>'''
content = re.sub(r'\s+<Ball key=\{`r-\$\{set\.id \|\| idx\}-\$\{i\}`\} num=\{n\} color="red" max=\{config\.red\.max\} lotteryId=\{config\.id\} />', '\n' + new_ball, content)
print("Step 8: Anchor gold ring styling added")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ All patches applied successfully!")
