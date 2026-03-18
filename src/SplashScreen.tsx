import React from 'react';
import { motion } from 'motion/react';

export const SplashScreen = () => {
  return (
    <motion.div
      // 退出时的动画：淡出并微微放大
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="absolute inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center"
    >
      {/* 核心 Logo 动画：带旋转的弹性放大 */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
        className="w-28 h-28 bg-red-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-red-500/40 mb-6 relative overflow-hidden"
      >
        {/* Logo 高光效果 */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
        {/* 内部白色圆圈与文字 */}
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
          <span className="text-4xl font-bold text-red-500 font-sans">彩</span>
        </div>
      </motion.div>
      
      {/* 主标题动画：向上浮现 */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-3xl font-bold text-white tracking-widest"
      >
        彩票助手
      </motion.h1>
      
      {/* 副标题动画：渐显 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-slate-400 mt-2 text-sm tracking-widest"
      >
        让幸运更简单
      </motion.p>

      {/* 底部加载指示器动画：延迟渐显 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-16 flex flex-col items-center"
      >
        <div className="w-6 h-6 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
      </motion.div>
    </motion.div>
  );
};
