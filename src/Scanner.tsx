import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, ScanLine, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface ScannerProps {
  onClose: () => void;
  onScanned: (result: { reds: number[], blues: number[], lotteryId: string }[]) => void;
}

export const ScannerView: React.FC<ScannerProps> = ({ onClose, onScanned }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startScan = async () => {
    if (!image) return;
    setIsScanning(true);
    setProgress(10);
    setErrorMsg('');

    try {
      const worker = await Tesseract.createWorker({
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(parseInt((m.progress * 100).toString(), 10));
          }
        }
      });
      
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      // We only care about digits, spaces, dashes
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789 -[]()|',
      });

      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();

      // Simple regex parse for SSQ/DLT formats like "05 09 11 17 23 28 - 06"
      const lines = text.split('\n');
      const foundSets: { reds: number[], blues: number[], lotteryId: string }[] = [];

      const regexSSQ = /((?:\d{2}[\s\-]+){5}\d{2})[\s\-]+(\d{2})/g;
      const regexDLT = /((?:\d{2}[\s\-]+){4}\d{2})[\s\-]+(\d{2})[\s\-]+(\d{2})/g;

      lines.forEach(line => {
        const cleanLine = line.replace(/[^\d\s\-]/g, ' ').trim().replace(/\s+/g, ' ');

        // Try SSQ first
        const ssqMatch = cleanLine.match(/((?:\d{2}\s){5}\d{2})\s*\-?\s*(\d{2})/);
        if (ssqMatch) {
           const reds = ssqMatch[1].split(' ').map(Number).filter(n => n > 0 && n <= 33);
           const blue = Number(ssqMatch[2]);
           if (reds.length === 6 && blue > 0 && blue <= 16) {
              foundSets.push({ reds: reds.sort((a,b)=>a-b), blues: [blue], lotteryId: 'SSQ' });
           }
        } else {
           // Try DLT
           const dltMatch = cleanLine.match(/((?:\d{2}\s){4}\d{2})\s*\-?\s*(\d{2})\s+(\d{2})/);
           if (dltMatch) {
              const reds = dltMatch[1].split(' ').map(Number).filter(n => n > 0 && n <= 35);
              const b1 = Number(dltMatch[2]);
              const b2 = Number(dltMatch[3]);
              if (reds.length === 5 && b1 > 0 && b1 <= 12 && b2 > 0 && b2 <= 12) {
                 foundSets.push({ reds: reds.sort((a,b)=>a-b), blues: [b1, b2].sort((a,b)=>a-b), lotteryId: 'DLT' });
              }
           }
        }
      });

      setIsScanning(false);
      
      if (foundSets.length > 0) {
        onScanned(foundSets);
        onClose();
      } else {
        setErrorMsg('未能在图片中识别到清晰的红蓝球号码，请尝试将目标区域放大并重新截取。');
        setImage(null);
      }

    } catch (e) {
      console.error(e);
      setErrorMsg('识别引擎出现异常，请稍后再试。');
      setIsScanning(false);
      setImage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="absolute top-safe pt-4 right-4 z-50">
        <button onClick={onClose} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white active:bg-white/30 transition-all">
          <X size={24} />
        </button>
      </div>

      <div className="text-white text-center mb-6">
        <ScanLine size={48} className="mx-auto text-blue-400 mb-3" />
        <h2 className="text-2xl font-bold">扫票测奖</h2>
        <p className="text-white/60 text-sm mt-1">支持双色球、大乐透单式扫描</p>
      </div>

      {!image ? (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white rounded-2xl p-4 font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all w-full"
          >
            <Camera size={24} />
            拍照识别 / 从相册选择
          </button>
          {errorMsg && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 flex gap-2 text-sm text-red-100">
               <AlertCircle size={18} className="text-red-400 shrink-0" />
               <p>{errorMsg}</p>
            </div>
          )}
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
          />
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black mb-6">
            <img src={image} className={`w-full h-full object-contain ${isScanning ? 'opacity-50' : 'opacity-100'} transition-opacity`} alt="Ticket preview" />
            
            {/* Target Area Guide Box */}
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all ${isScanning ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}>
               <div className="w-[85%] h-32 border-2 border-emerald-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex relative">
                  <div className="absolute -top-6 left-0 text-emerald-400 text-xs font-bold w-full text-center tracking-widest">在此框内对准开奖号码</div>
                  <div className="w-4 h-4 border-t-2 border-l-2 border-white absolute top-0 left-0"></div>
                  <div className="w-4 h-4 border-t-2 border-r-2 border-white absolute top-0 right-0"></div>
                  <div className="w-4 h-4 border-b-2 border-l-2 border-white absolute bottom-0 left-0"></div>
                  <div className="w-4 h-4 border-b-2 border-r-2 border-white absolute bottom-0 right-0"></div>
               </div>
            </div>

            {isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 border-4 border-white/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
                    {progress}%
                  </div>
                </div>
                <p className="mt-4 text-emerald-400 font-bold tracking-widest text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
                  正在解析数字矩阵...
                </p>
                <div className="absolute w-full h-1 bg-emerald-500/50 shadow-[0_0_15px_#10b981] top-0 left-0 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
          
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => { setImage(null); setErrorMsg(''); }}
              disabled={isScanning}
              className="flex-1 bg-white/20 text-white rounded-xl py-3 font-bold active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              重拍
            </button>
            <button 
              onClick={startScan}
              disabled={isScanning}
              className="flex-[2] bg-emerald-600 text-white rounded-xl py-3 font-bold active:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isScanning ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
              {isScanning ? '提取中...' : '开始识别'}
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scan {
            0% { transform: translateY(0); }
            50% { transform: translateY(100vh); }
            100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
