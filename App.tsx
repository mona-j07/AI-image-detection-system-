
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Upload, ImageIcon, RefreshCcw, ScanSearch, Cpu, Eye, EyeOff, X, CheckCircle2, AlertCircle, Fingerprint, Activity } from 'lucide-react';
import { DetectionStatus, AnalysisResult, ImageData, ModelFinding } from './types';
import { analyzeImage } from './services/geminiService';

const HeatmapOverlay: React.FC<{ result: AnalysisResult; visible: boolean; imageRef: React.RefObject<HTMLImageElement | null> }> = ({ result, visible, imageRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current || !imageRef.current || !result?.heatmapGrid) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = result.heatmapGrid.length;

    const updateCanvas = () => {
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.clearRect(0, 0, rect.width, rect.height);

      const offscreen = document.createElement('canvas');
      offscreen.width = gridSize;
      offscreen.height = gridSize;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      const imageData = offCtx.createImageData(gridSize, gridSize);
      const data = imageData.data;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const row = result.heatmapGrid[y];
          const val = row ? row[x] : 0;
          const index = (y * gridSize + x) * 4;
          
          let r = 0, g = 0, b = 0;
          if (val < 0.25) { b = 255; g = Math.floor((val / 0.25) * 255); }
          else if (val < 0.5) { g = 255; b = Math.floor((1 - (val - 0.25) / 0.25) * 255); }
          else if (val < 0.75) { g = 255; r = Math.floor(((val - 0.5) / 0.25) * 255); }
          else { r = 255; g = Math.floor((1 - (val - 0.75) / 0.25) * 255); }

          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        }
      }
      offCtx.putImageData(imageData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.65;
      ctx.drawImage(offscreen, 0, 0, rect.width, rect.height);
    };

    updateCanvas();
    const resizeObserver = new ResizeObserver(updateCanvas);
    resizeObserver.observe(img);
    return () => resizeObserver.disconnect();
  }, [result, visible, imageRef]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ zIndex: 10, mixBlendMode: 'screen' }}
    />
  );
};

const FindingCard: React.FC<{ finding: ModelFinding }> = ({ finding }) => (
  <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-indigo-500/40 group">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest group-hover:text-indigo-300 transition-colors">{finding.name}</span>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
        finding.verdict === 'REAL' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        finding.verdict === 'AI_EDITED' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
      }`}>
        {finding.verdict.replace('_', ' ')} ({finding.confidence}%)
      </span>
    </div>
    <p className="text-[10px] text-slate-500 leading-relaxed font-medium group-hover:text-slate-400">
      {finding.description}
    </p>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<DetectionStatus>(DetectionStatus.IDLE);
  const [image, setImage] = useState<ImageData | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files[0];
    } else {
      file = (e.target as HTMLInputElement).files?.[0];
    }

    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Invalid forensic specimen. Please provide an image.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage({
          base64: reader.result as string,
          name: file!.name,
          size: file!.size,
          type: file!.type,
          previewUrl: URL.createObjectURL(file!)
        });
        setResult(null);
        setError(null);
        setStatus(DetectionStatus.IDLE);
        setShowHeatmap(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setStatus(DetectionStatus.LOADING);
    setError(null);
    try {
      const analysis = await analyzeImage(image.base64);
      setResult(analysis);
      setStatus(DetectionStatus.SUCCESS);
      setShowHeatmap(true);
    } catch (err: any) {
      setError(err.message || "Forensic sweep failed. Re-initiating...");
      setStatus(DetectionStatus.ERROR);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setStatus(DetectionStatus.IDLE);
    setShowHeatmap(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-12 flex flex-col items-center selection:bg-indigo-500/30">
      <header className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-4 rounded-[1.5rem] shadow-2xl shadow-indigo-600/30">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter gradient-text uppercase">MirageX</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.5em] mt-3">Neural Integrity & Forensic Suite</p>
          </div>
        </div>
        <div className="text-[11px] font-black uppercase text-slate-500 border-l border-slate-800/80 pl-10 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span>Core V11.2 Active</span>
          </div>
          <span className="text-[9px] opacity-40 ml-7 tracking-widest">CLIP-ViT | Grad-CAM | PyTorch</span>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Specimen Side */}
        <section className="lg:col-span-7">
          <div className="bg-slate-900/20 border border-slate-800/60 rounded-[3rem] p-10 backdrop-blur-3xl shadow-3xl relative h-fit">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-4">
                <ImageIcon className="w-5 h-5 text-indigo-500" />
                Input Specimen
              </h2>
              {result && (
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase transition-all shadow-xl ${showHeatmap ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}`}
                >
                  {showHeatmap ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  {showHeatmap ? 'Disable Grad-CAM' : 'Enable Grad-CAM'}
                </button>
              )}
            </div>

            {!image ? (
              <label className="flex flex-col items-center justify-center w-full h-[550px] border-2 border-dashed border-slate-800/60 rounded-[2.5rem] cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/[0.01] transition-all duration-500 group">
                <Upload className="w-16 h-16 text-slate-700 mb-8 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-700" />
                <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-3">Load Forensic Image</p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">Drag Specimen or Click to Acquire</p>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="relative animate-in slide-in-from-bottom-8 duration-700">
                <div className="relative flex justify-center bg-black/50 border border-slate-800/50 rounded-[2rem] p-1 overflow-hidden min-h-[450px]">
                  <div className="relative inline-block self-center">
                    <img 
                      ref={imageRef}
                      src={image.previewUrl} 
                      alt="Audit Source" 
                      className="max-w-full max-h-[650px] rounded-[1.5rem] block object-contain shadow-2xl transition-all duration-1000" 
                      style={{ filter: showHeatmap ? 'brightness(0.25) contrast(1.2) grayscale(0.2)' : 'none' }}
                    />
                    {result && <HeatmapOverlay result={result} visible={showHeatmap} imageRef={imageRef} />}
                  </div>
                  <button onClick={reset} className="absolute top-8 right-8 bg-slate-900/90 hover:bg-red-600 p-5 rounded-3xl text-white border border-slate-700 shadow-2xl transition-all hover:scale-110 z-20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {status !== DetectionStatus.SUCCESS && (
                  <button
                    disabled={status === DetectionStatus.LOADING}
                    onClick={handleAnalyze}
                    className="w-full mt-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800/50 text-white font-black py-8 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-6 text-[12px] tracking-[0.3em] uppercase"
                  >
                    {status === DetectionStatus.LOADING ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <ScanSearch className="w-6 h-6" />}
                    {status === DetectionStatus.LOADING ? 'Analyzing Neural Layers...' : 'Execute MirageX Forensic Sweep'}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Intelligence Side */}
        <section className="lg:col-span-5 flex flex-col space-y-10">
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-10 backdrop-blur-3xl shadow-3xl flex-1 flex flex-col min-h-[650px] max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 mb-12 flex items-center gap-4">
              <Fingerprint className="w-5 h-5 text-indigo-500" />
              Intelligence Feed
            </h2>

            {status === DetectionStatus.IDLE && !result && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-800 py-32 space-y-10 opacity-20">
                <Activity className="w-32 h-32" />
                <p className="text-[12px] font-black uppercase tracking-[0.6em]">Awaiting Specimen</p>
              </div>
            )}

            {status === DetectionStatus.LOADING && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-12">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-5">
                  <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Running Transformers Audit...</p>
                  <span className="text-[10px] text-indigo-500/60 font-bold uppercase tracking-widest block">Calculating Neural Discontinuity Maps</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="p-12 bg-red-950/20 border border-red-500/30 rounded-[3rem] text-center space-y-10">
                  <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
                  <div className="space-y-4">
                    <h3 className="text-base font-black text-red-400 uppercase tracking-widest">Neural Link Disruption</h3>
                    <p className="text-[12px] text-slate-400 leading-relaxed font-medium italic">
                      {error}
                    </p>
                  </div>
                  <button onClick={handleAnalyze} className="px-12 py-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all">
                    Restart Forensic Cycle
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-10">
                <div className="text-center p-12 bg-slate-950/70 rounded-[3.5rem] border border-slate-800 shadow-4xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-6 block">Final Verdict</span>
                   <p className={`text-6xl font-black uppercase tracking-tighter mb-12 transition-all group-hover:scale-105 duration-700 ${
                      result.verdict === 'REAL' ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]' :
                      result.verdict === 'AI_EDITED' ? 'text-orange-400 drop-shadow-[0_0_20px_rgba(251,146,60,0.4)]' : 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                    }`}>
                      {result.verdict.replace('_', ' ')}
                    </p>
                    <div className="grid grid-cols-3 gap-8 pt-12 border-t border-slate-800/80">
                      <div>
                        <div className="text-[10px] text-slate-600 font-black mb-3 uppercase tracking-widest">Authentic</div>
                        <div className="text-3xl font-black text-emerald-400">{result.probabilities.real_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-600 font-black mb-3 uppercase tracking-widest">Modified</div>
                        <div className="text-3xl font-black text-orange-400">{result.probabilities.ai_edited_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-600 font-black mb-3 uppercase tracking-widest">Synthetic</div>
                        <div className="text-3xl font-black text-red-500">{result.probabilities.ai_generated_probability}%</div>
                      </div>
                    </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[12px] font-black text-indigo-500 uppercase tracking-[0.3em] border-l-4 border-indigo-600 pl-6">Unit Intelligence Reports</h3>
                  <div className="grid grid-cols-1 gap-5">
                    {result.modelSpecificFindings?.map((finding, idx) => (
                      <FindingCard key={idx} finding={finding} />
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Forensic Reasoning</h3>
                  <div className="text-slate-400 leading-relaxed text-[13px] font-medium italic p-8 bg-slate-950/50 rounded-[2rem] border border-slate-800/60 shadow-inner relative overflow-hidden group">
                    <Fingerprint className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-600/5 group-hover:text-indigo-600/10 transition-colors duration-1000" />
                    "{result.explanation || 'Forensic trace incomplete. No definitive reasoning found.'}"
                  </div>
                </div>

                <button onClick={reset} className="w-full py-6 rounded-3xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700 text-slate-500 hover:text-white transition-all text-[12px] font-black uppercase tracking-[0.5em] flex items-center justify-center gap-5">
                  <RefreshCcw className="w-5 h-5" />
                  Initiate New Scan
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-32 py-20 text-center text-slate-800 text-[11px] space-y-10 max-w-5xl border-t border-slate-900/50 w-full">
        <p className="px-20 leading-relaxed uppercase tracking-[0.4em] opacity-40 max-w-3xl mx-auto font-bold italic">
          MirageX Ensemble V11.2: Integrated CLIP-ViT, Grad-CAM Explainability, PyTorch Core, and Hugging Face Transformers. 
          Specialized in high-fidelity boundary cohesion and neural artifact detection.
        </p>
      </footer>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 30px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        @keyframes zoom-in-95 {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-in {
          animation: zoom-in-95 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
