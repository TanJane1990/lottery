import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, RefreshCw, Dribbble, Calculator, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';

// --- Types ---
interface MatchOdds {
  win: string;
  draw?: string;
  lose: string;
}

type OddsChoice = 'win' | 'draw' | 'lose';

interface SportsMatch {
  id: string;
  matchNum: string;
  leagueName: string;
  leagueColor: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamCode?: string;
  awayTeamCode?: string;
  matchTime: string;
  matchDate: string;
  status: 'upcoming' | 'selling' | 'closed';
  odds: MatchOdds;
  handicap?: string;
  totalPoints?: string;
}

interface SelectedBet {
  matchId: string;
  matchNum: string;
  homeTeam: string;
  awayTeam: string;
  choices: OddsChoice[];          // 可多选（复式）
  oddsValues: Record<OddsChoice, number>;
}

// 联赛颜色映射
const LEAGUE_COLORS: Record<string, string> = {
  '英超': '#3d195b', '西甲': '#ee8707', '德甲': '#d20515',
  '意甲': '#008fd7', '法甲': '#dae025', '中超': '#e4002b',
  '欧冠': '#1c3a7a', '欧联': '#f57c00', '日职': '#e4002b',
  '韩K': '#0033a0', '澳超': '#ff6600', '美职': '#013a5e',
  'NBA': '#1d428a', 'CBA': '#d4213d', 'WNBA': '#ff6600',
  '欧篮冠': '#e94e10',
};

const getLeagueColor = (name: string): string => {
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (name.includes(key)) return color;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
};

// --- Parlay Calculation Helpers ---
const PARLAY_OPTIONS: Record<number, string[]> = {
  2: ['2串1'],
  3: ['3串1', '3串3', '3串4'],
  4: ['4串1', '4串4', '4串5', '4串6', '4串11'],
  5: ['5串1', '5串5', '5串6', '5串10', '5串16', '5串20', '5串26'],
  6: ['6串1', '6串6', '6串7', '6串15', '6串22', '6串35', '6串42', '6串50', '6串57'],
};

const combination = (n: number, r: number): number => {
  if (r > n || r < 0) return 0;
  let res = 1;
  for (let i = 1; i <= r; i++) res = res * (n - i + 1) / i;
  return Math.round(res);
};

// 计算某个M串N的注数和理论奖金
const calculateParlay = (
  bets: SelectedBet[],
  parlayStr: string,
  multiple: number
): { totalBets: number; totalCost: number; maxPrize: number } => {
  const parts = parlayStr.split('串');
  const m = parseInt(parts[0]); // 选几场过关
  const n = parseInt(parts[1]); // 1=单式过关, >1=自由过关组合数

  if (m > bets.length) return { totalBets: 0, totalCost: 0, maxPrize: 0 };

  // 每场比赛的选项数量（复式选了几个）
  const choicesPerMatch = bets.map(b => b.choices.length);
  
  if (n === 1) {
    // M串1：选M场全部串在一起
    // 注数 = 各场选项数的乘积
    const totalBets = choicesPerMatch.reduce((a, b) => a * b, 1);
    // 最高奖金 = 各场最高赔率相乘 * 2(元) * 倍数
    const maxOddsProduct = bets.reduce((acc, bet) => {
      const maxOdd = Math.max(...bet.choices.map(c => bet.oddsValues[c] || 1));
      return acc * maxOdd;
    }, 1);
    const totalCost = totalBets * 2 * multiple;
    const maxPrize = Math.floor(maxOddsProduct * 2 * multiple * 100) / 100;
    return { totalBets: totalBets * multiple, totalCost, maxPrize };
  } else {
    // M串N（N>1）：从选中场次中取M场的各种组合
    const combCount = combination(bets.length, m);
    const totalBets = combCount * choicesPerMatch.reduce((a, b) => a * b, 1);
    const maxOddsProduct = bets.reduce((acc, bet) => {
      const maxOdd = Math.max(...bet.choices.map(c => bet.oddsValues[c] || 1));
      return acc * maxOdd;
    }, 1);
    const totalCost = totalBets * 2 * multiple;
    const maxPrize = Math.floor(maxOddsProduct * 2 * multiple * combCount * 100) / 100;
    return { totalBets: totalBets * multiple, totalCost, maxPrize };
  }
};

// --- Data Fetching ---
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.sporttery.cn/jc/jsq/zqspf/',
  'Origin': 'https://www.sporttery.cn',
  'X-Requested-With': 'XMLHttpRequest',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const fetchFootballMatches = async (): Promise<SportsMatch[]> => {
  const urls = [
    'https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c&poolCode=hhad,had',
    'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=had,hhad&channel=c_web&is498=N',
  ];
  
  for (const url of urls) {
    try {
      const response = await CapacitorHttp.request({ url, method: 'GET', headers: BROWSER_HEADERS, connectTimeout: 8000, readTimeout: 8000 });
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const list = data?.value?.matchInfoList;
      if (!list || !Array.isArray(list) || list.length === 0) continue;
      
      const results: SportsMatch[] = [];
      for (const group of list) {
        // Data can be flat (match fields on group) or nested (subMatchList)
        const subs = group.subMatchList && Array.isArray(group.subMatchList) && group.subMatchList.length > 0
          ? group.subMatchList
          : [group];
        
        for (const match of subs) {
          const had = match.had || {};
          const hhad = match.hhad || {};
          const leagueName = match.leagueAbbName || match.leagueNameAbbr || match.leagueAllName || '';
          const homeTeam = match.homeTeamAbbName || match.homeTeamAllName || '';
          const awayTeam = match.awayTeamAbbName || match.awayTeamAllName || '';
          if (!homeTeam || !awayTeam) continue;
          
          const sellStatus = match.matchStatus === 'Selling' || match.sellStatus === 2 || match.sellStatus === 'OnSale';
          const isClosed = match.matchStatus === 'Closed' || match.sellStatus === 'SoldOut';
          
          // Use hhad odds if had is empty (some matches only have handicap odds)
          const oddsSource = (had.h || had.a) ? had : hhad;
          
          results.push({
            id: String(match.matchId || Math.random()),
            matchNum: match.matchNumStr || `${match.matchWeek || ''}${String(match.matchNum || '').slice(-3)}`,
            leagueName: leagueName || '未知',
            leagueColor: getLeagueColor(leagueName),
            homeTeam, awayTeam,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            matchTime: match.matchTime ? match.matchTime.substring(0, 5) : '--:--',
            matchDate: match.matchDate || match.businessDate || group.businessDate || new Date().toISOString().split('T')[0],
            status: sellStatus ? 'selling' as const : isClosed ? 'closed' as const : 'upcoming' as const,
            odds: {
              win: oddsSource.h || '-',
              draw: oddsSource.d || '-',
              lose: oddsSource.a || '-',
            },
            handicap: hhad.goalLine || '',
          });
        }
      }
      
      if (results.length > 0) return results.slice(0, 50);
    } catch (e) {
      console.warn(`Fetch football from ${url} failed`, e);
    }
  }
  return generateMockFootball();
};

const fetchBasketballMatches = async (): Promise<SportsMatch[]> => {
  const urls = [
    'https://webapi.sporttery.cn/gateway/uniform/basketball/getMatchCalculatorV1.qry?channel=c&poolCode=mnl',
    'https://webapi.sporttery.cn/gateway/jc/basketball/getMatchCalculatorV1.qry?poolCode=mnl,hdc&channel=c_web',
  ];
  
  for (const url of urls) {
    try {
      const response = await CapacitorHttp.request({ url, method: 'GET', headers: BROWSER_HEADERS, connectTimeout: 8000, readTimeout: 8000 });
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const list = data?.value?.matchInfoList;
      if (!list || !Array.isArray(list) || list.length === 0) continue;
      
      const results: SportsMatch[] = [];
      for (const group of list) {
        const subs = group.subMatchList && Array.isArray(group.subMatchList) && group.subMatchList.length > 0
          ? group.subMatchList
          : [group];
        
        for (const sub of subs) {
          const mnl = sub.mnl || {};
          const hdc = sub.hdc || {};
          const hilo = sub.hilo || {};
          const leagueName = sub.leagueAbbName || sub.leagueAllName || '';
          const homeTeam = sub.homeTeamAbbName || sub.homeTeamAllName || '';
          const awayTeam = sub.awayTeamAbbName || sub.awayTeamAllName || '';
          if (!homeTeam || !awayTeam) continue;
          
          const sellStatus = sub.matchStatus === 'Selling' || sub.sellStatus === 2;
          const isClosed = sub.matchStatus === 'Closed' || sub.sellStatus === 'SoldOut';
          
          results.push({
            id: String(sub.matchId || Math.random()),
            matchNum: sub.matchNumStr || `${sub.matchWeek || ''}${String(sub.matchNum || '').slice(-3)}`,
            leagueName: leagueName || '未知',
            leagueColor: getLeagueColor(leagueName),
            homeTeam, awayTeam,
            homeTeamId: sub.homeTeamId,
            awayTeamId: sub.awayTeamId,
            matchTime: sub.matchTime ? sub.matchTime.substring(0, 5) : '--:--',
            matchDate: sub.matchDate || sub.businessDate || group.businessDate || new Date().toISOString().split('T')[0],
            status: sellStatus ? 'selling' as const : isClosed ? 'closed' as const : 'upcoming' as const,
            odds: {
              win: mnl.h || '-',
              lose: mnl.a || '-',
            },
            handicap: hdc.goalLine || '',
            totalPoints: hilo.goalLine || '',
          });
        }
      }
      
      if (results.length > 0) return results.slice(0, 50);
    } catch (e) {
      console.warn(`Fetch basketball from ${url} failed`, e);
    }
  }
  return generateMockBasketball();
};

// --- Mock Data ---
const FOOTBALL_LEAGUES = ['英超', '西甲', '德甲', '意甲', '法甲', '中超', '欧冠', '日职', '韩K'];
const FOOTBALL_TEAMS: Record<string, string[][]> = {
  '英超': [['曼城', '阿森纳'], ['利物浦', '切尔西'], ['曼联', '热刺'], ['纽卡', '维拉']],
  '西甲': [['巴萨', '皇马'], ['马竞', '塞维利亚'], ['贝蒂斯', '瓦伦']],
  '德甲': [['拜仁', '多特'], ['莱比锡', '勒沃'], ['法兰克福', '沃尔夫']],
  '意甲': [['国米', 'AC米兰'], ['尤文', '那不勒'], ['罗马', '拉齐奥']],
  '法甲': [['巴黎', '马赛'], ['里昂', '摩纳哥'], ['里尔', '尼斯']],
  '中超': [['上海海港', '山东泰山'], ['北京国安', '广州队'], ['成都蓉城', '浙江队']],
  '欧冠': [['巴萨', '巴黎'], ['拜仁', '阿森纳'], ['皇马', '曼城']],
  '日职': [['横滨', '神户'], ['�的方', '广岛']],
  '韩K': [['全北', '蔚山'], ['首尔', '水原']],
};
const BASKETBALL_TEAMS = [
  ['湖人', '勇士'], ['凯尔特', '雄鹿'], ['76人', '热火'], ['独行侠', '掘金'],
  ['太阳', '快船'], ['国王', '灰熊'], ['骑士', '尼克斯'], ['雷霆', '森林狼'],
  ['广东', '辽宁'], ['新疆', '北京'], ['浙江', '上海'], ['山东', '广厦'],
];

const generateMockFootball = (): SportsMatch[] => {
  const matches: SportsMatch[] = [];
  let num = 1;
  for (const league of FOOTBALL_LEAGUES.slice(0, 5)) {
    const teams = FOOTBALL_TEAMS[league] || [['主队', '客队']];
    for (const [home, away] of teams.slice(0, 2)) {
      const hour = 18 + Math.floor(Math.random() * 8);
      matches.push({
        id: `fb-${num}`, matchNum: `周${['一','二','三','四','五','六','日'][new Date().getDay() || 6]}${String(num).padStart(3, '0')}`,
        leagueName: league, leagueColor: getLeagueColor(league),
        homeTeam: home, awayTeam: away,
        matchTime: `${hour}:${Math.random() > 0.5 ? '00' : '30'}`,
        matchDate: new Date().toISOString().split('T')[0],
        status: Math.random() > 0.3 ? 'selling' : 'upcoming',
        odds: { win: (1.2 + Math.random() * 3).toFixed(2), draw: (2.5 + Math.random() * 2).toFixed(2), lose: (1.5 + Math.random() * 4).toFixed(2) },
        handicap: Math.random() > 0.5 ? `-${Math.ceil(Math.random() * 2)}` : `+${Math.ceil(Math.random() * 2)}`,
      });
      num++;
    }
  }
  return matches;
};

const generateMockBasketball = (): SportsMatch[] => {
  return BASKETBALL_TEAMS.slice(0, 8).map((teams, idx) => ({
    id: `bb-${idx}`, matchNum: `周${['一','二','三','四','五','六','日'][new Date().getDay() || 6]}${String(idx + 1).padStart(3, '0')}`,
    leagueName: idx < 6 ? 'NBA' : 'CBA', leagueColor: getLeagueColor(idx < 6 ? 'NBA' : 'CBA'),
    homeTeam: teams[0], awayTeam: teams[1],
    matchTime: `${7 + Math.floor(Math.random() * 5)}:${Math.random() > 0.5 ? '00' : '30'}`,
    matchDate: new Date().toISOString().split('T')[0],
    status: Math.random() > 0.3 ? 'selling' : 'upcoming',
    odds: { win: (1.3 + Math.random() * 2).toFixed(2), lose: (1.3 + Math.random() * 2).toFixed(2) },
    handicap: `${Math.random() > 0.5 ? '-' : '+'}${(1 + Math.random() * 10).toFixed(1)}`,
    totalPoints: (180 + Math.floor(Math.random() * 60)).toString(),
  }));
};

// --- Team Logo Component ---
const TeamLogo: React.FC<{ isFootball: boolean; isHome: boolean }> = ({ isFootball, isHome }) => {
  const src = isFootball
    ? (isHome ? './teams/zq_zd.png' : './teams/zq_kd.png')
    : (isHome ? './teams/lq_zd.png' : './teams/lq_kd.png');

  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
      <img src={src} alt={isHome ? '主队' : '客队'} className="w-10 h-10 object-contain" />
    </div>
  );
};

// --- Match Card Component ---
const MatchCard: React.FC<{
  match: SportsMatch;
  isFootball: boolean;
  selectedBet?: SelectedBet;
  onToggleOdds: (matchId: string, choice: OddsChoice, odds: number) => void;
}> = ({ match, isFootball, selectedBet, onToggleOdds }) => {
  const isChoiceSelected = (choice: OddsChoice) => selectedBet?.choices.includes(choice) || false;
  const oddsWin = parseFloat(match.odds.win) || 0;
  const oddsDraw = parseFloat(match.odds.draw || '0') || 0;
  const oddsLose = parseFloat(match.odds.lose) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border overflow-hidden transition-all ${
        selectedBet ? 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'border-gray-100 dark:border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: match.leagueColor }}>
            {match.leagueName}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{match.matchNum}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock size={12} />
          <span>{match.matchDate.substring(5)} {match.matchTime}</span>
        </div>
      </div>

      {/* Teams */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 flex flex-col items-center gap-1">
            <TeamLogo isFootball={isFootball} isHome={true} />
            <span className="font-bold text-gray-800 dark:text-gray-100 text-xs text-center leading-tight">{match.homeTeam}</span>
          </div>
          <div className="flex flex-col items-center px-3">
            <span className="text-lg font-black text-gray-300 dark:text-gray-600">VS</span>
            {match.handicap && (
              <span className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium mt-1">
                让球 {match.handicap}
              </span>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <TeamLogo isFootball={isFootball} isHome={false} />
            <span className="font-bold text-gray-800 dark:text-gray-100 text-xs text-center leading-tight">{match.awayTeam}</span>
          </div>
        </div>
      </div>

      {/* Odds Buttons (interactive) */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={() => oddsWin > 0 && onToggleOdds(match.id, 'win', oddsWin)}
          className={`flex-1 rounded-xl py-2 flex flex-col items-center transition-all ${
            isChoiceSelected('win')
              ? 'bg-red-500 text-white shadow-md scale-[1.02]'
              : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100'
          }`}
        >
          <span className={`text-[10px] mb-0.5 ${isChoiceSelected('win') ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>主胜</span>
          <span className={`text-sm font-bold ${isChoiceSelected('win') ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>{match.odds.win}</span>
        </button>
        {isFootball && match.odds.draw && (
          <button
            onClick={() => oddsDraw > 0 && onToggleOdds(match.id, 'draw', oddsDraw)}
            className={`flex-1 rounded-xl py-2 flex flex-col items-center transition-all ${
              isChoiceSelected('draw')
                ? 'bg-gray-600 text-white shadow-md scale-[1.02]'
                : 'bg-gray-50 dark:bg-slate-800 hover:bg-gray-100'
            }`}
          >
            <span className={`text-[10px] mb-0.5 ${isChoiceSelected('draw') ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>平局</span>
            <span className={`text-sm font-bold ${isChoiceSelected('draw') ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{match.odds.draw}</span>
          </button>
        )}
        <button
          onClick={() => oddsLose > 0 && onToggleOdds(match.id, 'lose', oddsLose)}
          className={`flex-1 rounded-xl py-2 flex flex-col items-center transition-all ${
            isChoiceSelected('lose')
              ? 'bg-blue-500 text-white shadow-md scale-[1.02]'
              : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100'
          }`}
        >
          <span className={`text-[10px] mb-0.5 ${isChoiceSelected('lose') ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>客胜</span>
          <span className={`text-sm font-bold ${isChoiceSelected('lose') ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>{match.odds.lose}</span>
        </button>
      </div>

      {/* Status Badge */}
      <div className={`text-center py-1.5 text-[10px] font-bold tracking-wider ${
        match.status === 'selling' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
        : match.status === 'closed' ? 'bg-gray-50 dark:bg-slate-800 text-gray-400'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
      }`}>
        {match.status === 'selling' ? '● 销售中' : match.status === 'closed' ? '已截止' : '即将开售'}
      </div>
    </motion.div>
  );
};

// --- Calculator Panel ---
const CalculatorPanel: React.FC<{
  bets: SelectedBet[];
  isFootball: boolean;
  onRemoveBet: (matchId: string) => void;
  onClearAll: () => void;
}> = ({ bets, isFootball, onRemoveBet, onClearAll }) => {
  const [multiple, setMultiple] = useState(1);
  const [selectedParlay, setSelectedParlay] = useState<string>('');
  const [expanded, setExpanded] = useState(true);

  const availableParlays = useMemo(() => {
    const n = bets.length;
    if (n < 2) return [];
    const options: string[] = [];
    // 单场只能单关
    if (n === 1) return [];
    // 收集所有可用的串关方式
    for (let i = 2; i <= Math.min(n, 6); i++) {
      const parlays = PARLAY_OPTIONS[i];
      if (parlays) options.push(...parlays);
    }
    return options;
  }, [bets.length]);

  useEffect(() => {
    if (availableParlays.length > 0 && !availableParlays.includes(selectedParlay)) {
      setSelectedParlay(availableParlays[0]);
    }
  }, [availableParlays, selectedParlay]);

  const result = useMemo(() => {
    if (bets.length < 2 || !selectedParlay) return { totalBets: 0, totalCost: 0, maxPrize: 0 };
    return calculateParlay(bets, selectedParlay, multiple);
  }, [bets, selectedParlay, multiple]);

  if (bets.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.12)] z-30"
    >
      {/* Toggle Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-2.5 active:bg-gray-50">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-emerald-600" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">投注计算器</span>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">{bets.length}场</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onClearAll(); }} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">清空</button>
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            {/* Selected Matches */}
            <div className="px-4 pb-2 max-h-32 overflow-y-auto space-y-1.5">
              {bets.map(bet => (
                <div key={bet.matchId} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
                    <span className="text-gray-400 flex-shrink-0">{bet.matchNum}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{bet.homeTeam} vs {bet.awayTeam}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {bet.choices.map(c => (
                      <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                        c === 'win' ? 'bg-red-500' : c === 'draw' ? 'bg-gray-500' : 'bg-blue-500'
                      }`}>
                        {c === 'win' ? '胜' : c === 'draw' ? '平' : '负'}
                      </span>
                    ))}
                    <button onClick={() => onRemoveBet(bet.matchId)} className="text-gray-400 hover:text-red-500 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Parlay Options & Multiple */}
            {bets.length >= 2 && (
              <div className="px-4 pb-3 space-y-2">
                {/* Parlay Type */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-shrink-0">过关方式</span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {availableParlays.map(p => (
                      <button
                        key={p}
                        onClick={() => setSelectedParlay(p)}
                        className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${
                          selectedParlay === p
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multiple */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">投注倍数</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMultiple(Math.max(1, multiple - 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-sm flex items-center justify-center"
                    >-</button>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100 w-8 text-center">{multiple}</span>
                    <button
                      onClick={() => setMultiple(Math.min(50, multiple + 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-sm flex items-center justify-center"
                    >+</button>
                    <span className="text-[10px] text-gray-400">倍 [最高50倍]</span>
                  </div>
                </div>

                {/* Result */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      投注金额: <span className="font-bold text-gray-800 dark:text-gray-100">¥{result.totalCost}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      共{result.totalBets}注
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400">理论最高奖金</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">¥{result.maxPrize.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {bets.length === 1 && (
              <div className="px-4 pb-3 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 py-2 mx-4 rounded-lg mb-2">
                至少选择2场比赛才能进行过关投注计算
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Main SportsView Component ---
export const SportsView = () => {
  const [sportType, setSportType] = useState<'football' | 'basketball'>('football');
  const [matches, setMatches] = useState<SportsMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<SelectedBet[]>([]);

  const loadMatches = async () => {
    setLoading(true);
    const data = sportType === 'football' ? await fetchFootballMatches() : await fetchBasketballMatches();
    setMatches(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
    setBets([]); // Clear bets when switching sport type
  }, [sportType]);

  const handleToggleOdds = (matchId: string, choice: OddsChoice, oddsValue: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setBets(prev => {
      const existing = prev.find(b => b.matchId === matchId);
      if (existing) {
        // Toggle the choice on this match
        const hasChoice = existing.choices.includes(choice);
        const newChoices = hasChoice
          ? existing.choices.filter(c => c !== choice)
          : [...existing.choices, choice];
        
        if (newChoices.length === 0) {
          // Remove match from bets
          return prev.filter(b => b.matchId !== matchId);
        }
        return prev.map(b => b.matchId === matchId ? {
          ...b,
          choices: newChoices,
          oddsValues: { ...b.oddsValues, [choice]: oddsValue }
        } : b);
      } else {
        // Add new bet
        return [...prev, {
          matchId,
          matchNum: match.matchNum,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          choices: [choice],
          oddsValues: { win: parseFloat(match.odds.win) || 0, draw: parseFloat(match.odds.draw || '0') || 0, lose: parseFloat(match.odds.lose) || 0, [choice]: oddsValue } as Record<OddsChoice, number>,
        }];
      }
    });
  };

  const groupedMatches = matches.reduce((acc, match) => {
    const date = match.matchDate || '未知日期';
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, SportsMatch[]>);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 pt-[calc(env(safe-area-inset-top,44px)+12px)] pb-4 px-4 shadow-lg">
        <h1 className="text-xl font-bold text-center text-white mb-3">竞彩中心</h1>
        
        <div className="flex bg-white/15 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSportType('football')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              sportType === 'football' ? 'bg-white text-emerald-700 shadow-md' : 'text-white/80 hover:text-white'
            }`}
          >
            <span className="text-lg">⚽</span> 竞彩足球
          </button>
          <button
            onClick={() => setSportType('basketball')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              sportType === 'basketball' ? 'bg-white text-emerald-700 shadow-md' : 'text-white/80 hover:text-white'
            }`}
          >
            <span className="text-lg">🏀</span> 竞彩篮球
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          <div className="text-white/70 text-xs">
            共 <span className="text-white font-bold">{matches.length}</span> 场比赛
            {bets.length > 0 && <span className="ml-2">· 已选 <span className="text-yellow-300 font-bold">{bets.length}</span> 场</span>}
          </div>
          <button onClick={loadMatches} className="text-white/80 text-xs flex items-center gap-1 hover:text-white transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 刷新赛程
          </button>
        </div>
      </div>

      {/* Match List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-40 animate-pulse border border-gray-100 dark:border-slate-800" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <Dribbble size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无{sportType === 'football' ? '足球' : '篮球'}赛程</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">请稍后再试或刷新赛程</p>
          </div>
        ) : (
          Object.entries(groupedMatches).map(([date, dateMatches]: [string, SportsMatch[]]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                  {date === new Date().toISOString().split('T')[0] ? '今日赛事' : date}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800"></div>
                <span className="text-xs text-gray-400">{dateMatches.length}场</span>
              </div>
              <div className="space-y-3">
                {dateMatches.map((match: SportsMatch) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isFootball={sportType === 'football'}
                    selectedBet={bets.find(b => b.matchId === match.id)}
                    onToggleOdds={handleToggleOdds}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        <div className="text-center text-[10px] text-gray-400 dark:text-gray-600 py-4 px-6 leading-relaxed">
          竞彩赔率数据来源中国体育彩票竞彩官方平台，仅供参考。
          <br />购买竞彩彩票请前往体彩实体店。理性购彩，量力而行。
        </div>
        
        {/* Bottom spacer for calculator panel */}
        {bets.length > 0 && <div className="h-48" />}
      </div>

      {/* Calculator Panel (sticky bottom) */}
      <AnimatePresence>
        {bets.length > 0 && (
          <CalculatorPanel
            bets={bets}
            isFootball={sportType === 'football'}
            onRemoveBet={(matchId) => setBets(prev => prev.filter(b => b.matchId !== matchId))}
            onClearAll={() => setBets([])}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
