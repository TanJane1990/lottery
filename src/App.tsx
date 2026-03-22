import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Dices, Trophy, User, ChevronRight, RefreshCw, Save, Trash2, History, Sparkles, CheckCircle2, Dribbble, ScanLine } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { SplashScreen } from './SplashScreen';
import { SportsView } from './SportsView';

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
  icon?: string;
  schedule?: string;
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
  { id: 'SSQ', name: '双色球', org: '福彩', theme: 'red', red: { max: 33, count: 6 }, blue: { max: 16, count: 1 }, desc: '2元可中1000万', icon: '/icons/SSQ.png', schedule: '每周二、四、日开奖' },
  { id: 'DLT', name: '大乐透', org: '体彩', theme: 'blue', red: { max: 35, count: 5 }, blue: { max: 12, count: 2 }, desc: '3元可中1800万', icon: '/icons/DLT.png', schedule: '每周一、三、六开奖' },
  { id: 'FC3D', name: '福彩3D', org: '福彩', theme: 'red', red: { max: 9, count: 3, allowDuplicate: true }, blue: { max: 0, count: 0 }, desc: '天天开奖，玩法简单', icon: '/icons/FC3D.png', schedule: '每日开奖' },
  { id: 'PL3', name: '排列3', org: '体彩', theme: 'blue', red: { max: 9, count: 3, allowDuplicate: true }, blue: { max: 0, count: 0 }, desc: '天天开奖，轻松赢', icon: '/icons/P3.png', schedule: '每日开奖' },
  { id: 'QLC', name: '七乐彩', org: '福彩', theme: 'red', red: { max: 30, count: 7 }, blue: { max: 0, count: 0 }, desc: '百万大奖等你拿', schedule: '每周一、三、五开奖' },
  { id: 'QXC', name: '七星彩', org: '体彩', theme: 'blue', red: { max: 9, count: 6, allowDuplicate: true }, blue: { max: 14, count: 1 }, desc: '经典玩法，惊喜不断', schedule: '每周二、五、日开奖' },
];

// --- Helpers ---
const formatNum = (n: number, max: number) => max > 9 ? n.toString().padStart(2, '0') : n.toString();

const C = (n: number, r: number): number => {
  if (r > n || r < 0) return 0;
  let res = 1;
  for (let i = 1; i <= r; i++) res = res * (n - i + 1) / i;
  return Math.round(res);
};

// --- Strategy Pattern Implementations ---
interface PlayStrategy {
  playName: string;
  basePricePerBet: number;
  calculateBets(selectedReds: number, selectedBlues: number): number;
  isValidSelection(selectedReds: number, selectedBlues: number): boolean;
}

class StandardStrategy implements PlayStrategy {
  constructor(
    public playName: string,
    public basePricePerBet: number,
    private requiredReds: number,
    private requiredBlues: number
  ) {}

  calculateBets(selectedReds: number, selectedBlues: number): number {
    if (!this.isValidSelection(selectedReds, selectedBlues)) return 0;
    const rC = C(selectedReds, this.requiredReds);
    const bC = this.requiredBlues > 0 ? C(selectedBlues, this.requiredBlues) : 1;
    return rC * bC;
  }

  isValidSelection(selectedReds: number, selectedBlues: number): boolean {
    return selectedReds >= this.requiredReds && selectedBlues >= this.requiredBlues;
  }
}

class DLTExtraStrategy implements PlayStrategy {
  public playName: string;
  public basePricePerBet: number;

  constructor(isAppended: boolean = false) {
    this.playName = isAppended ? "大乐透-追加" : "大乐透";
    this.basePricePerBet = isAppended ? 3 : 2;
  }

  calculateBets(selectedReds: number, selectedBlues: number): number {
    if (!this.isValidSelection(selectedReds, selectedBlues)) return 0;
    return C(selectedReds, 5) * C(selectedBlues, 2);
  }

  isValidSelection(selectedReds: number, selectedBlues: number): boolean {
    return selectedReds >= 5 && selectedBlues >= 2;
  }
}

class DigitalStrategy implements PlayStrategy {
  constructor(
    public playName: string,
    public basePricePerBet: number,
    private requiredSelections: number
  ) {}

  calculateBets(selectedReds: number, selectedBlues: number): number {
    if (!this.isValidSelection(selectedReds, selectedBlues)) return 0;
    return 1; // Simplified for digital lotteries for now
  }

  isValidSelection(selectedReds: number, selectedBlues: number): boolean {
    return selectedReds >= this.requiredSelections;
  }
}

const getStrategy = (config: LotteryConfig, isDltExtra: boolean): PlayStrategy => {
  if (config.id === 'DLT') return new DLTExtraStrategy(isDltExtra);
  if (['FC3D', 'PL3', 'QXC'].includes(config.id)) {
    return new DigitalStrategy(config.name, 2, config.red.count);
  }
  return new StandardStrategy(config.name, 2, config.red.count, config.blue.count);
};

const getGradient = (type: 'red' | 'blue', id?: LotteryId | null) => {
  if (id === 'FC3D') return 'radial-gradient(circle at 30% 30%, #a4d2f9, #5e9ddc)'; // 3D is blue
  if (id === 'QLC') return 'radial-gradient(circle at 30% 30%, #fbd56e, #d4a024)'; // QLC is yellow
  if (type === 'blue') return 'radial-gradient(circle at 30% 30%, #7db8f1, #3b5998)'; // Default blue
  return 'radial-gradient(circle at 30% 30%, #f67a6c, #c0392b)'; // Default red
};

const generateUniqueNumbers = (config: LotteryConfig, history: any[]) => {
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

  const historySet = new Set((history || []).map(item => {
    const redsStr = item.reds.map((n: number) => formatNum(n, config.red.max)).join(',');
    const bluesStr = item.blues.map((n: number) => formatNum(n, config.blue.max)).join(',');
    return `${redsStr}|${bluesStr}`;
  }));

  let newCombination = "";
  let reds: number[] = [];
  let blues: number[] = [];
  
  do {
    reds = getSet(config.red.max, config.red.count, !!config.red.allowDuplicate, zeroRed);
    blues = getSet(config.blue.max, config.blue.count, !!config.blue.allowDuplicate, zeroBlue);
    
    const redsStr = reds.map(n => formatNum(n, config.red.max)).join(',');
    const bluesStr = blues.map(n => formatNum(n, config.blue.max)).join(',');
    
    newCombination = `${redsStr}|${bluesStr}`;
  } while (historySet.has(newCombination));

  return { reds, blues };
};

const generateMockResults = () => {
  const results: Record<string, any[]> = {};
  LOTTERIES.forEach(config => {
    results[config.id] = Array.from({ length: 60 }, (_, i) => ({
      issue: `2023${(120 - i).toString().padStart(3, '0')}`,
      date: new Date(Date.now() - i * 86400000 * (config.id === 'SSQ' ? 2 : 1)).toISOString().split('T')[0],
      ...generateUniqueNumbers(config, [])
    }));
  });
  return results;
};
const MOCK_RESULTS = generateMockResults();

const fetchSporttery = async (gameNo: string, pageNo: number = 1, pageSize: number = 100) => {
  const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=${pageSize}&isVerify=1&pageNo=${pageNo}`;
  try {
    const response = await CapacitorHttp.request({ url, method: 'GET' });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data?.value?.list) throw new Error('Invalid Sporttery data');
    return data.value.list.map((item: any) => {
      const nums = item.lotteryDrawResult.split(' ');
      let reds: number[] = [];
      let blues: number[] = [];
      if (gameNo === '85') { reds = nums.slice(0, 5).map(Number); blues = nums.slice(5, 7).map(Number); }
      else if (gameNo === '35') { reds = nums.slice(0, 3).map(Number); }
      else if (gameNo === '04') { reds = nums.slice(0, 6).map(Number); blues = nums.slice(6, 7).map(Number); }
      return {
        issue: item.lotteryDrawNum,
        date: String(item.lotteryDrawTime).split(' ')[0] || item.lotteryDrawTime,
        pool: item.poolBalanceAfterdraw || item.poolBalance || '',
        reds,
        blues
      };
    });
  } catch (e) {
    console.warn(`Fetch Sporttery ${gameNo} failed`, e);
    throw e;
  }
};

const fetchCWL = async (name: string, pageNo: number = 1, pageSize: number = 100) => {
  const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${name}&pageNo=${pageNo}&pageSize=${pageSize}`;
  try {
    const response = await CapacitorHttp.request({ 
      url, 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data?.result) throw new Error('Invalid CWL data');
    return data.result.map((item: any) => {
      let reds: number[] = [];
      let blues: number[] = [];
      if (item.red) reds = item.red.split(',').map(Number);
      if (item.blue) blues = item.blue.split(',').map(Number);
      return {
        issue: item.code,
        date: String(item.date).split(' ')[0] || item.date,
        pool: item.poolmoney || '',
        reds,
        blues
      };
    });
  } catch (e) {
    console.warn(`Fetch CWL ${name} failed`, e);
    throw e;
  }
};

export const fetchRealData = async (id: LotteryId, page: number = 1, pageSize: number = 100) => {
  try {
    if (id === 'DLT') return await fetchSporttery('85', page, pageSize);
    if (id === 'PL3') return await fetchSporttery('35', page, pageSize);
    if (id === 'QXC') return await fetchSporttery('04', page, pageSize);
    
    if (id === 'SSQ') return await fetchCWL('ssq', page, pageSize);
    if (id === 'FC3D') return await fetchCWL('3d', page, pageSize);
    if (id === 'QLC') return await fetchCWL('qlc', page, pageSize);
  } catch (e) {
    console.log(`Failed to fetch ${id} page ${page}`);
    return [];
  }
  return [];
};

// --- Components ---
// Ball image paths based on official lottery colors
// 红redCircle 蓝blueCircle 黄yellowCircle 紫purpleCircle 粉pinkCircle
// 双色球(SSQ): 红+蓝, 大乐透(DLT): 蓝+黄
// 福彩3D(FC3D): 紫, 排列3(PL3): 粉
// 七乐彩(QLC): 红+蓝, 七星彩(QXC): 蓝+黄
const getBallImage = (color: 'red' | 'blue', lotteryId?: LotteryId | null): string => {
  switch (lotteryId) {
    case 'SSQ': // 双色球：红球 + 蓝球
      return color === 'red' ? './balls/redCircle.png' : './balls/blueCircle.png';
    case 'DLT': // 大乐透：蓝球 + 黄球
      return color === 'red' ? './balls/blueCircle.png' : './balls/yellowCircle.png';
    case 'QLC': // 七乐彩：红球 + 蓝球
      return color === 'red' ? './balls/redCircle.png' : './balls/blueCircle.png';
    case 'QXC': // 七星彩：前6蓝球 + 后1黄球
      return color === 'red' ? './balls/blueCircle.png' : './balls/yellowCircle.png';
    case 'FC3D': // 福彩3D：紫球
      return './balls/purpleCircle.png';
    case 'PL3': // 排列3：粉球
      return './balls/pinkCircle.png';
    default:
      return color === 'red' ? './balls/redCircle.png' : './balls/blueCircle.png';
  }
};

const Ball: React.FC<{ num: number, color: 'red' | 'blue', max: number, lotteryId?: LotteryId }> = ({ num, color, max, lotteryId }) => {
  const ballImg = getBallImage(color, lotteryId);
  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 z-10"
        style={{
          backgroundImage: `url(${ballImg})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <span className="relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', fontSize: '16px', lineHeight: '40px' }}>{formatNum(num, max)}</span>
      </motion.div>
    </div>
  );
};

const ResultCard: React.FC<{ lottery: LotteryConfig, result: any }> = ({ lottery, result }) => {
  return (
    <div className="bg-[#fcfdfd] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-none sm:rounded-xl p-3 w-full flex flex-row items-center sm:items-stretch shadow-sm">
      {/* Name on the left */}
      <div className="w-16 sm:w-20 flex-shrink-0 flex items-center justify-center font-bold text-[#6287ba] text-base sm:text-lg border-r border-gray-100 dark:border-slate-800">
        {lottery.name}
      </div>

      <div className="flex-1 px-3 sm:px-4 flex flex-col justify-center">
         <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-xs sm:text-sm text-gray-800 dark:text-gray-100 ">
           <span className="font-medium whitespace-nowrap">第{result.issue}期</span>
           {result.pool && <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">奖池累计金额：<span className="text-[#c0392b] font-bold">￥{result.pool}元</span></span>}
         </div>
         <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {result.reds.map((n: number, i: number) => (
              <div key={`r-${i}`} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white flex items-center justify-center font-bold text-[11px] sm:text-xs" style={{ backgroundImage: `url(${getBallImage('red', lottery.id)})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
                <span style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>{formatNum(n, lottery.red.max)}</span>
              </div>
            ))}
            {result.blues.map((n: number, i: number) => (
              <div key={`b-${i}`} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white flex items-center justify-center font-bold text-[11px] sm:text-xs" style={{ backgroundImage: `url(${getBallImage('blue', lottery.id)})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
                <span style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>{formatNum(n, lottery.blue.max)}</span>
              </div>
            ))}
         </div>
      </div>

      {lottery.schedule && (
        <div className="hidden sm:flex w-36 flex-shrink-0 flex-col justify-center text-xs text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-slate-800 pl-4 py-1">
          <div className="mb-2 whitespace-nowrap">{lottery.schedule}</div>
          <div className="flex gap-2 text-[#6287ba]">
             <span className="cursor-pointer hover:underline">详情</span>
             <span className="cursor-pointer hover:underline">往期</span>
             <span className="cursor-pointer hover:underline">往期视频</span>
          </div>
        </div>
      )}
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
const HomeView = ({ onNavigate, resultsData }: { onNavigate: (tab: string, id?: LotteryId) => void, resultsData: Record<string, any[]> }) => {
  return (
    <div className="pb-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 pt-[calc(env(safe-area-inset-top,55px)+45px)] pb-16 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Trophy size={200} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 relative z-10">彩票助手</h1>
        <p className="text-red-100 text-sm relative z-10">理性购彩，量力而行。公益体彩，乐善人生。</p>
      </div>

      {/* Quick Access Grid */}
      <div className="px-4 -mt-8 relative z-20">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 grid grid-cols-2 gap-4">
          {LOTTERIES.slice(0, 4).map(lottery => (
            <div
              key={lottery.id}
              onClick={() => onNavigate('pick', lottery.id)}
              className={`p-4 rounded-xl cursor-pointer transition-transform active:scale-95 bg-gradient-to-br ${THEME_CLASSES[lottery.theme].lightBg} border border-white`}
            >
              <div className="flex justify-between items-start mb-2">
                {lottery.icon ? (
                  <div className="w-11 h-11 flex items-center justify-center bg-white/60 dark:bg-black/20 rounded-xl overflow-hidden drop-shadow-sm">
                    <img src={lottery.icon} alt={lottery.name} className="w-8 h-8 object-contain" />
                  </div>
                ) : (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md text-white ${THEME_CLASSES[lottery.theme].bg}`}>
                    {lottery.org}
                  </span>
                )}
                <ChevronRight size={16} className={THEME_CLASSES[lottery.theme].text} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 ">{lottery.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{lottery.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Results Preview */}
      <div className="mt-8 px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 ">最新开奖</h2>
          <button onClick={() => onNavigate('results')} className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 flex items-center">
            查看更多 <ChevronRight size={16} />
          </button>
        </div>
        <div className="space-y-0 sm:space-y-3 divide-y divide-gray-100 dark:divide-slate-800 sm:divide-y-0 border-y sm:border-0 border-gray-200 dark:border-slate-700">
          {resultsData['SSQ']?.[0] ? <ResultCard lottery={LOTTERIES[0]} result={resultsData['SSQ'][0]} /> : <div className="p-4 m-4 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-pulse">正在加载双色球数据...</div>}
          {resultsData['DLT']?.[0] ? <ResultCard lottery={LOTTERIES[1]} result={resultsData['DLT'][0]} /> : <div className="p-4 m-4 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-pulse">正在加载大乐透数据...</div>}
        </div>
      </div>
    </div>
  );
};

const PickView = ({ selectedLotteryId, onSelectLottery, onSave, resultsData }: { selectedLotteryId: LotteryId, onSelectLottery: (id: LotteryId) => void, onSave: (id: LotteryId, sets: any[]) => void, resultsData: Record<string, any[]> }) => {
  const config = LOTTERIES.find(l => l.id === selectedLotteryId)!;
  const [sets, setSets] = useState<{reds: number[], blues: number[]}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Manual Pick State
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [manualReds, setManualReds] = useState<number[]>([]);
  const [manualBlues, setManualBlues] = useState<number[]>([]);
  const [isDltExtra, setIsDltExtra] = useState(false); // For DLT 追加

  useEffect(() => {
    setManualReds([]);
    setManualBlues([]);
    setSets([]);
    setIsDltExtra(false);
  }, [selectedLotteryId, mode]);

  const currentStrategy = React.useMemo(() => getStrategy(config, isDltExtra), [config, isDltExtra]);
  
  const combinations = mode === 'manual' ? currentStrategy.calculateBets(manualReds.length, manualBlues.length) : 0;
  const totalCost = combinations * currentStrategy.basePricePerBet;

  const handleToggleManual = (type: 'red' | 'blue', num: number) => {
    if (['FC3D', 'PL3', 'QXC'].includes(config.id)) {
      // Simplified manual pick for these types not fully supported in this demo
      return; 
    }
    if (type === 'red') {
      setManualReds(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a,b)=>a-b));
    } else {
      setManualBlues(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a,b)=>a-b));
    }
  };

  const handleGenerate = (count: number) => {
    setIsGenerating(true);
    setTimeout(() => {
      const history = resultsData[config.id] || [];
      const newSets = Array.from({ length: count }, () => generateUniqueNumbers(config, history));
      setSets(prev => [...newSets, ...prev].slice(0, 10)); // Keep max 10 in view
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 ">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 pt-[calc(env(safe-area-inset-top,55px)+36px)] pb-4 px-4 shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100 mb-4">智能机选</h1>
        {/* Lottery Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {LOTTERIES.map(l => (
            <button
              key={l.id}
              onClick={() => { onSelectLottery(l.id); setSets([]); }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${l.id === selectedLotteryId ? THEME_CLASSES[l.theme].pillActive : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
        
        {/* Mode Selector */}
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1 mx-2 mb-2 mt-2">
          <button onClick={() => setMode('smart')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'smart' ? 'bg-white dark:bg-slate-900 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>智能机选</button>
          <button onClick={() => setMode('manual')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-900 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>手选 / 复式</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {mode === 'manual' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
            {['FC3D', 'PL3', 'QXC'].includes(config.id) ? (
              <div className="text-center text-gray-400 dark:text-gray-500 py-10">数字型彩票手选功能开发中...</div>
            ) : (
              <>
                 <div className="mb-4">
                    <div className="flex justify-between items-end mb-2">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 ">红球区</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">至少选 {config.red.count} 个</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({length: config.red.max}, (_, i) => i + 1).map(n => {
                        const isSelected = manualReds.includes(n);
                        return (
                          <button key={`m-r-${n}`} onClick={() => handleToggleManual('red', n)} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm border ${isSelected ? 'text-white border-transparent' : 'bg-[#f8f9fa] dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`} style={isSelected ? { background: getGradient('red', config.id) } : {}}>
                            {formatNum(n, config.red.max)}
                          </button>
                        )
                      })}
                    </div>
                 </div>

                 {config.blue.count > 0 && (
                   <div>
                      <div className="flex justify-between items-end mb-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 ">蓝球区</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">至少选 {config.blue.count} 个</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({length: config.blue.max}, (_, i) => i + 1).map(n => {
                          const isSelected = manualBlues.includes(n);
                          return (
                            <button key={`m-b-${n}`} onClick={() => handleToggleManual('blue', n)} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm border ${isSelected ? 'text-white border-transparent' : 'bg-[#f8f9fa] dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`} style={isSelected ? { background: getGradient('blue', config.id) } : {}}>
                              {formatNum(n, config.blue.max)}
                            </button>
                          )
                        })}
                      </div>
                   </div>
                 )}
                 
                 {config.id === 'DLT' && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                       <span className="text-sm font-bold text-gray-700 dark:text-gray-200">追加投注 (3元/注)</span>
                       <button onClick={() => setIsDltExtra(!isDltExtra)} className={`w-12 h-6 rounded-full p-1 transition-colors ${isDltExtra ? 'bg-blue-500' : 'bg-gray-200'}`}>
                         <div className={`w-4 h-4 rounded-full bg-white dark:bg-slate-900 transition-transform ${isDltExtra ? 'translate-x-6' : 'translate-x-0'}`}></div>
                       </button>
                    </div>
                 )}
              </>
            )}
          </div>
        ) : (
          <AnimatePresence>
          {sets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500"
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
                className="bg-white dark:bg-slate-900 rounded-2xl py-3 px-3 sm:p-4 shadow-sm border border-gray-100 dark:border-slate-800 relative overflow-hidden flex items-center w-full"
              >
                {/* Decorative background number */}
                <div className="absolute right-0 -mr-2 text-7xl font-black text-gray-50 dark:text-gray-800 opacity-60 select-none pointer-events-none">
                  {idx + 1}
                </div>
                <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 relative z-10 w-full overflow-x-auto hide-scrollbar py-0.5">
                  {set.reds.map((n, i) => (
                    <Ball key={`r-${idx}-${i}`} num={n} color="red" max={config.red.max} lotteryId={config.id} />
                  ))}
                  {set.blues.map((n, i) => (
                    <Ball key={`b-${idx}-${i}`} num={n} color="blue" max={config.blue.max} lotteryId={config.id} />
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 p-4 pb-safe flex flex-col gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {mode === 'manual' && !['FC3D', 'PL3', 'QXC'].includes(config.id) && (
          <div className="flex justify-between items-center px-1">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-bold mr-2 text-gray-800 dark:text-gray-100 ">{currentStrategy.playName}</span>
              已选 <span className="text-red-500 font-bold">{manualReds.length}</span>红 
              {config.blue.count > 0 && <> <span className="text-blue-500 font-bold">{manualBlues.length}</span>蓝</>}
            </div>
            <div className="text-sm">
              共 <span className="font-bold text-gray-800 dark:text-gray-100 ">{combinations}</span> 注，
              <span className="font-bold text-[#c0392b] text-base">{totalCost}</span> <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs">元</span>
            </div>
          </div>
        )}

        {mode === 'manual' ? (
          <div className="flex gap-3">
            <button
              onClick={() => { setManualReds([]); setManualBlues([]); }}
              className="w-16 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 py-3.5 rounded-xl font-bold flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              清空
            </button>
            <button
              disabled={combinations === 0}
              onClick={() => {
                onSave(config.id, [{ reds: manualReds, blues: manualBlues }]);
                setManualReds([]); setManualBlues([]);
              }}
              style={combinations > 0 ? { background: getGradient(config.theme, config.id) } : {}}
              className={`flex-1 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${combinations === 0 ? 'bg-gray-300 opacity-50 cursor-not-allowed text-white/70' : 'hover:opacity-90 active:scale-[0.98]'}`}
            >
              <Save size={18} />
              保存到号码本
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleGenerate(1)}
              disabled={isGenerating}
              className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition-colors"
            >
              <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
              机选1注
            </button>
            <button
              onClick={() => handleGenerate(5)}
              disabled={isGenerating}
              style={{ background: getGradient(config.theme, config.id) }}
              className={`flex-1 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all`}
            >
              <Sparkles size={18} />
              机选5注
            </button>
            {sets.length > 0 && (
              <>
                <button
                  onClick={() => setSets([])}
                  className="w-14 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl flex items-center justify-center active:scale-[0.98] transition-all"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => {
                    onSave(config.id, sets);
                    setSets([]);
                  }}
                  className="w-14 bg-[#5eb47d] text-white rounded-xl flex items-center justify-center shadow-md hover:bg-[#4ea26c] active:scale-[0.98] transition-all"
                >
                  <Save size={20} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ResultsView = ({ resultsData }: { resultsData: Record<string, any[]> }) => {
  const [selectedLottery, setSelectedLottery] = useState<LotteryId>('SSQ');
  const [visibleCount, setVisibleCount] = useState(20);
  const config = LOTTERIES.find(l => l.id === selectedLottery)!;
  const results = resultsData[selectedLottery] || [];
  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  const handleChangeLottery = (id: LotteryId) => {
    setSelectedLottery(id);
    setVisibleCount(20); // Reset pagination when switching lottery
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 ">
      <div className="bg-white dark:bg-slate-900 pt-[calc(env(safe-area-inset-top,55px)+36px)] pb-4 px-4 shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100 mb-4">历史开奖</h1>
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {LOTTERIES.map(l => (
            <button
              key={l.id}
              onClick={() => handleChangeLottery(l.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${l.id === selectedLottery ? THEME_CLASSES[l.theme].pillActive : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#f5f5f5] dark:bg-slate-950 p-0 sm:p-4 space-y-0 sm:space-y-3">
        {results.length === 0 ? (
           <div className="p-8 m-4 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-pulse">正在加载历史数据...</div>
        ) : (
          <div className="flex flex-col border-y sm:border-0 border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 sm:divide-y-0">
            {visibleResults.map((res, idx) => (
              <ResultCard key={res.issue || idx} lottery={config} result={res} />
            ))}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 30)}
                  className="px-6 py-2.5 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium shadow-sm border border-gray-200 dark:border-slate-700 active:scale-95 transition-all"
                >
                  加载更多（已显示 {visibleCount}/{results.length} 期）
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MineView = ({ savedTickets, onDeleteTicket, onSaveTicket, resultsData }: { savedTickets: SavedTicket[], onDeleteTicket: (id: string) => void, onSaveTicket: (id: LotteryId, sets: any[], dateOverride?: string) => void, resultsData: Record<string, any[]> }) => {
  const getMatchingResult = (ticket: SavedTicket, results: any[]) => {
    if (!results || results.length === 0) return null;
    const purchaseTime = new Date(ticket.date).getTime();
    
    let validResult = null;
    // Results are sorted newest first. Loop from oldest to newest to find FIRST draw after purchase
    for (let i = results.length - 1; i >= 0; i--) {
      const res = results[i];
      const drawDateString = res.date.includes(' ') ? res.date.split(' ')[0] : res.date;
      // Assuming draws happen at 21:00 or 21:30. Set to 21:30 local time.
      const drawTime = new Date(`${drawDateString}T21:30:00+08:00`).getTime();
      
      // We check the FIRST draw that happened strictly AFTER the exact time of purchase
      if (drawTime > purchaseTime) {
        validResult = res;
        break; 
      }
    }
    return validResult;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 ">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 pt-[calc(env(safe-area-inset-top,55px)+45px)] pb-6 px-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white dark:bg-slate-900 /10 rounded-full flex items-center justify-center border-2 border-white/20">
            <User size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">我的号码本</h1>
            <p className="text-slate-300 text-sm mt-1">共保存 {savedTickets.length} 组号码</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 -mt-4 relative z-10 space-y-4">
        {/* Donation Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">“锦鲤”充电站</h2>
            <Sparkles size={20} className="text-yellow-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 px-2">
            给开发者充个电，祝你早日脱非入欧，喜中头奖！到时候别忘了回来还愿哦。
          </p>
          <div className="w-40 h-40 bg-gray-50 rounded-xl overflow-hidden p-2 border border-gray-100 dark:border-slate-700">
            <img src="./icons/qr1.jpg" alt="Donation QR Code" className="w-full h-full object-contain rounded-lg shadow-inner" />
          </div>
        </div>

        {savedTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <History size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">暂无保存的号码</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">去选号页面生成并保存吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedTickets.map(ticket => {
              const config = LOTTERIES.find(l => l.id === ticket.lotteryId)!;
              const matchingResult = getMatchingResult(ticket, resultsData[ticket.lotteryId] || []);
              
              // Helper to check if a specific number was drawn
              const isHit = (n: number, type: 'red' | 'blue') => {
                if (!matchingResult) return false;
                if (type === 'red' && matchingResult.reds.includes(n)) return true;
                if (type === 'blue' && matchingResult.blues.includes(n)) return true;
                return false;
              };

              return (
                <div key={ticket.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${THEME_CLASSES[config.theme].bg}`}></span>
                        <span className="font-bold text-gray-800 dark:text-gray-100 ">{config.name}</span>
                        {!matchingResult ? (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">等待开奖</span>
                        ) : (
                          <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium">已对奖 (第{matchingResult.issue}期)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 flex flex-col sm:flex-row sm:gap-4">
                        <span>购买时间: {new Date(ticket.date).toLocaleString()}</span>
                        {matchingResult && <span>开奖日期: {matchingResult.date.split(' ')[0]}</span>}
                      </div>
                    </div>
                    <button onClick={() => onDeleteTicket(ticket.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-2 -mr-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {ticket.numbers.map((set, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50/50 dark:bg-slate-800/20 rounded-xl relative">
                        {/* 注数序号 */}
                        <div className="text-[10px] font-bold text-gray-300 dark:text-gray-600 w-4 text-center mr-1">{idx + 1}</div>
                        
                        {set.reds.map((n, i) => {
                          const hit = isHit(n, 'red');
                          return (
                            <div key={`r-${idx}-${i}`} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                              ${hit ? 'bg-red-500 text-white shadow-md' : (matchingResult ? 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-600 opacity-50' : 'bg-red-50 text-red-600 border justify-center border-red-100')}`}
                            >
                              {formatNum(n, config.red.max)}
                            </div>
                          );
                        })}
                        
                        {set.blues.map((n, i) => {
                          const hit = isHit(n, 'blue');
                          return (
                            <div key={`b-${idx}-${i}`} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                              ${hit ? 'bg-blue-500 text-white shadow-md' : (matchingResult ? 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-600 opacity-50' : 'bg-blue-50 text-blue-600 border border-blue-100')}`}
                            >
                              {formatNum(n, config.blue.max)}
                            </div>
                          );
                        })}
                        
                        {/* 如果全部对奖完成，显示是否命中 */}
                        {matchingResult && (
                           <div className="absolute right-3 opacity-60">
                              <CheckCircle2 size={16} className={set.reds.some(n => isHit(n, 'red')) || set.blues.some(n => isHit(n, 'blue')) ? 'text-emerald-500' : 'text-gray-300'} />
                           </div>
                        )}
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
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [pickLotteryId, setPickLotteryId] = useState<LotteryId>('SSQ');
  const [resultsData, setResultsData] = useState<Record<string, any[]>>({});
  
  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>(() => {
    try {
      const saved = localStorage.getItem('lottery_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [toast, setToast] = useState({ visible: false, message: '' });

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<{ x: number, y: number, time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('.overflow-x-auto')) return;
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY, time: Date.now() });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);
    const timeDiff = Date.now() - touchStart.time;
    
    setTouchStart(null);

    // Ignore mostly vertical swipes or long presses
    if (timeDiff > 600 || distanceY > Math.abs(distanceX)) return;

    const tabIds = NAV_ITEMS.map(i => i.id);
    const currentIdx = tabIds.indexOf(activeTab);

    if (distanceX > 40 && currentIdx < tabIds.length - 1) {
      // Swipe Left -> Next
      setActiveTab(tabIds[currentIdx + 1]);
      if (tabIds[currentIdx + 1] === 'pick' && pickLotteryId) setPickLotteryId(pickLotteryId);
    } else if (distanceX < -40 && currentIdx > 0) {
      // Swipe Right -> Prev
      setActiveTab(tabIds[currentIdx - 1]);
      if (tabIds[currentIdx - 1] === 'pick' && pickLotteryId) setPickLotteryId(pickLotteryId);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Initial Data Fetching & Caching strategy
  useEffect(() => {
    // 1. Instantly load from localStorage (zero network, zero lag)
    let cachedData: Record<string, any[]> = {};
    try {
      const stored = localStorage.getItem('lottery_history_data');
      if (stored) cachedData = JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse cached history data');
    }

    // 2. Set state immediately from cache — page renders instantly
    if (Object.keys(cachedData).length > 0) {
      setResultsData(cachedData); 
    }

    // 3. Background network fetch — does NOT block page rendering
    const fetchLatestInBackground = async () => {
      const latestDataMapping: Record<string, any[]> = { ...cachedData };
      let hasUpdates = false;

      // Fetch each lottery sequentially with small delay to avoid burst requests
      for (const l of LOTTERIES) {
        try {
          const fetched = await fetchRealData(l.id, 1, 20);
          if (fetched && fetched.length > 0) {
            const existingList = latestDataMapping[l.id] || [];
            const combinedMap = new Map();
            existingList.forEach((item: any) => combinedMap.set(item.issue, item));
            fetched.forEach((item: any) => combinedMap.set(item.issue, item));
            
            const mergedList = Array.from(combinedMap.values()).sort((a, b) => {
              return String(b.issue).localeCompare(String(a.issue));
            });

            latestDataMapping[l.id] = mergedList;
            hasUpdates = true;
          }
        } catch (e) {
          console.error(`Error updating data for ${l.id}`, e);
        }
        // Small delay between each request to avoid overwhelming
        await new Promise(r => setTimeout(r, 300));
      }

      // 4. Silently update state and save to storage
      if (hasUpdates) {
        setResultsData(latestDataMapping);
        localStorage.setItem('lottery_history_data', JSON.stringify(latestDataMapping));
      }

      // 5. Background Sync: if we haven't completed history sync, fetch all past pages quietly
      const syncHistoricalData = async () => {
        let isUpdated = false;
        let dataMap = { ...latestDataMapping }; // copy
        
        for (const l of LOTTERIES) {
          if (['FC3D', 'PL3', 'PL5'].includes(l.id)) continue;

          // Check if we permanently marked this lottery as fully synced
          const syncKey = `lottery_synced_full_${l.id}`;
          if (localStorage.getItem(syncKey) === 'true') continue;
          
          let pageNo = 2;
          let emptyCount = 0;
          let newRecordsCount = 0;
          
          while (emptyCount < 2 && pageNo <= 100) { // Protect against infinite loop, max ~10,000 records (enough for decades of history)
            try {
              // Always fetch history with pageSize=100
              const fetched = await fetchRealData(l.id, pageNo, 100);
              if (fetched && fetched.length > 0) {
                const combinedMap = new Map();
                (dataMap[l.id] || []).forEach((item: any) => combinedMap.set(item.issue, item));
                
                let newlyAddedCount = 0;
                fetched.forEach((item: any) => {
                   if (!combinedMap.has(item.issue)) {
                       newlyAddedCount++;
                   }
                   combinedMap.set(item.issue, item);
                });
                
                dataMap[l.id] = Array.from(combinedMap.values()).sort((a, b) => String(b.issue).localeCompare(String(a.issue)));
                
                if (newlyAddedCount > 0) {
                   isUpdated = true;
                   newRecordsCount += newlyAddedCount;
                   emptyCount = 0; // reset
                } else {
                   // If we pulled 100 items but ALL were already in our DB, we've likely hit the bottom
                   emptyCount++;
                }
              } else {
                emptyCount++; // end of data or error
              }
            } catch (e) {
               emptyCount++;
            }
            pageNo++;
            await new Promise(r => setTimeout(r, 1500));
            
            if (isUpdated && pageNo % 5 === 0) {
               setResultsData({ ...dataMap });
               localStorage.setItem('lottery_history_data', JSON.stringify(dataMap));
            }
          }
          
          // Once the while loop ends, it means we reached the earliest recorded page or hit rate limits
          // We mark it as fully synced so it never slows down startup again
          localStorage.setItem(syncKey, 'true');
        }
        
        // Final save
        if (isUpdated) {
          setResultsData({ ...dataMap });
          localStorage.setItem('lottery_history_data', JSON.stringify(dataMap));
        }
      };

      // Fire and forget background sync for deep history
      setTimeout(syncHistoricalData, 5000);

    };

    // Fire-and-forget: network fetch runs in background, does NOT block page render
    fetchLatestInBackground();
  }, []);

  useEffect(() => {
    localStorage.setItem('lottery_tickets', JSON.stringify(savedTickets));
  }, [savedTickets]);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  const handleSaveTicket = (lotteryId: LotteryId, numbers: {reds: number[], blues: number[]}[], dateOverride?: string) => {
    const newTicket: SavedTicket = {
      id: Math.random().toString(36).substring(7),
      lotteryId,
      date: dateOverride ? dateOverride : new Date().toISOString(),
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
    { id: 'sports', icon: Dribbble, label: '竞彩' },
    { id: 'results', icon: Trophy, label: '开奖' },
    { id: 'mine', icon: User, label: '我的' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-black flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 min-h-screen shadow-2xl relative flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {showSplash ? (
            <SplashScreen key="splash" />
          ) : (
            <motion.div
              key="main-app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full flex flex-col absolute inset-0"
            >
              {/* Content Area */}
              <div 
                className="flex-1 overflow-hidden relative"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    {activeTab === 'home' && <HomeView onNavigate={(tab, id) => { if (id) setPickLotteryId(id); setActiveTab(tab); }} resultsData={resultsData} />}
                    {activeTab === 'pick' && <PickView selectedLotteryId={pickLotteryId} onSelectLottery={setPickLotteryId} onSave={handleSaveTicket} resultsData={resultsData} />}
                    {activeTab === 'sports' && <SportsView />}
                    {activeTab === 'results' && <ResultsView resultsData={resultsData} />}
                    {activeTab === 'mine' && <MineView savedTickets={savedTickets} onDeleteTicket={handleDeleteTicket} onSaveTicket={handleSaveTicket} resultsData={resultsData} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom Navigation */}
              <nav className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-around items-center h-16 pb-safe z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors
                        ${isActive ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300'}`}
                    >
                      <Icon size={24} className={isActive ? 'fill-blue-50 text-blue-600' : ''} />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Global Toast */}
              <Toast message={toast.message} visible={toast.visible} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
