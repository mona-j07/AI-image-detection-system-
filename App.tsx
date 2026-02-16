
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Upload, ImageIcon, RefreshCcw, ScanSearch, Cpu, Eye, EyeOff, X, CheckCircle2, AlertCircle, BarChart3, Fingerprint } from 'lucide-react';
import { DetectionStatus, AnalysisResult, ImageData, ModelFinding } from './types';
import { analyzeImage } from './services/geminiService';

const HeatmapOverlay: React.FC<{ result: AnalysisResult; visible: boolean; imageRef: React.RefObject<HTMLImageElement | null> }> = ({ result, visible, imageRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current || !imageRef.current || !result.heatmapGrid) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = result.heatmapGrid.length;

    const updateCanvas = () => {
      const rect = img.getBoundingClientRect();
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
          const val = result.heatmapGrid[y][x];
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
      ctx.imageSmoothingQuality = 'high';
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
      className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ zIndex: 10, mixBlendMode: 'screen' }}
    />
  );
};

const ModelFindingCard: React.FC<{ finding: ModelFinding }> = ({ finding }) => (
  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">{finding.name}</span>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
        finding.verdict === 'REAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
        finding.verdict === 'AI_EDITED' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}>
        {finding.verdict} ({finding.confidence}%)
      </span>
    </div>
    <p className="text-[10px] text-slate-400 leading-tight font-medium">{finding.description}</p>
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
      setError(err.message || "A technical failure occurred during neural scan.");
      setStatus(DetectionStatus.ERROR);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setStatus(DetectionStatus.IDLE);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 flex flex-col items-center selection:bg-indigo-500/30">
      <header className="w-full max-w-6xl flex items-center justify-between mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-2xl shadow-indigo-600/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none gradient-text">AI SENTINEL</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1.5">Neural Forensic Engine • v5.6</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-[9px] font-black uppercase text-slate-500 border-l border-slate-800/50 pl-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>Flash Core Active</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Viewport Area */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-[2.5rem] p-6 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2.5">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                Forensic Specimen
              </h2>
              {result && (
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg ${showHeatmap ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}
                >
                  {showHeatmap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showHeatmap ? 'Hide Mask' : 'Show Mask'}
                </button>
              )}
            </div>

            {!image ? (
              <label className="flex flex-col items-center justify-center w-full h-[500px] border-2 border-dashed border-slate-800 rounded-[2rem] cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] transition-all group/upload relative z-10">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 group-hover/upload:scale-110 transition-transform mb-6">
                  <Upload className="w-10 h-10 text-slate-600 group-hover/upload:text-indigo-400 transition-colors" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Deploy Forensic Data</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-widest">Select or Drop Specimen File</p>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="relative z-10">
                <div className="relative flex justify-center bg-black/40 border border-slate-800/50 rounded-3xl p-2 overflow-hidden min-h-[400px] shadow-inner">
                  <div className="relative inline-block self-center">
                    <img 
                      ref={imageRef}
                      src={image.previewUrl} 
                      alt="Specimen" 
                      className="max-w-full max-h-[700px] rounded-2xl block object-contain shadow-2xl transition-all duration-700" 
                      style={{ filter: showHeatmap ? 'brightness(0.3) contrast(1.2)' : 'none' }}
                    />
                    {result && <HeatmapOverlay result={result} visible={showHeatmap} imageRef={imageRef} />}
                  </div>
                  <button onClick={reset} className="absolute top-4 right-4 bg-slate-900/90 hover:bg-red-600 p-3 rounded-2xl text-white border border-slate-700 shadow-xl transition-all hover:scale-110">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {status !== DetectionStatus.SUCCESS && (
                  <button
                    disabled={status === DetectionStatus.LOADING}
                    onClick={handleAnalyze}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[1.5rem] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 text-xs tracking-[0.3em] uppercase"
                  >
                    {status === DetectionStatus.LOADING ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ScanSearch className="w-5 h-5" />}
                    {status === DetectionStatus.LOADING ? 'Inference Engine Processing...' : 'Execute Deep Neural Sweep'}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Intelligence Side */}
        <section className="lg:col-span-5 flex flex-col space-y-8">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl flex-1 flex flex-col min-h-[600px] relative overflow-hidden">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2.5 relative z-10">
              <Fingerprint className="w-4 h-4 text-indigo-500" />
              Intelligence Report
            </h2>

            {status === DetectionStatus.IDLE && !result && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700 py-32 space-y-6 opacity-30 relative z-10">
                <ScanSearch className="w-20 h-20 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Audit Signals Standby</p>
              </div>
            )}

            {status === DetectionStatus.LOADING && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                  <RefreshCcw className="w-16 h-16 text-indigo-500 animate-spin relative z-10" />
                </div>
                <div className="text-center space-y-3">
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Analyzing neural artifacts</p>
                  <p className="text-[9px] text-slate-600 uppercase font-bold">Spectral Sweep in Progress...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 relative z-10">
                <div className="p-8 bg-red-950/20 border border-red-500/30 rounded-[2rem] text-center space-y-6 shadow-2xl">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">System Alert</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-[280px] mx-auto font-medium">
                      {error}
                    </p>
                  </div>
                  <button 
                    onClick={handleAnalyze}
                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Retry Audit
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
                {/* Aggregate Score */}
                <div className="text-center p-8 bg-slate-950/50 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">Diagnostic Verdict</span>
                   <p className={`text-4xl font-black uppercase tracking-tighter ${
                      result.verdict === 'REAL' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' :
                      result.verdict === 'AI_EDITED' ? 'text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]' : 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    }`}>
                      {result.verdict.replace('_', ' ')}
                    </p>
                    <div className="grid grid-cols-3 gap-3 mt-10 pt-10 border-t border-slate-800/50">
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1 uppercase tracking-widest">Real</div>
                        <div className="text-sm font-black text-emerald-400">{result.probabilities.real_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1 uppercase tracking-widest">Edited</div>
                        <div className="text-sm font-black text-orange-400">{result.probabilities.ai_edited_probability}%</div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-500 font-black mb-1 uppercase tracking-widest">Gen</div>
                        <div className="text-sm font-black text-red-500">{result.probabilities.ai_generated_probability}%</div>
                      </div>
                    </div>
                </div>

                {/* Technical Module Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] border-l-4 border-indigo-600 pl-4">Component verification</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {result.modelSpecificFindings.map((finding, idx) => (
                      <ModelFindingCard key={idx} finding={finding} />
                    ))}
                  </div>
                </div>

                {/* Analysis Reasoning */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Forensic logic reasoning</h3>
                  <div className="p-5 bg-slate-950/30 rounded-2xl border border-slate-800/50">
                    <p className="text-slate-400 leading-relaxed text-[11px] font-medium italic">
                      "{result.explanation}"
                    </p>
                  </div>
                </div>

                <button onClick={reset} className="w-full py-5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                  <RefreshCcw className="w-4 h-4" />
                  Initiate New Scan
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-24 py-16 text-center text-slate-700 text-[10px] space-y-8 max-w-5xl border-t border-slate-900 w-full opacity-60 font-medium">
        <div className="flex flex-wrap justify-center gap-12 lg:gap-24 font-black uppercase tracking-[0.3em]">
          <div className="flex flex-col gap-2 items-center">
            <span className="text-slate-400">CLIP ViT-B/32</span>
            <span className="opacity-30">Semantic Encoder</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <span className="text-slate-400">Grad-CAM Activation</span>
            <span className="opacity-30">Feature Mapping</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <span className="text-slate-400">Spectral Sweep</span>
            <span className="opacity-30">Noise Floor Audit</span>
          </div>
        </div>
        <p className="px-12 leading-relaxed uppercase tracking-tighter opacity-40 max-w-2xl mx-auto">
          AI Sentinel provides probabilistic neural analysis. The 'Resource Exhausted' error usually implies the free-tier API rate limit has been reached. Please check ai.google.dev for quota limits.
        </p>
      </footer>
    </div>
  );
};

export default App;
