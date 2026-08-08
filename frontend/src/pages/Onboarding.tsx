import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Layers, ArrowRight } from 'lucide-react';

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (step < 3) {
            setStep(step + 1);
        } else {
            // Finish onboarding
            navigate('/dashboard');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-sans relative overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(68,76,231,0.06) 100%)' }}></div>
            
            <div className="w-full max-w-lg p-8 relative z-10">
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3 font-bold text-xl tracking-wide">
                            <div className="w-7 h-7 relative flex items-center justify-center shrink-0">
                                <div className="absolute inset-0 border-t-2 border-l-2 border-sky-500 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></div>
                                <div className="absolute inset-0 border-b-2 border-r-2 border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></div>
                                <span className="font-black text-[10px] text-transparent bg-clip-text bg-gradient-to-br from-sky-500 to-indigo-600 leading-none mt-[-1px]">
                                    N
                                </span>
                            </div>
                            Nexora
                        </div>
                        <div className="flex gap-2">
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-slate-200'}`}></div>
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`}></div>
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-slate-200'}`}></div>
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold mb-3">
                        {step === 1 && "Where are you studying?"}
                        {step === 2 && "What are you studying?"}
                        {step === 3 && "What are your top skills?"}
                    </h1>
                    <p className="text-muted text-sm">
                        {step === 1 && "This helps Sage tailor campus-specific drives for you."}
                        {step === 2 && "Atlas uses this to build your initial academic workspace."}
                        {step === 3 && "Forge will highlight these in your baseline resume."}
                    </p>
                </div>

                <div className="bg-white border border-border rounded-2xl p-6 md:p-8 shadow-card">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">University / College</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input type="text" autoFocus required className="w-full bg-white border border-border rounded-xl pl-12 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors" placeholder="e.g. Stanford University" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Expected Graduation Year</label>
                                    <select required className="w-full bg-white border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors appearance-none">
                                        <option value="" disabled selected>Select a year</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                        <option value="2028">2028</option>
                                        <option value="2029">2029</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Major / Degree</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input type="text" autoFocus required className="w-full bg-white border border-border rounded-xl pl-12 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors" placeholder="e.g. Computer Science" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Current Semester</label>
                                    <select required className="w-full bg-white border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors appearance-none">
                                        <option value="" disabled selected>Select current semester</option>
                                        <option value="1">Semester 1</option>
                                        <option value="2">Semester 2</option>
                                        <option value="3">Semester 3</option>
                                        <option value="4">Semester 4</option>
                                        <option value="5">Semester 5</option>
                                        <option value="6">Semester 6</option>
                                        <option value="7">Semester 7</option>
                                        <option value="8">Semester 8</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Key Skills (Comma separated)</label>
                                    <div className="relative">
                                        <Layers className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                        <textarea autoFocus required rows={3} className="w-full bg-white border border-border rounded-xl pl-12 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors resize-none" placeholder="e.g. React, Java, Data Structures, Machine Learning" />
                                    </div>
                                </div>
                                <div className="bg-primary-tint border border-primary-soft rounded-lg p-4 text-xs text-primary leading-relaxed">
                                    Nexora will automatically match these skills against incoming placement drives and suggest resume enhancements.
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex items-center justify-between">
                            {step > 1 ? (
                                <button type="button" onClick={() => setStep(step - 1)} className="text-sm font-medium text-muted hover:text-foreground transition-colors">
                                    Back
                                </button>
                            ) : <div></div>}
                            
                            <button type="submit" className="bg-primary hover:bg-primary-hover shadow-[0_12px_30px_-8px_rgba(68,76,231,0.6)] transition-all text-white font-medium rounded-xl px-6 py-3 flex items-center gap-2 ml-auto">
                                {step === 3 ? 'Enter Nexora' : 'Continue'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
