import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Clock, MapPin, RefreshCw, Dribbble } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';

// --- Types ---
interface MatchOdds {
  win: string;
  draw?: string;
  lose: string;
}

interface SportsMatch {
  id: string;
  matchNum: string;          // 赛事编号 e.g. "周二001"
  leagueName: string;        // 联赛名
  leagueColor: string;       // 联赛颜色
  homeTeam: string;          // 主队
  awayTeam: string;          // 客队
  matchTime: string;         // 比赛时间
  matchDate: string;         // 比赛日期
  status: 'upcoming' | 'selling' | 'closed'; // 状态
  odds: MatchOdds;           // 赔率
  handicap?: string;         // 让球
  totalPoints?: string;      // 预设总分 (篮球)
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
  // Generate consistent color from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
};

// --- Data Fetching ---
const fetchFootballMatches = async (): Promise<SportsMatch[]> => {
  try {
    const url = 'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=hhad,had&channel=c_web&is498=N';
    const response = await CapacitorHttp.request({ url, method: 'GET' });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (!data?.value?.matchInfoList) return [];
    
    return data.value.matchInfoList.slice(0, 50).map((match: any) => {
      const subMatch = match.subMatchList?.[0];
      const hadOdds = subMatch?.hadList || subMatch?.hhadList;
      const hhad = subMatch?.hhadList;
      
      return {
        id: match.matchId || String(Math.random()),
        matchNum: match.matchNumStr || match.matchNum || '',
        leagueName: match.leagueNameAbbr || match.leagueName || '未知联赛',
        leagueColor: getLeagueColor(match.leagueNameAbbr || match.leagueName || ''),
        homeTeam: match.homeTeamAbbName || match.homeTeamName || '主队',
        awayTeam: match.awayTeamAbbName || match.awayTeamName || '客队',
        matchTime: match.matchTime ? match.matchTime.substring(11, 16) : '--:--',
        matchDate: match.matchTime ? match.matchTime.substring(0, 10) : '',
        status: match.sellStatus === 'OnSale' ? 'selling' : match.sellStatus === 'SoldOut' ? 'closed' : 'upcoming',
        odds: {
          win: hadOdds?.[0]?.a || '-',
          draw: hadOdds?.[0]?.d || '-',
          lose: hadOdds?.[0]?.h || '-',
        },
        handicap: hhad?.[0]?.fixedodds || '',
      };
    });
  } catch (e) {
    console.warn('Fetch football matches failed', e);
    return generateMockFootball();
  }
};

const fetchBasketballMatches = async (): Promise<SportsMatch[]> => {
  try {
    const url = 'https://webapi.sporttery.cn/gateway/jc/basketball/getMatchCalculatorV1.qry?poolCode=mnl,hdc&channel=c_web';
    const response = await CapacitorHttp.request({ url, method: 'GET' });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (!data?.value?.matchInfoList) return [];
    
    return data.value.matchInfoList.slice(0, 50).map((match: any) => {
      const subMatch = match.subMatchList?.[0];
      const mnlOdds = subMatch?.mnlList;
      const hdcOdds = subMatch?.hdcList;
      
      return {
        id: match.matchId || String(Math.random()),
        matchNum: match.matchNumStr || match.matchNum || '',
        leagueName: match.leagueNameAbbr || match.leagueName || '未知联赛',
        leagueColor: getLeagueColor(match.leagueNameAbbr || match.leagueName || ''),
        homeTeam: match.homeTeamAbbName || match.homeTeamName || '主队',
        awayTeam: match.awayTeamAbbName || match.awayTeamName || '客队',
        matchTime: match.matchTime ? match.matchTime.substring(11, 16) : '--:--',
        matchDate: match.matchTime ? match.matchTime.substring(0, 10) : '',
        status: match.sellStatus === 'OnSale' ? 'selling' : match.sellStatus === 'SoldOut' ? 'closed' : 'upcoming',
        odds: {
          win: mnlOdds?.[0]?.a || hdcOdds?.[0]?.a || '-',
          lose: mnlOdds?.[0]?.h || hdcOdds?.[0]?.h || '-',
        },
        handicap: hdcOdds?.[0]?.fixedodds || '',
        totalPoints: subMatch?.hilo?.[0]?.fixedodds || '',
      };
    });
  } catch (e) {
    console.warn('Fetch basketball matches failed', e);
    return generateMockBasketball();
  }
};

// --- Mock Data Generators ---
const FOOTBALL_LEAGUES = ['英超', '西甲', '德甲', '意甲', '法甲', '中超', '欧冠', '日职', '韩K'];
const FOOTBALL_TEAMS: Record<string, string[][]> = {
  '英超': [['曼城', '阿森纳'], ['利物浦', '切尔西'], ['曼联', '热刺'], ['纽卡', '维拉']],
  '西甲': [['巴萨', '皇马'], ['马竞', '塞维利亚'], ['贝蒂斯', '瓦伦']],
  '德甲': [['拜仁', '多特'], ['莱比锡', '勒沃'], ['法兰克', '沃尔夫']],
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
      const minute = Math.random() > 0.5 ? '00' : '30';
      matches.push({
        id: `fb-${num}`,
        matchNum: `周${['一','二','三','四','五','六','日'][new Date().getDay() || 6]}${String(num).padStart(3, '0')}`,
        leagueName: league,
        leagueColor: getLeagueColor(league),
        homeTeam: home,
        awayTeam: away,
        matchTime: `${hour}:${minute}`,
        matchDate: new Date().toISOString().split('T')[0],
        status: Math.random() > 0.3 ? 'selling' : 'upcoming',
        odds: {
          win: (1.2 + Math.random() * 3).toFixed(2),
          draw: (2.5 + Math.random() * 2).toFixed(2),
          lose: (1.5 + Math.random() * 4).toFixed(2),
        },
        handicap: Math.random() > 0.5 ? `-${Math.ceil(Math.random() * 2)}` : `+${Math.ceil(Math.random() * 2)}`,
      });
      num++;
    }
  }
  return matches;
};

const generateMockBasketball = (): SportsMatch[] => {
  return BASKETBALL_TEAMS.slice(0, 8).map((teams, idx) => ({
    id: `bb-${idx}`,
    matchNum: `周${['一','二','三','四','五','六','日'][new Date().getDay() || 6]}${String(idx + 1).padStart(3, '0')}`,
    leagueName: idx < 8 ? 'NBA' : 'CBA',
    leagueColor: getLeagueColor(idx < 8 ? 'NBA' : 'CBA'),
    homeTeam: teams[0],
    awayTeam: teams[1],
    matchTime: `${7 + Math.floor(Math.random() * 5)}:${Math.random() > 0.5 ? '00' : '30'}`,
    matchDate: new Date().toISOString().split('T')[0],
    status: Math.random() > 0.3 ? 'selling' : 'upcoming',
    odds: {
      win: (1.3 + Math.random() * 2).toFixed(2),
      lose: (1.3 + Math.random() * 2).toFixed(2),
    },
    handicap: `${Math.random() > 0.5 ? '-' : '+'}${(1 + Math.random() * 10).toFixed(1)}`,
    totalPoints: (180 + Math.floor(Math.random() * 60)).toString(),
  }));
};

// --- Match Card Component ---
const MatchCard: React.FC<{ match: SportsMatch, isFootball: boolean }> = ({ match, isFootball }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
            style={{ backgroundColor: match.leagueColor }}
          >
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
          <div className="flex-1 text-left">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{match.homeTeam}</span>
            <span className="text-[10px] text-gray-400 ml-1">[主]</span>
          </div>
          <div className="flex items-center gap-1 px-3">
            <span className="text-lg font-black text-gray-300 dark:text-gray-600">VS</span>
          </div>
          <div className="flex-1 text-right">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{match.awayTeam}</span>
          </div>
        </div>
        {match.handicap && (
          <div className="text-center mt-1">
            <span className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
              让球 {match.handicap}
            </span>
          </div>
        )}
      </div>

      {/* Odds */}
      <div className="flex gap-2 px-3 pb-3">
        <button className="flex-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors rounded-xl py-2 flex flex-col items-center">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{isFootball ? '主胜' : '主胜'}</span>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">{match.odds.win}</span>
        </button>
        {isFootball && match.odds.draw && (
          <button className="flex-1 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 transition-colors rounded-xl py-2 flex flex-col items-center">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">平局</span>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{match.odds.draw}</span>
          </button>
        )}
        <button className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 transition-colors rounded-xl py-2 flex flex-col items-center">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{isFootball ? '客胜' : '客胜'}</span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{match.odds.lose}</span>
        </button>
      </div>

      {/* Status Badge */}
      <div className={`text-center py-1.5 text-[10px] font-bold tracking-wider ${
        match.status === 'selling' 
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
          : match.status === 'closed' 
          ? 'bg-gray-50 dark:bg-slate-800 text-gray-400' 
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
      }`}>
        {match.status === 'selling' ? '● 销售中' : match.status === 'closed' ? '已截止' : '即将开售'}
      </div>
    </motion.div>
  );
};

// --- Main SportsView Component ---
export const SportsView = () => {
  const [sportType, setSportType] = useState<'football' | 'basketball'>('football');
  const [matches, setMatches] = useState<SportsMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMatches = async () => {
    setLoading(true);
    const data = sportType === 'football'
      ? await fetchFootballMatches()
      : await fetchBasketballMatches();
    setMatches(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
  }, [sportType]);

  // Group matches by date
  const groupedMatches = matches.reduce((acc, match) => {
    const date = match.matchDate || '未知日期';
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, SportsMatch[]>);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 pt-[calc(env(safe-area-inset-top,32px)+12px)] pb-4 px-4 shadow-lg">
        <h1 className="text-xl font-bold text-center text-white mb-3">竞彩中心</h1>
        
        {/* Sport Type Toggle */}
        <div className="flex bg-white/15 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSportType('football')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              sportType === 'football'
                ? 'bg-white text-emerald-700 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <span className="text-lg">⚽</span>
            竞彩足球
          </button>
          <button
            onClick={() => setSportType('basketball')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              sportType === 'basketball'
                ? 'bg-white text-emerald-700 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <span className="text-lg">🏀</span>
            竞彩篮球
          </button>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="text-white/70 text-xs">
            共 <span className="text-white font-bold">{matches.length}</span> 场比赛
          </div>
          <button
            onClick={loadMatches}
            className="text-white/80 text-xs flex items-center gap-1 hover:text-white transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            刷新赛程
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
                  <MatchCard key={match.id} match={match} isFootball={sportType === 'football'} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Disclaimer */}
        <div className="text-center text-[10px] text-gray-400 dark:text-gray-600 py-4 px-6 leading-relaxed">
          竞彩赔率数据来源中国体育彩票竞彩官方平台，仅供参考。
          <br />购买竞彩彩票请前往体彩实体店。理性购彩，量力而行。
        </div>
      </div>
    </div>
  );
};
