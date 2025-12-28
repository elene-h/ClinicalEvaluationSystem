
import React, { useState, useEffect } from 'react';
import { AppMode, ClinicalCase, AnalysisResult } from './types';
import { BENCHMARK_CASES } from './constants';
import { analyzeCase } from './geminiService';

declare global {
  // Use the expected AIStudio type name and ensure modifiers match existing global declarations
  interface AIStudio {
    hasSelectedApiKey(): Promise<boolean>;
    openSelectKey(): Promise<void>;
  }

  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.USER);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [task, setTask] = useState<string>('');
  const [supplementalInfo, setSupplementalInfo] = useState<string[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<number, string>>({});
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } catch (e) {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    await window.aistudio.openSelectKey();
    // Mitigate race condition by assuming success
    setHasApiKey(true);
  };

  const handleModeToggle = (newMode: AppMode) => {
    setMode(newMode);
    resetState();
    if (newMode === AppMode.USER) {
      setNote('');
      setTask('');
      setSelectedCaseId('');
    }
  };

  const resetState = () => {
    setResult(null);
    setError(null);
    setSupplementalInfo([]);
    setCurrentAnswers({});
  };

  const handleCaseSelect = (caseId: string) => {
    const c = BENCHMARK_CASES.find(item => item.id === caseId);
    if (c) {
      setSelectedCaseId(caseId);
      setNote(c.note);
      setTask(c.task);
      resetState();
    }
  };

  const runAnalysis = async (isRefining = false) => {
    if (!note.trim() || !task.trim()) {
      setError("Please provide both a clinical note and a task.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    const fullContext = isRefining && supplementalInfo.length > 0
      ? `${note}\n\n[SUPPLEMENTAL UPDATES]:\n${supplementalInfo.join('\n')}`
      : note;

    try {
      const analysis = await analyzeCase(fullContext, task);
      setResult(analysis);
      setCurrentAnswers({});
    } catch (err: any) {
      console.error(err);
      handleAnalysisError(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Centralized error handling for API calls
  const handleAnalysisError = (err: any) => {
    const errorMessage = err.message || "Failed to analyze.";
    if (errorMessage.includes("Requested entity was not found")) {
      setHasApiKey(false);
      setError("API Key session expired. Please re-select your key.");
    } else {
      setError(errorMessage);
    }
  };

  const handleSubmitAnswers = () => {
    const answersArray = Object.entries(currentAnswers)
      .filter(([_, val]) => (val as string).trim() !== "")
      .map(([idx, val]) => `Answer to Q${Number(idx) + 1}: ${val}`);
    
    if (answersArray.length === 0) return;

    setSupplementalInfo(prev => [...prev, ...answersArray]);
    const newSupp = [...supplementalInfo, ...answersArray];
    const updatedContext = `${note}\n\n[SUPPLEMENTAL UPDATES]:\n${newSupp.join('\n')}`;
    
    (async () => {
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeCase(updatedContext, task);
        setResult(analysis);
        setCurrentAnswers({});
      } catch (err: any) {
        handleAnalysisError(err);
      } finally {
        setIsAnalyzing(false);
      }
    })();
  };

  if (hasApiKey === null) return null;

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Advanced Clinical Access</h1>
          <p className="text-sm text-slate-500">Accessing the Clinical Evaluation System requires a valid Gemini API Key from a paid project. Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">billing documentation</a> for details.</p>
          <button onClick={handleOpenKeyDialog} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors">
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Clinical Evaluation System</h1>
        </div>
        <div className="flex bg-slate-800 rounded-full p-1 border border-slate-700">
          <button onClick={() => handleModeToggle(AppMode.USER)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === AppMode.USER ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>User Mode</button>
          <button onClick={() => handleModeToggle(AppMode.BENCHMARK)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === AppMode.BENCHMARK ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Benchmark Mode</button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Input Data
            </h2>

            {mode === AppMode.BENCHMARK && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2 uppercase tracking-tighter opacity-70">Benchmark Case Template</label>
                <select value={selectedCaseId} onChange={(e) => handleCaseSelect(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none font-medium">
                  <option value="">-- Choose a standardized case --</option>
                  {BENCHMARK_CASES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Clinical Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Paste observation notes, lab results, or patient history..."
                  className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm font-mono leading-relaxed outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {supplementalInfo.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest">Feedback History</label>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                    {supplementalInfo.map((info, idx) => (
                      <div key={idx} className="text-xs text-blue-800 font-medium flex items-start border-b border-blue-100/50 pb-1 last:border-0">
                        <span className="mr-2 opacity-50">#{(idx+1)}</span>
                        <span>{info}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Primary Task</label>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="e.g., 'Determine sepsis risk' or 'Identify missing labs'"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              onClick={() => runAnalysis(false)}
              disabled={isAnalyzing}
              className={`mt-6 w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-lg text-white font-bold transition-all ${isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-[0.98]'}`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Performing Reasoning...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Evaluate Safety</span>
                </>
              )}
            </button>
            <button onClick={resetState} className="mt-3 w-full text-[10px] text-slate-300 hover:text-slate-500 uppercase font-black tracking-widest transition-colors">Reset Session</button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-medium animate-pulse">
                ERR: {error}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!result && !isAnalyzing && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Clinical Dashboard</h3>
              <p className="max-w-xs mt-2 text-sm leading-relaxed">Safety-critical analysis and visual insights will appear here after evaluation.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 space-y-6 bg-white rounded-2xl border border-slate-100">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-50 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold text-slate-900 animate-pulse tracking-tight">Processing Reasoning Protocols</p>
                <p className="text-sm text-slate-400">Cross-referencing informational sufficiency...</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
              {/* Decision Section */}
              <div className={`rounded-2xl border-2 shadow-xl overflow-hidden bg-white ${result.decision === 'ASK' ? 'border-amber-200' : 'border-emerald-200'}`}>
                <div className={`px-8 py-5 border-b-2 flex items-center justify-between ${result.decision === 'ASK' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center space-x-4">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-inner font-black text-xl ${result.decision === 'ASK' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {result.decision === 'ASK' ? '!' : '✓'}
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">System Decision</p>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{result.decision}</h3>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* Visual Analysis if available */}
                  {result.imageUrl && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                        AI Clinical Visualization
                      </h4>
                      <div className="rounded-xl overflow-hidden border border-slate-100 shadow-lg bg-slate-50">
                        <img src={result.imageUrl} alt="Clinical Visual Aid" className="w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-500 cursor-zoom-in" />
                        <div className="p-3 text-[10px] text-slate-400 italic text-center border-t border-slate-100">
                          Synthetic diagnostic aid for informational clarity. Do not use for definitive diagnosis.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnostic Rationale</h4>
                    <p className="text-slate-800 text-lg leading-relaxed font-medium italic bg-slate-50 p-4 rounded-xl border-l-4 border-blue-500">{result.rationale}</p>
                  </div>

                  {result.decision === 'ASK' && result.questions && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feedback Required</h4>
                        <span className="text-[10px] bg-amber-600 text-white px-3 py-1 rounded-full font-black tracking-widest animate-pulse">ACTION NEEDED</span>
                      </div>
                      <div className="space-y-4">
                        {result.questions.map((q, i) => (
                          <div key={i} className="group space-y-3 bg-white p-5 rounded-2xl border-2 border-slate-100 hover:border-blue-500 transition-all shadow-sm">
                            <label className="text-md font-bold text-slate-900 flex items-start leading-snug">
                              <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black mr-3 mt-0.5 shrink-0 group-hover:bg-blue-600 transition-colors">{i+1}</span>
                              {q}
                            </label>
                            <input
                              type="text"
                              value={currentAnswers[i] || ""}
                              onChange={(e) => setCurrentAnswers(prev => ({...prev, [i]: e.target.value}))}
                              placeholder="Clinical input response..."
                              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all"
                            />
                          </div>
                        ))}
                        <button
                          onClick={handleSubmitAnswers}
                          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-600 shadow-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center space-x-3"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span>REFINE ANALYSIS</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {result.decision === 'ANSWER' && (
                    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Clinical Evaluation</h4>
                        <div className="bg-emerald-50/50 p-6 rounded-2xl border-2 border-emerald-100 text-slate-900 text-xl font-bold leading-relaxed shadow-sm">
                          {result.answer}
                        </div>
                      </div>
                      {result.evidence && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supporting Evidence (Note Grounding)</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {result.evidence.map((e, i) => (
                              <div key={i} className="text-sm text-slate-600 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 flex items-start italic">
                                <span className="text-emerald-500 font-black mr-3">"</span>
                                {e}
                                <span className="text-emerald-500 font-black ml-1">"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Visual Metrics */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Safety Protocol Assessment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <AssessmentItem label="Plausibility" value={result.selfAssessment.plausibility} icon="🏥" />
                  <AssessmentItem label="Sensitivity" value={result.selfAssessment.causalSensitivity} icon="🧪" />
                  <AssessmentItem label="Hallucination" value={result.selfAssessment.hallucinationCheck} icon="🛡️" inverted />
                  <AssessmentItem label="Confidence" value={result.selfAssessment.confidence} icon="🎯" />
                </div>
                
                {/* Visual Gauge for Overall Confidence */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Confidence Visualizer</p>
                   <ConfidenceGauge value={result.selfAssessment.confidence} />
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="bg-white border-t border-slate-100 py-10 text-center space-y-4">
        <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">&copy; {new Date().getFullYear()} Clinical Evaluation System - Safety Research</p>
        <div className="flex items-center justify-center space-x-4 opacity-30 grayscale contrast-125">
           <div className="w-8 h-8 bg-blue-600 rounded"></div>
           <div className="w-8 h-8 bg-slate-900 rounded-full"></div>
           <div className="w-8 h-8 bg-emerald-500 rounded-sm"></div>
        </div>
      </footer>
    </div>
  );
};

const ConfidenceGauge: React.FC<{ value: string }> = ({ value }) => {
  const score = value === 'HIGH' ? 90 : value === 'MODERATE' ? 50 : 15;
  const color = value === 'HIGH' ? '#10b981' : value === 'MODERATE' ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-32 h-20" viewBox="0 0 100 60">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="8" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${score * 1.25}, 125`} />
      </svg>
      <div className="absolute bottom-0 text-center">
        <span className="text-xl font-black text-slate-900 uppercase tracking-tighter">{value}</span>
      </div>
    </div>
  );
};

const AssessmentItem: React.FC<{ label: string, value: string, icon: string, inverted?: boolean }> = ({ label, value, icon, inverted }) => {
  const isGood = inverted ? value === 'NO' : (value === 'HIGH' || value === 'CAUSALLY SENSITIVE');
  const isBad = inverted ? value === 'YES' : (value === 'LOW' || value === 'CAUSALLY INSENSITIVE');
  
  let colorClass = 'bg-slate-50 text-slate-400 border-slate-100';
  if (isGood) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (isBad) colorClass = 'bg-red-50 text-red-700 border-red-100';
  
  return (
    <div className={`p-4 rounded-2xl border shadow-sm flex flex-col items-center space-y-2 transition-colors duration-500 bg-white`}>
      <div className="flex items-center space-x-2">
        <span className="text-xl grayscale hover:grayscale-0 transition-all cursor-default">{icon}</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${colorClass} uppercase tracking-tighter`}>{value}</span>
    </div>
  );
};

export default App;
