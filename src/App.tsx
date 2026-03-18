import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Dices, Trophy, User, ChevronRight, RefreshCw, Save, Trash2, History, Sparkles, CheckCircle2 } from 'lucide-react';

// --- Types ---
type Org = '福彩' | '体彩';
type LotteryId = 'SSQ' | 'DLT' | 'FC3D' | 'PL3' | 'QLC' | 'QXC';

interface LotteryConfig {
  id: LotteryId;
  name: string;
  org: Org;
  theme: 'red' | 'blue';
  red: { max: number; count: number; allowDuplicate?: boolean };
  blue: { max: number; count: number; allowDuplicate?: boolean };
  desc: string;
}

interface SavedTicket {
  id: string;
  lotteryId: LotteryId;
  date: string;
  numbers: { reds: number[]; blues: number[] }[];
}

// --- Constants ---
const THEME_CLASSES = {
  red: {
    bg: 'bg-red-500',
    text: 'text-red-500',
    border: 'border-red-500',
    gradient: 'from-red-500 to-rose-600',
    lightBg: 'bg-red-50',
    pillActive: 'bg-red-500 text-white shadow-md shadow-red-200',
  },
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    border: 'border-blue-500',
    gradient: 'from-blue-500 to-cyan-600',
    lightBg: 'bg-blue-50',
    pillActive: 'bg-blue-500 text-white shadow-md shadow-blue-200',
  }
};

const LOTTERIES: LotteryConfig[] = [
  { id: 'SSQ', name: '双色球', org: '福彩', theme: 'red', red: { max: 33, count: 6 }, blue: { max: 16, count: 1 }, desc: '2元可中1000万' },
  { id: 'DLT', name: '大乐透', org: '体彩', theme: 'blue', red: { max: 35, count: 5 }, blue: { max: 12, count: 2 }, desc: '3元可中1800万' },
  { id: 'FC3D', name: '福彩3D', org: '福彩', theme: 'red', red: { max: 9, count: 3, allowDuplicate: true }, blue: { max: 0, count: 0 }, desc: '天天开奖，玩法简单' },
  { id: 'PL3', name: '排列3', org: '体彩', theme: 'blue', red: { max: 9, count: 3, allowDuplicate: true }, blue: { max: 0, count: 0 }, desc: '天天开奖，轻松赢' },
  { id: 'QLC', name: '七乐彩', org: '福彩', theme: 'red', red: { max: 30, count: 7 }, blue: { max: 0, count: 0 }, desc: '百万大奖等你拿' },
  { id: 'QXC', name: '七星彩', org: '体彩', theme: 'blue', red: { max: 9, count: 6, allowDuplicate: true }, blue: { max: 14, count: 1 }, desc: '经典玩法，惊喜不断' },
];

// --- Helpers ---
const formatNum = (n: number, max: number) => max > 9 ? n.toString().padStart(2, '0') : n.toString();

const generateNumbers = (config: LotteryConfig) => {
  const getNum = (max: number, zeroBased: boolean) => Math.floor(Math.random() * (zeroBased ? max + 1 : max)) + (zeroBased ? 0 : 1);

  const getSet = (max: number, count: number, allowDup: boolean, zeroBased: boolean) => {
    if (count === 0) return [];
    if (allowDup) {
      return Array.from({ length: count }, () => getNum(max, zeroBased));
    }
    const s = new Set<number>();
    while (s.size < count) {
      s.add(getNum(max, zeroBased));
    }
    return Array.from(s).sort((a, b) => a - b);
  };

  const zeroRed = ['FC3D', 'PL3', 'QXC'].includes(config.id);
  const zeroBlue = ['QXC'].includes(config.id);

  return {
    reds: getSet(config.red.max, config.red.count, !!config.red.allowDuplicate, zeroRed),
    blues: getSet(config.blue.max, config.blue.count, !!config.blue.allowDuplicate, zeroBlue)
  };
};

const generateMockResults = () => {
  const results: Record<string, any[]> = {};
  LOTTERIES.forEach(config => {
    results[config.id] = Array.from({ length: 10 }, (_, i) => ({
      issue: `2023${(120 - i).toString().padStart(3, '0')}`,
      date: new Date(Date.now() - i * 86400000 * (config.id === 'SSQ' ? 2 : 1)).toISOString().split('T')[0],
      ...generateNumbers(config)
    }));
  });
  return results;
};
const mockResults = generateMockResults();

// --- Components ---
const Ball: React.FC<{ num: number, color: 'red' | 'blue', max: number }> = ({ num, color, max }) => {
  const isRed = color === 'red';
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-inner
      ${isRed ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-200' : 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-200'}`}
    >
      {formatNum(num, max)}
    </motion.div>
  );
};

const ResultCard: React.FC<{ lottery: LotteryConfig, result: any }> = ({ lottery, result }) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800">{lottery.name}</span>
          <span className="text-xs text-gray-500">第 {result.issue} 期</span>
        </div>
        <span className="text-xs text-gray-400">{result.date}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {result.reds.map((n: number, i: number) => (
          <div key={`r-${i}`} className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold border border-red-100">
            {formatNum(n, lottery.red.max)}
          </div>
        ))}
        {result.blues.map((n: number, i: number) => (
          <div key={`b-${i}`} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold border border-blue-100">
            {formatNum(n, lottery.blue.max)}
          </div>
        ))}
      </div>
    </div>
  );
};

const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 flex items-center gap-2 whitespace-nowrap"
      >
        <CheckCircle2 size={16} className="text-emerald-400" />
        {message}
      </motion.div>
    )}
  </AnimatePresence>
);

// --- Views ---
const HomeView = ({ onNavigate, mockResults }: { onNavigate: (tab: string, id?: LotteryId) => void, mockResults: Record<string, any[]> }) => {
  return (
    <div className="pb-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 pt-12 pb-16 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Trophy size={200} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 relative z-10">彩票助手</h1>
        <p className="text-slate-300 text-sm relative z-10">理性购彩，量力而行。公益体彩，乐善人生。</p>
      </div>

      {/* Quick Access Grid */}
      <div className="px-4 -mt-8 relative z-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 gap-4">
          {LOTTERIES.slice(0, 4).map(lottery => (
            <div
              key={lottery.id}
              onClick={() => onNavigate('pick', lottery.id)}
              className={`p-4 rounded-xl cursor-pointer transition-transform active:scale-95 bg-gradient-to-br ${THEME_CLASSES[lottery.theme].lightBg} border border-white`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md text-white ${THEME_CLASSES[lottery.theme].bg}`}>
                  {lottery.org}
                </span>
                <ChevronRight size={16} className={THEME_CLASSES[lottery.theme].text} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">{lottery.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{lottery.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Results Preview */}
      <div className="mt-8 px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">最新开奖</h2>
          <button onClick={() => onNavigate('results')} className="text-sm text-gray-500 flex items-center">
            查看更多 <ChevronRight size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <ResultCard lottery={LOTTERIES[0]} result={mockResults['SSQ'][0]} />
          <ResultCard lottery={LOTTERIES[1]} result={mockResults['DLT'][0]} />
        </div>
      </div>
    </div>
  );
};

const PickView = ({ selectedLotteryId, onSelectLottery, onSave }: { selectedLotteryId: LotteryId, onSelectLottery: (id: LotteryId) => void, onSave: (id: LotteryId, sets: any[]) => void }) => {
  const config = LOTTERIES.find(l => l.id === selectedLotteryId)!;
  const [sets, setSets] = useState<{reds: number[], blues: number[]}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = (count: number) => {
    setIsGenerating(true);
    setTimeout(() => {
      const newSets = Array.from({ length: count }, () => generateNumbers(config));
      setSets(prev => [...newSets, ...prev].slice(0, 10)); // Keep max 10 in view
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white pt-10 pb-4 px-4 shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold text-center text-gray-800 mb-4">智能机选</h1>
        {/* Lottery Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {LOTTERIES.map(l => (
            <button
              key={l.id}
              onClick={() => { onSelectLottery(l.id); setSets([]); }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${l.id === selectedLotteryId ? THEME_CLASSES[l.theme].pillActive : 'bg-gray-100 text-gray-600'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {sets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-64 text-gray-400"
            >
              <Dices size={48} className="mb-4 opacity-50" />
              <p>点击下方按钮生成专属幸运号码</p>
            </motion.div>
          ) : (
            sets.map((set, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 relative overflow-hidden"
              >
                {/* Decorative background number */}
                <div className="absolute -right-4 -top-4 text-9xl font-black text-gray-50 opacity-50 select-none pointer-events-none">
                  {idx + 1}
                </div>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {set.reds.map((n, i) => (
                    <Ball key={`r-${idx}-${i}`} num={n} color="red" max={config.red.max} />
                  ))}
                  {set.blues.map((n, i) => (
                    <Ball key={`b-${idx}-${i}`} num={n} color="blue" max={config.blue.max} />
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar */}
      <div className="bg-white border-t border-gray-100 p-4 pb-safe flex gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => handleGenerate(1)}
          disabled={isGenerating}
          className="flex-1 bg-gray-100 text-gray-800 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition-colors"
        >
          <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
          机选1注
        </button>
        <button
          onClick={() => handleGenerate(5)}
          disabled={isGenerating}
          className={`flex-1 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all bg-gradient-to-r ${THEME_CLASSES[config.theme].gradient}`}
        >
          <Sparkles size={18} />
          机选5注
        </button>
        {sets.length > 0 && (
          <button
            onClick={() => {
              onSave(config.id, sets);
              setSets([]);
            }}
            className="w-14 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-[0.98] transition-all"
          >
            <Save size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

const ResultsView = ({ mockResults }: { mockResults: Record<string, any[]> }) => {
  const [selectedLottery, setSelectedLottery] = useState<LotteryId>('SSQ');
  const config = LOTTERIES.find(l => l.id === selectedLottery)!;
  const results = mockResults[selectedLottery];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white pt-10 pb-4 px-4 shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold text-center text-gray-800 mb-4">历史开奖</h1>
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {LOTTERIES.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLottery(l.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${l.id === selectedLottery ? THEME_CLASSES[l.theme].pillActive : 'bg-gray-100 text-gray-600'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.map((res, idx) => (
          <ResultCard key={idx} lottery={config} result={res} />
        ))}
      </div>
    </div>
  );
};

const MineView = ({ savedTickets, onDeleteTicket }: { savedTickets: SavedTicket[], onDeleteTicket: (id: string) => void }) => {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 pt-16 pb-12 px-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20">
            <User size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">我的号码本</h1>
            <p className="text-slate-300 text-sm mt-1">共保存 {savedTickets.length} 组号码</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 -mt-6 relative z-10">
        {savedTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <History size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">暂无保存的号码</p>
            <p className="text-sm text-gray-400 mt-1">去选号页面生成并保存吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedTickets.map(ticket => {
              const config = LOTTERIES.find(l => l.id === ticket.lotteryId)!;
              return (
                <div key={ticket.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3 border-b border-gray-50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${THEME_CLASSES[config.theme].bg}`}></span>
                      <span className="font-bold text-gray-800">{config.name}</span>
                      <span className="text-xs text-gray-400">{new Date(ticket.date).toLocaleDateString()}</span>
                    </div>
                    <button onClick={() => onDeleteTicket(ticket.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {ticket.numbers.map((set, idx) => (
                      <div key={idx} className="flex flex-wrap gap-1.5">
                        {set.reds.map((n, i) => (
                          <div key={`r-${idx}-${i}`} className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold border border-red-100">
                            {formatNum(n, config.red.max)}
                          </div>
                        ))}
                        {set.blues.map((n, i) => (
                          <div key={`b-${idx}-${i}`} className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                            {formatNum(n, config.blue.max)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [pickLotteryId, setPickLotteryId] = useState<LotteryId>('SSQ');
  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>(() => {
    try {
      const saved = localStorage.getItem('lottery_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [toast, setToast] = useState({ visible: false, message: '' });

  useEffect(() => {
    localStorage.setItem('lottery_tickets', JSON.stringify(savedTickets));
  }, [savedTickets]);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  const handleSaveTicket = (lotteryId: LotteryId, numbers: {reds: number[], blues: number[]}[]) => {
    const newTicket: SavedTicket = {
      id: Math.random().toString(36).substring(7),
      lotteryId,
      date: new Date().toISOString(),
      numbers
    };
    setSavedTickets(prev => [newTicket, ...prev]);
    showToast('保存成功');
  };

  const handleDeleteTicket = (id: string) => {
    setSavedTickets(prev => prev.filter(t => t.id !== id));
    showToast('已删除');
  };

  const NAV_ITEMS = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'pick', icon: Dices, label: '选号' },
    { id: 'results', icon: Trophy, label: '开奖' },
    { id: 'mine', icon: User, label: '我的' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              {activeTab === 'home' && <HomeView onNavigate={(tab, id) => { if (id) setPickLotteryId(id); setActiveTab(tab); }} mockResults={mockResults} />}
              {activeTab === 'pick' && <PickView selectedLotteryId={pickLotteryId} onSelectLottery={setPickLotteryId} onSave={handleSaveTicket} />}
              {activeTab === 'results' && <ResultsView mockResults={mockResults} />}
              {activeTab === 'mine' && <MineView savedTickets={savedTickets} onDeleteTicket={handleDeleteTicket} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-gray-100 flex justify-around items-center h-16 pb-safe z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors
                  ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Icon size={24} className={isActive ? 'fill-blue-50 text-blue-600' : ''} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Global Toast */}
        <Toast message={toast.message} visible={toast.visible} />
      </div>
    </div>
  );
}
