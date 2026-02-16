
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Upload, ImageIcon, RefreshCcw, ScanSearch, Cpu, Eye, EyeOff, X, CheckCircle2, AlertCircle, BarChart3, Fingerprint } from 'lucide-react';
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
      ctx.globalAlpha = 0.6;
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
      className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ zIndex: 10, mixBlendMode: 'screen' }}
    />
  );
};

const ModelFindingCard: React.FC<{ finding: ModelFinding }> = ({ finding }) => (
  <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 flex flex-col gap-1.5 transition-all hover:border-indigo-500/30 group">
    <div className="flex justify-between items-start">
      <span className="text-[9px] font-black uppercase text-indigo-400/80 tracking-widest group-hover:text-indigo-400">{finding?.name || 'Neural Module'}</span>
      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
        finding?.verdict === 'REAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
        finding?.verdict === 'AI_EDITED' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}>
        {finding?.verdict.replace('_', ' ') || 'ACTIVE'} ({Math.round(finding?.confidence || 0)}%)
      </span>
    </div>
    <p className="text-[9px] text-slate-500 leading-tight font-medium group-hover:text-slate-400 transition-colors">
      {finding?.description || 'Artifact sweep in progress...'}
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
        setError("Unsupported file format. Please upload a valid image.");
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
      setError(err.message || "Neural audit cycle failed. MirageX core needs reset.");
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
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 flex flex-col items-center selection:bg-indigo-500/30">
      <header className="w-full max-w-6xl flex items-center justify-between mb-10">
        <div className="flex items-center gap-5">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-2xl">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter leading-none gradient-text uppercase">MirageX</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-2">Neural Integrity & Synthetic Forensic Audit</p>
          </div>
        </div>
        <div className="hidden md:block text-[9px] font-black uppercase text-slate-500 border-l border-slate-800/50 pl-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Core V9.2 Advanced</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Specimen Side */}
        <section className="lg:col-span-7">
          <div className="bg-slate-900/30 border border-slate-800 rounded-[2rem] p-6 backdrop-blur-3xl shadow-2xl relative h-fit">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2.5">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                Specimen Acquisition
              </h2>
              {result && (
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${showHeatmap ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                >
                  {showHeatmap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showHeatmap ? 'Disable Heatmap' : 'Overlay Heatmap'}
                </button>
              )}
            </div>

            {!image ? (
              <label className="flex flex-col items-center justify-center w-full h-[480px] border-2 border-dashed border-slate-800 rounded-3xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] transition-all group">
                <Upload className="w-12 h-12 text-slate-700 mb-6 group-hover:text-indigo-400 group-hover:scale-110 transition-all" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select Image for Forensic Audit</p>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="relative">
                <div className="relative flex justify-center bg-black/40 border border-slate-800 rounded-2xl p-1 overflow-hidden min-h-[380px]">
                  <div className="relative inline-block self-center">
                    <img 
                      ref={imageRef}
                      src={image.previewUrl} 
                      alt="Audit Source" 
                      className="max-w-full max-h-[600px] rounded-xl block object-contain shadow-2xl transition-all duration-700" 
                      style={{ filter: showHeatmap ? 'brightness(0.3) contrast(1.1) grayscale(0.5)' : 'none' }}
                    />
                    {result && <HeatmapOverlay result={result} visible={showHeatmap} imageRef={imageRef} />}
                  </div>
                  <button onClick={reset} className="absolute top-4 right-4 bg-slate-900/90 hover:bg-red-600 p-3 rounded-2xl text-white border border-slate-700 shadow-xl transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {status !== DetectionStatus.SUCCESS && (
                  <button
                    disabled={status === DetectionStatus.LOADING}
                    onClick={handleAnalyze}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-4 text-xs tracking-widest uppercase"
                  >
                    {status === DetectionStatus.LOADING ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ScanSearch className="w-5 h-5" />}
                    {status === DetectionStatus.LOADING ? 'Analyzing Boundary Cohesion...' : 'Start MirageX Forensic Audit'}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Intelligence Side */}
        <section className="lg:col-span-5 flex flex-col space-y-8">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 backdrop-blur-3xl shadow-2xl flex-1 flex flex-col min-h-[550px] max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2.5">
              <Fingerprint className="w-4 h-4 text-indigo-500" />
              Neural Forensic Log
            </h2>

            {status === DetectionStatus.IDLE && !result && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700 py-32 space-y-6 opacity-30">
                <ScanSearch className="w-20 h-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Audit Feed Offline</p>
              </div>
            )}

            {status === DetectionStatus.LOADING && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                  <RefreshCcw className="w-16 h-16 text-indigo-500 animate-spin opacity-50" />
                  <Cpu className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Running Neural Decomposition...</p>
                  <span className="text-[8px] opacity-40 mt-3 block uppercase font-bold tracking-[0.2em]">Auditing Subject-Background Interface</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="p-8 bg-red-950/20 border border-red-500/30 rounded-[2.5rem] text-center space-y-6">
                  <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">Neural Interrupt</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-[280px] mx-auto font-medium italic">
                      {error}
                    </p>
                  </div>
                  <button onClick={handleAnalyze} className="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Restart Audit Cycle
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-6">
                <div className="text-center p-8 bg-slate-950/50 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">Ensemble Verdict</span>
                   <p className={`text-5xl font-black uppercase tracking-tighter mb-8 ${
                      result.verdict === 'REAL' ? 'text-emerald-400' :
                      result.verdict === 'AI_EDITED' ? 'text-orange-400' : 'text-red-500'
                    }`}>
                      {result.verdict.replace('_', ' ')}
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800/50">
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1.5 uppercase tracking-widest">Authentic</div>
                        <div className="text-xl font-black text-emerald-400">{result.probabilities.real_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1.5 uppercase tracking-widest">Modified</div>
                        <div className="text-xl font-black text-orange-400">{result.probabilities.ai_edited_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1.5 uppercase tracking-widest">Synthetic</div>
                        <div className="text-xl font-black text-red-500">{result.probabilities.ai_generated_probability}%</div>
                      </div>
                    </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] border-l-4 border-indigo-600 pl-4">Forensic Module Intelligence</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {result.modelSpecificFindings?.map((finding, idx) => (
                      <ModelFindingCard key={idx} finding={finding} />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Audit Summary</h3>
                  <p className="text-slate-400 leading-relaxed text-[11px] font-medium italic p-5 bg-slate-950/30 rounded-2xl border border-slate-800/50 shadow-inner">
                    "{result.explanation || 'Forensic trace incomplete. No definitive reasoning found.'}"
                  </p>
                </div>

                <button onClick={reset} className="w-full py-4 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                  <RefreshCcw className="w-4 h-4" />
                  Initiate New Scan
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-20 py-12 text-center text-slate-700 text-[10px] space-y-6 max-w-5xl border-t border-slate-900 w-full opacity-60">
        <p className="px-12 leading-relaxed uppercase tracking-widest opacity-50 max-w-2xl mx-auto font-medium">
          MirageX Ensemble V9.2 Advanced: HPF High-Pass, ViT-Structural, Xception-Boundary, and Efficient-Pixel modules active. Specialized in neural boundary & subject-background cohesion forensics.
        </p>
      </footer>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;
