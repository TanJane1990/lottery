import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Dices, Trophy, User, ChevronRight, RefreshCw, Save, Trash2, History, Sparkles, CheckCircle2, Dribbble, ScanLine, MessageSquare, Settings, Headphones, Wallet, Ticket, Gift, CreditCard, Clock, CheckCircle, Bell, Grid, FileText, Smartphone, Crown, ShieldCheck, LineChart, BookOpen, Calculator, MapPin, XCircle, Star, X } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
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
  multiplier?: number;
  isDltExtra?: boolean;
}

const pickViewStateCache = {
  selectedLotteryId: '' as string,
  mode: 'smart' as 'smart' | 'manual',
  sets: [] as any[],
  manualReds: [] as number[],
  manualBlues: [] as number[],
  multiplier: 1 as number,
  isDltExtra: false as boolean,
};

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
  { id: 'QLC', name: '七乐彩', org: '福彩', theme: 'red', red: { max: 30, count: 7 }, blue: { max: 0, count: 0 }, desc: '百万大奖等你拿', icon: '/icons/QLC.png', schedule: '每周一、三、五开奖' },
  { id: 'QXC', name: '七星彩', org: '体彩', theme: 'blue', red: { max: 9, count: 6, allowDuplicate: true }, blue: { max: 14, count: 1 }, desc: '经典玩法，惊喜不断', icon: '/icons/QXC.png', schedule: '每周二、五、日开奖' },
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
    <div className="pb-2">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 pt-[calc(env(safe-area-inset-top,20px)+30px)] pb-10 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Trophy size={200} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 relative z-10">彩票助手</h1>
        <p className="text-red-100 text-sm relative z-10">理性购彩，量力而行。公益体彩，乐善人生。</p>
      </div>

      {/* Quick Access Grid */}
      <div className="px-4 -mt-4 relative z-20">
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

const PickView = ({ selectedLotteryId, onSelectLottery, onSave, resultsData }: { selectedLotteryId: LotteryId, onSelectLottery: (id: LotteryId) => void, onSave: (id: LotteryId, sets: any[], multiplier?: number, isDltExtra?: boolean) => void, resultsData: Record<string, any[]> }) => {
  const config = LOTTERIES.find(l => l.id === selectedLotteryId)!;
  const isSameLottery = pickViewStateCache.selectedLotteryId === selectedLotteryId;
  const [sets, setSets] = useState<any[]>(isSameLottery ? pickViewStateCache.sets : []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [multiplier, setMultiplier] = useState(isSameLottery ? pickViewStateCache.multiplier : 1);
  
  // Manual Pick State
  const [mode, setMode] = useState<'smart' | 'manual'>(isSameLottery ? pickViewStateCache.mode : 'smart');
  const [manualReds, setManualReds] = useState<number[]>(isSameLottery ? pickViewStateCache.manualReds : []);
  const [manualBlues, setManualBlues] = useState<number[]>(isSameLottery ? pickViewStateCache.manualBlues : []);
  const [isDltExtra, setIsDltExtra] = useState(isSameLottery ? pickViewStateCache.isDltExtra : false); // For DLT 追加

  useEffect(() => {
    pickViewStateCache.selectedLotteryId = selectedLotteryId;
    pickViewStateCache.mode = mode;
    pickViewStateCache.sets = sets;
    pickViewStateCache.manualReds = manualReds;
    pickViewStateCache.manualBlues = manualBlues;
    pickViewStateCache.multiplier = multiplier;
    pickViewStateCache.isDltExtra = isDltExtra;
  }, [selectedLotteryId, mode, sets, manualReds, manualBlues, multiplier, isDltExtra]);

  const prevLotteryId = React.useRef(selectedLotteryId);
  const prevMode = React.useRef(mode);
  useEffect(() => {
    if (prevLotteryId.current !== selectedLotteryId || prevMode.current !== mode) {
      setManualReds([]);
      setManualBlues([]);
      setSets([]);
      setIsDltExtra(false);
      prevLotteryId.current = selectedLotteryId;
      prevMode.current = mode;
    }
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
      const newSets = Array.from({ length: count }, () => {
        return { ...generateUniqueNumbers(config, history), id: Math.random().toString(36).substring(7) };
      });
      setSets(prev => [...newSets, ...prev].slice(0, 10)); // Keep max 10 in view
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 ">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 pt-[calc(env(safe-area-inset-top,44px)+12px)] pb-3 px-4 shadow-sm z-10 sticky top-0">
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
              <div key={set.id || idx} className="relative w-full overflow-hidden rounded-2xl">
                 <div className="absolute inset-y-0 right-0 w-24 bg-red-500 rounded-r-2xl flex items-center justify-end pr-5">
                    <button onClick={() => setSets(prev => prev.filter(s => (s.id ? s.id !== set.id : prev.indexOf(s) !== idx)))} className="text-white flex flex-col items-center">
                       <Trash2 size={20} strokeWidth={2} />
                       <span className="text-[10px] tracking-wider mt-1 opacity-90 font-bold">删除</span>
                    </button>
                 </div>
                 
                 <motion.div
                   drag="x"
                   dragConstraints={{ left: -72, right: 0 }}
                   dragElastic={0.1}
                   dragMomentum={false}
                   dragDirectionLock={true}
                   style={{ willChange: 'transform' }}
                   className="prevent-swipe bg-white dark:bg-slate-900 rounded-2xl py-3 px-3 sm:p-4 shadow-sm border border-gray-100 dark:border-slate-800 relative z-10 overflow-hidden flex items-center w-full touch-pan-y"
                 >
                   {/* Decorative background number */}
                   <div className="absolute right-0 -mr-2 text-7xl font-black text-gray-50 dark:text-gray-800 opacity-60 select-none pointer-events-none">
                     {idx + 1}
                   </div>
                   <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 relative z-10 w-full py-0.5 pointer-events-none">
                     {set.reds.map((n: number, i: number) => (
                       <Ball key={`r-${set.id || idx}-${i}`} num={n} color="red" max={config.red.max} lotteryId={config.id} />
                     ))}
                     {set.blues.map((n: number, i: number) => (
                       <Ball key={`b-${set.id || idx}-${i}`} num={n} color="blue" max={config.blue.max} lotteryId={config.id} />
                     ))}
                   </div>
                 </motion.div>
              </div>
            ))
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-3 py-3 pb-6 flex flex-col gap-2 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        
        {/* Global Options: Multiplier & DLT Extra */}
        <div className="flex items-center justify-between px-1 border-b border-gray-50 dark:border-slate-800 pb-2 mb-0">
          <div className="flex items-center gap-3">
             <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">投倍</span>
             <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 border border-gray-200 dark:border-slate-700 shadow-sm">
                <button onClick={() => setMultiplier(Math.max(1, multiplier - 1))} className="w-8 h-7 flex items-center justify-center text-gray-500 rounded bg-white shadow-sm dark:bg-slate-700 active:scale-95 transition-all">-</button>
                <span className="w-9 text-center font-bold text-gray-800 dark:text-gray-100 text-[13px]">{multiplier}</span>
                <button onClick={() => setMultiplier(Math.min(99, multiplier + 1))} className="w-8 h-7 flex items-center justify-center text-gray-500 rounded bg-white shadow-sm dark:bg-slate-700 active:scale-95 transition-all">+</button>
             </div>
          </div>
          
          {config.id === 'DLT' && (
             <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">追加投注 (3元/注)</span>
                <button onClick={() => setIsDltExtra(!isDltExtra)} className={`w-10 h-6 rounded-full p-0.5 transition-colors border ${isDltExtra ? 'bg-blue-500 border-blue-600' : 'bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600'}`}>
                  <div className={`w-4 h-4 ml-[1px] mt-[1px] rounded-full bg-white shadow-sm transition-transform ${isDltExtra ? 'translate-x-[14px]' : 'translate-x-0'}`}></div>
                </button>
             </div>
          )}
        </div>

        {mode === 'manual' && !['FC3D', 'PL3', 'QXC'].includes(config.id) && (
          <div className="flex justify-between items-center px-1">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-bold mr-2 text-gray-800 dark:text-gray-100 ">{currentStrategy.playName}</span>
              已选 <span className="text-red-500 font-bold">{manualReds.length}</span>红 
              {config.blue.count > 0 && <> <span className="text-blue-500 font-bold">{manualBlues.length}</span>蓝</>}
            </div>
            <div className="text-sm">
              共 <span className="font-bold text-gray-800 dark:text-gray-100 ">{combinations}</span> 注，
              <span className="font-bold text-[#c0392b] text-base">{totalCost * multiplier}</span> <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs">元</span>
            </div>
          </div>
        )}

        {mode === 'manual' ? (
          <div className="flex gap-3">
      {/* ... keeping the button class updates ... */}
            <button
              onClick={() => { setManualReds([]); setManualBlues([]); }}
              className="w-16 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              清空
            </button>
            <button
              disabled={combinations === 0}
              onClick={() => {
                onSave(config.id, [{ reds: manualReds, blues: manualBlues }], multiplier, isDltExtra);
                setManualReds([]); setManualBlues([]);
              }}
              style={combinations > 0 ? { background: getGradient(config.theme, config.id) } : {}}
              className={`flex-1 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${combinations === 0 ? 'bg-gray-300 opacity-50 cursor-not-allowed text-white/70' : 'hover:opacity-90 active:scale-[0.98]'}`}
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
              className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition-colors"
            >
              <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
              机选1注
            </button>
            <button
              onClick={() => handleGenerate(5)}
              disabled={isGenerating}
              style={{ background: getGradient(config.theme, config.id) }}
              className={`flex-1 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all`}
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
                    const cleanedSets = sets.map(({ reds, blues }) => ({ reds, blues }));
                    onSave(config.id, cleanedSets, multiplier, isDltExtra);
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      if (hasMore) {
        setVisibleCount(prev => prev + 20);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 ">
      <div className="bg-white dark:bg-slate-900 pt-[calc(env(safe-area-inset-top,44px)+12px)] pb-3 px-4 shadow-sm z-10 sticky top-0">
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
      <div onScroll={handleScroll} className="flex-1 overflow-y-auto bg-[#f5f5f5] dark:bg-slate-950 p-0 sm:p-4 space-y-0 sm:space-y-3">
        {results.length === 0 ? (
           <div className="p-8 m-4 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-pulse">正在加载历史数据...</div>
        ) : (
          <div className="flex flex-col border-y sm:border-0 border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 sm:divide-y-0">
            {visibleResults.map((res, idx) => (
              <ResultCard key={res.issue || idx} lottery={config} result={res} />
            ))}
            {hasMore && (
              <div className="p-4 text-center text-sm text-gray-500">
                正在加载更多...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Prize Calculation ---
const calcSSQPrize = (redHits: number, blueHits: number): { tier: string, amount: number } | null => {
  if (redHits === 6 && blueHits === 1) return { tier: '一等奖', amount: 5000000 };
  if (redHits === 6 && blueHits === 0) return { tier: '二等奖', amount: 200000 };
  if (redHits === 5 && blueHits === 1) return { tier: '三等奖', amount: 3000 };
  if ((redHits === 5 && blueHits === 0) || (redHits === 4 && blueHits === 1)) return { tier: '四等奖', amount: 200 };
  if ((redHits === 4 && blueHits === 0) || (redHits === 3 && blueHits === 1)) return { tier: '五等奖', amount: 10 };
  if (blueHits === 1 && redHits <= 2) return { tier: '六等奖', amount: 5 };
  return null;
};

const calcDLTPrize = (redHits: number, blueHits: number, isExtra: boolean): { tier: string, amount: number } | null => {
  const e = isExtra ? 1.8 : 1;
  if (redHits === 5 && blueHits === 2) return { tier: '一等奖', amount: Math.round(10000000 * e) };
  if (redHits === 5 && blueHits === 1) return { tier: '二等奖', amount: Math.round(500000 * e) };
  if (redHits === 5 && blueHits === 0) return { tier: '三等奖', amount: 10000 };
  if (redHits === 4 && blueHits === 2) return { tier: '四等奖', amount: 3000 };
  if (redHits === 4 && blueHits === 1) return { tier: '五等奖', amount: 300 };
  if (redHits === 3 && blueHits === 2) return { tier: '六等奖', amount: 200 };
  if (redHits === 4 && blueHits === 0) return { tier: '七等奖', amount: 100 };
  if ((redHits === 3 && blueHits === 1) || (redHits === 2 && blueHits === 2)) return { tier: '八等奖', amount: 15 };
  if ((redHits === 3 && blueHits === 0) || (redHits === 2 && blueHits === 1) || (redHits === 1 && blueHits === 2) || (redHits === 0 && blueHits === 2)) return { tier: '九等奖', amount: 5 };
  return null;
};

const calcQLCPrize = (redHits: number): { tier: string, amount: number } | null => {
  if (redHits === 7) return { tier: '一等奖', amount: 5000000 };
  if (redHits === 6) return { tier: '二等奖', amount: 50000 };
  if (redHits === 5) return { tier: '三等奖', amount: 500 };
  if (redHits === 4) return { tier: '四等奖', amount: 50 };
  return null;
};

const calcPrize = (lotteryId: LotteryId, redHits: number, blueHits: number, isExtra: boolean): { tier: string, amount: number } | null => {
  switch (lotteryId) {
    case 'SSQ': return calcSSQPrize(redHits, blueHits);
    case 'DLT': return calcDLTPrize(redHits, blueHits, isExtra);
    case 'QLC': return calcQLCPrize(redHits);
    case 'QXC': {
      if (redHits + blueHits >= 7) return { tier: '一等奖', amount: 5000000 };
      if (redHits + blueHits >= 6) return { tier: '二等奖', amount: 100000 };
      if (redHits + blueHits >= 5) return { tier: '三等奖', amount: 3000 };
      if (redHits + blueHits >= 4) return { tier: '四等奖', amount: 500 };
      if (redHits + blueHits >= 3) return { tier: '五等奖', amount: 20 };
      if (redHits + blueHits >= 2) return { tier: '六等奖', amount: 5 };
      return null;
    }
    case 'FC3D': case 'PL3': {
      if (redHits === 3) return { tier: '直选', amount: 1040 };
      return null;
    }
    default: return null;
  }
};

// Combination C(n, k)
const comb = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
};

// Calculate total prize for a compound/standard set against a draw result
// For compound bets (e.g. 8红+2蓝), enumerates all sub-combination prize tiers
// Returns { totalAmount, bestTier, winCount }
const calcCompoundPrize = (
  lotteryId: LotteryId,
  set: { reds: number[], blues: number[] },
  drawReds: number[],
  drawBlues: number[],
  isExtra: boolean
): { totalAmount: number, bestTier: string | null, winCount: number } => {
  const config = LOTTERIES.find(l => l.id === lotteryId)!;
  const stdR = config.red.count;  // Standard red count (e.g. 6 for SSQ)
  const stdB = config.blue.count; // Standard blue count (e.g. 1 for SSQ)

  const m = set.reds.filter(n => drawReds.includes(n)).length;   // matching reds
  const R = set.reds.length;                                       // total reds picked
  const b = set.blues.filter(n => drawBlues.includes(n)).length; // matching blues
  const B = set.blues.length;                                      // total blues picked

  // For FC3D/PL3 (position-based), keep simple single check
  if (lotteryId === 'FC3D' || lotteryId === 'PL3' || lotteryId === 'QXC') {
    const prize = calcPrize(lotteryId, m, b, isExtra);
    return { totalAmount: prize?.amount || 0, bestTier: prize?.tier || null, winCount: prize ? 1 : 0 };
  }

  // Enumerate all possible (r, bl) combinations for compound bets
  let totalAmount = 0;
  let bestTier: string | null = null;
  let bestAmount = 0;
  let winCount = 0;

  for (let r = 0; r <= Math.min(m, stdR); r++) {
    for (let bl = 0; bl <= Math.min(b, stdB); bl++) {
      const prize = calcPrize(lotteryId, r, bl, isExtra);
      if (!prize) continue;

      // How many sub-combinations hit exactly r matching reds + (stdR-r) non-matching reds,
      // and bl matching blues + (stdB-bl) non-matching blues
      const count = comb(m, r) * comb(R - m, stdR - r) * comb(b, bl) * comb(B - b, stdB - bl);
      if (count <= 0) continue;

      totalAmount += prize.amount * count;
      winCount += count;
      if (prize.amount > bestAmount) {
        bestAmount = prize.amount;
        bestTier = prize.tier;
      }
    }
  }

  return { totalAmount, bestTier, winCount };
};

const MineView = ({ savedTickets, onDeleteTicket, onSaveTicket, resultsData }: { savedTickets: SavedTicket[], onDeleteTicket: (id: string) => void, onSaveTicket: (id: LotteryId, sets: any[], multiplier?: number, isDltExtra?: boolean, dateOverride?: string) => void, resultsData: Record<string, any[]> }) => {
  const [showSettings, setShowSettings] = useState(false);
  const getMatchingResult = (ticket: SavedTicket, results: any[]) => {
    if (!results || results.length === 0) return null;
    const ticketDate = new Date(ticket.date);
    
    // Always use Beijing time (UTC+8) for ticket date extraction to avoid device/WebView timezone bugs
    // getTime() returns UTC ms, so adding 8 hours aligns it with China Standard Time
    const beijingTime = new Date(ticketDate.getTime() + 8 * 3600 * 1000);
    const beijingYear = beijingTime.getUTCFullYear();
    const beijingMonth = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const beijingDay = String(beijingTime.getUTCDate()).padStart(2, '0');
    const ticketDateStr = `${beijingYear}-${beijingMonth}-${beijingDay}`;
    
    // Determine sales cutoff hour based on lottery type
    // Fucai (SSQ, FC3D, QLC): typically 20:00
    // Ticai (DLT, PL3, QXC): typically 21:00
    const isTicai = ['DLT', 'PL3', 'QXC'].includes(ticket.lotteryId);
    const cutoffHour = isTicai ? 21 : 20;
    const beijingHour = beijingTime.getUTCHours();
    const isAfterCutoff = beijingHour >= cutoffHour;

    let matched: any = null;
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const drawDateStr = res.date.includes(' ') ? res.date.split(' ')[0] : res.date;
      
      if (drawDateStr > ticketDateStr) {
        matched = res; // Save future dates incrementally down to the oldest valid one
      } else if (drawDateStr === ticketDateStr) {
        // Only match same-day draw if the ticket was saved before the deadline
        if (!isAfterCutoff) {
          matched = res;
        }
      } else {
        // Draw date is older than ticket date, we can stop searching backwards
        break;
      }
    }
    return matched;
  };

  const getSetPrize = (ticket: SavedTicket, set: { reds: number[], blues: number[] }, matchingResult: any) => {
    if (!matchingResult) return null;
    const result = calcCompoundPrize(ticket.lotteryId, set, matchingResult.reds, matchingResult.blues, ticket.isDltExtra || false);
    if (result.winCount === 0) return null;
    return { tier: result.bestTier || '', amount: result.totalAmount, winCount: result.winCount };
  };

  // Aggregate stats
  let totalWinCount = 0;
  let totalPrize = 0;
  savedTickets.forEach(ticket => {
    const mr = getMatchingResult(ticket, resultsData[ticket.lotteryId] || []);
    if (!mr) return;
    ticket.numbers.forEach(set => {
      const prize = getSetPrize(ticket, set, mr);
      if (prize) {
        totalWinCount += prize.winCount;
        totalPrize += prize.amount * (ticket.multiplier || 1);
      }
    });
  });

  const handleExport = () => {
    const data = JSON.stringify(savedTickets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `号码本备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          if (Array.isArray(imported)) {
            imported.forEach((t: any) => {
              if (t.lotteryId && t.numbers) {
                onSaveTicket(t.lotteryId, t.numbers, t.multiplier, t.isDltExtra, t.date);
              }
            });
          }
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] dark:bg-[#0f172a] relative overflow-hidden w-full">
      {/* Absolute background color filler to prevent Android layout bounce/whitespace issues */}
      <div className="absolute inset-0 bg-[#f4f5f7] dark:bg-[#0f172a] z-[-1]"></div>
      
      {/* Scrollable Main content */}
      <div className="flex-1 overflow-y-auto z-10 w-full relative pb-10">
        
        {/* Top Red Background Header - Replaced User with QR Code Donation */}
        <div className="bg-gradient-to-br from-red-600 to-red-800 pt-[calc(env(safe-area-inset-top,24px)+20px)] pb-10 px-5 rounded-b-[2.5rem] relative z-0 shadow-sm flex flex-col items-center">
          
          {/* Settings Icon - Top Right */}
          <button onClick={() => setShowSettings(!showSettings)} className="absolute top-[calc(env(safe-area-inset-top,24px)+8px)] right-5 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white active:bg-white/25 transition-all z-20">
            <Settings size={18} />
          </button>

          {/* Settings Dropdown */}
          {showSettings && (
            <div className="absolute top-[calc(env(safe-area-inset-top,24px)+40px)] right-5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-30 min-w-[160px] animate-in fade-in slide-in-from-top-2">
              <button onClick={() => { handleExport(); setShowSettings(false); }} className="w-full text-left text-sm text-gray-700 dark:text-gray-200 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100 transition-colors flex items-center gap-2 font-medium">
                📤 导出备份
              </button>
              <button onClick={() => { handleImport(); setShowSettings(false); }} className="w-full text-left text-sm text-gray-700 dark:text-gray-200 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100 transition-colors flex items-center gap-2 font-medium">
                📥 导入恢复
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-1 text-white drop-shadow-sm">
             <Sparkles size={20} className="text-yellow-300" />
             <h2 className="text-[18px] font-bold tracking-widest text-white font-sans">“锦鲤”体验站</h2>
             <Sparkles size={20} className="text-yellow-300" />
          </div>
          
          <p className="text-[22px] text-red-100/95 font-medium mb-3 tracking-wide text-center px-6 leading-relaxed">
            赞赏结善缘，随喜攒人品，<br />大奖抱回家！
          </p>
          
          <div className="w-[130px] h-[130px] bg-white rounded-2xl overflow-hidden p-2 shadow-[0_8px_24px_rgba(200,20,20,0.6)] ring-4 ring-white/30 border-2 border-transparent">
            <img src="./icons/qr1.jpg" alt="Donation QR Code" className="w-full h-full object-contain rounded-xl border border-gray-100 dark:border-slate-700" />
          </div>
          
        </div>

        {/* Content Wrapper */}
        <div className="-mt-8 px-4 relative z-10 space-y-4">
          
          {/* Stats Box */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] px-2 py-5 flex justify-between items-center text-center border border-white/50 dark:border-white/5">
             <div className="flex flex-col items-center flex-1 relative group cursor-pointer">
                <div className="font-extrabold text-[22px] text-gray-800 dark:text-gray-100 font-sans tracking-tight">
                   {savedTickets.reduce((acc, t) => acc + ((t.numbers.reduce((accSets, s) => accSets + (s.reds.length > 0 ? getStrategy(LOTTERIES.find(l=>l.id===t.lotteryId)!, t.isDltExtra || false).calculateBets(s.reds.length, s.blues.length) : 0), 0) || t.numbers.length) * (t.multiplier || 1)), 0)}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium group-hover:text-gray-800 transition-colors">保存注数</div>
             </div>
             <div className="flex flex-col items-center flex-1 relative group cursor-pointer before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100 dark:before:bg-slate-800">
                <div className={`font-extrabold text-[22px] font-sans tracking-tight ${totalWinCount > 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>{totalWinCount}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium group-hover:text-gray-800 transition-colors">中奖次数</div>
             </div>
             <div className="flex flex-col items-center flex-1 relative group cursor-pointer before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100 dark:before:bg-slate-800">
                <div className="font-extrabold text-[22px] text-gray-800 dark:text-gray-100 font-sans tracking-tight">
                   {(savedTickets.reduce((acc, t) => acc + ((t.numbers.reduce((accSets, s) => accSets + (s.reds.length > 0 ? getStrategy(LOTTERIES.find(l=>l.id===t.lotteryId)!, t.isDltExtra || false).calculateBets(s.reds.length, s.blues.length) : 0), 0) || t.numbers.length) * (t.multiplier || 1) * (t.isDltExtra ? 3 : 2)), 0)).toFixed(2)}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium group-hover:text-gray-800 transition-colors">累计投入</div>
             </div>
             <div className="flex flex-col items-center flex-1 relative group cursor-pointer before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100 dark:before:bg-slate-800">
                <div className={`font-extrabold text-[22px] font-sans tracking-tight block truncate w-full px-1 ${totalPrize > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{totalPrize > 0 ? totalPrize.toFixed(2) : '0.00'}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium group-hover:text-gray-800 transition-colors">累计中奖</div>
             </div>
          </div>

          {/* "号码本" Number Book Section Divider */}
          <div className="flex items-center justify-center gap-4 pt-5 pb-2">
             <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-gray-400 dark:via-slate-600 dark:to-slate-500 w-20"></div>
             <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[15px] font-bold tracking-widest">
                <History size={16} strokeWidth={2.5} /> 号码本
             </div>
             <div className="h-px bg-gradient-to-l from-transparent via-gray-300 to-gray-400 dark:via-slate-600 dark:to-slate-500 w-20"></div>
          </div>



          {/* Saved Tickets content matching the empty state or showing list */}
          {savedTickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] mb-8">
              <History size={64} strokeWidth={1} className="mx-auto text-[#e2e8f0] dark:text-slate-700 mb-5" />
              <p className="text-gray-600 dark:text-gray-300 text-[15px] font-bold mb-1.5">暂无保存的号码</p>
              <p className="text-[#94a3b8] dark:text-gray-500 text-xs font-medium">去选号页面生成并保存吧</p>
            </div>
          ) : (
            <div className="space-y-3.5 pb-8">
              {savedTickets.map(ticket => {
                const config = LOTTERIES.find(l => l.id === ticket.lotteryId)!;
                const matchingResult = getMatchingResult(ticket, resultsData[ticket.lotteryId] || []);
                
                const isHit = (n: number, type: 'red' | 'blue') => {
                  if (!matchingResult) return false;
                  if (type === 'red' && matchingResult.reds.includes(n)) return true;
                  if (type === 'blue' && matchingResult.blues.includes(n)) return true;
                  return false;
                };

                return (
                  <div key={ticket.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] relative overflow-hidden">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        {config.icon && (
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 dark:border-slate-700 bg-white shadow-sm flex-shrink-0 flex items-center justify-center p-1 relative">
                             <img src={`.${config.icon}`} alt={config.name} className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">{config.name}</span>
                            {!matchingResult ? (
                              <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-100 dark:border-transparent font-medium shadow-sm leading-none">等待开奖</span>
                            ) : (() => {
                              let tp = 0;
                              ticket.numbers.forEach(s => { const p = getSetPrize(ticket, s, matchingResult); if (p) tp += p.amount; });
                              tp *= (ticket.multiplier || 1);
                              return tp > 0 ? (
                                <span className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-100 dark:border-transparent font-bold shadow-sm leading-none">🎉 中奖 ¥{tp}</span>
                              ) : (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-transparent font-medium shadow-sm leading-none">第{matchingResult.issue}期反馈</span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 gap-1.5 tracking-wide font-mono mt-1">
                            <span>{new Date(ticket.date).toLocaleString()}</span>
                            <span className="px-1.5 py-[1px] rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-slate-700">{ticket.multiplier || 1}倍</span>
                            {ticket.isDltExtra && <span className="px-1.5 py-[1px] rounded bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-transparent">追加</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Total prize for this ticket */}
                        {matchingResult && (() => {
                          let tp = 0;
                          ticket.numbers.forEach(s => { const p = getSetPrize(ticket, s, matchingResult); if (p) tp += p.amount; });
                          tp *= (ticket.multiplier || 1);
                          return tp > 0 ? (
                            <div className="text-right">
                              <div className="text-red-500 font-black text-[18px] leading-tight">¥{tp >= 10000 ? (tp/10000).toFixed(tp%10000===0?0:1)+'万' : tp}</div>
                              <div className="text-[9px] text-gray-400 font-medium">本期中奖</div>
                            </div>
                          ) : null;
                        })()}
                        <button onClick={() => onDeleteTicket(ticket.id)} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800/50 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all active:scale-90 shadow-sm border border-transparent hover:border-red-100">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-2">
                      {ticket.numbers.map((set, idx) => {
                        const prize = matchingResult ? getSetPrize(ticket, set, matchingResult) : null;

                        return (
                          <div key={idx} className="flex flex-wrap items-center gap-1.5 p-2 bg-[#fafafa] dark:bg-slate-800/20 rounded-xl relative border border-white dark:border-transparent hover:border-gray-100 transition-colors">
                            <div className="text-[11px] font-bold text-gray-300 dark:text-gray-600 w-5 text-center mr-0.5">{(idx + 1).toString().padStart(2, '0')}</div>
                            
                            {set.reds.map((n, i) => {
                              const hit = isHit(n, 'red');
                              return (
                                <div key={`r-${idx}-${i}`} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${hit ? 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-md shadow-red-500/30 scale-105' : (matchingResult ? 'bg-white dark:bg-slate-900 text-gray-300 dark:text-gray-600 border border-gray-100 dark:border-slate-800' : 'bg-red-50 text-red-600 border border-red-100')}`}>
                                  {formatNum(n, config.red.max)}
                                </div>
                              );
                            })}
                            
                            {set.blues.map((n, i) => {
                              const hit = isHit(n, 'blue');
                              return (
                                <div key={`b-${idx}-${i}`} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${hit ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md shadow-blue-500/30 scale-105' : (matchingResult ? 'bg-white dark:bg-slate-900 text-gray-300 dark:text-gray-600 border border-gray-100 dark:border-slate-800' : 'bg-blue-50 text-blue-600 border border-blue-100')}`}>
                                  {formatNum(n, config.blue.max)}
                                </div>
                              );
                            })}
                            
                            {matchingResult && (
                               <div className="absolute right-2.5 opacity-90 pointer-events-none">
                                  {prize ? (
                                    <div className="text-[10px] text-white bg-gradient-to-r from-red-500 to-rose-500 px-2 py-0.5 rounded shadow-sm font-bold flex items-center">¥{prize.amount}</div>
                                  ) : (
                                    <div className="text-[10px] text-gray-400 bg-gray-100 border border-gray-200 dark:border-slate-700 dark:bg-slate-800/80 px-2 py-0.5 rounded font-medium shadow-sm">未中</div>
                                  )}
                               </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
    if ((e.target as Element).closest('.overflow-x-auto, .prevent-swipe')) return;
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
    const initApp = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {
        // Ignored on web
      }
    };
    initApp();
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

  const handleSaveTicket = (lotteryId: LotteryId, numbers: {reds: number[], blues: number[]}[], multiplier: number = 1, isDltExtra: boolean = false, dateOverride?: string) => {
    const newTicket: SavedTicket = {
      id: Math.random().toString(36).substring(7),
      lotteryId,
      date: dateOverride ? dateOverride : new Date().toISOString(),
      numbers,
      multiplier,
      isDltExtra
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
