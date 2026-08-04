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
        <div className="min-h-screen flex items-center justify-center bg-[#030303] text-[#F4F5F8] font-sans relative overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,.55) 100%)' }}></div>
            
            <div className="w-full max-w-lg p-8 relative z-10">
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2 font-bold text-lg tracking-wide">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 shadow-[0_0_12px_rgba(62,123,255,0.8)]"></span>
                            CareerOS
                        </div>
                        <div className="flex gap-2">
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-[#3E7BFF]' : 'bg-[rgba(255,255,255,0.1)]'}`}></div>
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-[#3E7BFF]' : 'bg-[rgba(255,255,255,0.1)]'}`}></div>
                            <div className={`w-12 h-1.5 rounded-full transition-colors ${step >= 3 ? 'bg-[#3E7BFF]' : 'bg-[rgba(255,255,255,0.1)]'}`}></div>
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold mb-3">
                        {step === 1 && "Where are you studying?"}
                        {step === 2 && "What are you studying?"}
                        {step === 3 && "What are your top skills?"}
                    </h1>
                    <p className="text-[#8E93A0] text-sm">
                        {step === 1 && "This helps Sage tailor campus-specific drives for you."}
                        {step === 2 && "Atlas uses this to build your initial academic workspace."}
                        {step === 3 && "Forge will highlight these in your baseline resume."}
                    </p>
                </div>

                <div className="bg-[rgba(255,255,255,0.035)] border border-[rgba(255,255,255,0.09)] rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <label className="block text-xs font-medium text-[#8E93A0] mb-2 uppercase tracking-wider">University / College</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5C6070]" />
                                        <input type="text" autoFocus required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#3E7BFF] transition-colors" placeholder="e.g. Stanford University" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[#8E93A0] mb-2 uppercase tracking-wider">Expected Graduation Year</label>
                                    <select required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#3E7BFF] transition-colors appearance-none text-white [&>option]:bg-[#101012]">
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
                                    <label className="block text-xs font-medium text-[#8E93A0] mb-2 uppercase tracking-wider">Major / Degree</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5C6070]" />
                                        <input type="text" autoFocus required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#3E7BFF] transition-colors" placeholder="e.g. Computer Science" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[#8E93A0] mb-2 uppercase tracking-wider">Current Semester</label>
                                    <select required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#3E7BFF] transition-colors appearance-none text-white [&>option]:bg-[#101012]">
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
                                    <label className="block text-xs font-medium text-[#8E93A0] mb-2 uppercase tracking-wider">Key Skills (Comma separated)</label>
                                    <div className="relative">
                                        <Layers className="absolute left-4 top-4 w-5 h-5 text-[#5C6070]" />
                                        <textarea autoFocus required rows={3} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#3E7BFF] transition-colors resize-none" placeholder="e.g. React, Java, Data Structures, Machine Learning" />
                                    </div>
                                </div>
                                <div className="bg-[rgba(62,123,255,0.05)] border border-[rgba(62,123,255,0.2)] rounded-lg p-4 text-xs text-[#6E9CFF] leading-relaxed">
                                    CareerOS will automatically match these skills against incoming placement drives and suggest resume enhancements.
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex items-center justify-between">
                            {step > 1 ? (
                                <button type="button" onClick={() => setStep(step - 1)} className="text-sm font-medium text-[#8E93A0] hover:text-white transition-colors">
                                    Back
                                </button>
                            ) : <div></div>}
                            
                            <button type="submit" className="bg-gradient-to-b from-[#4E88FF] to-[#2E62E0] hover:shadow-[0_12px_30px_-6px_rgba(62,123,255,0.6)] transition-all text-white font-medium rounded-xl px-6 py-3 flex items-center gap-2 ml-auto">
                                {step === 3 ? 'Enter CareerOS' : 'Continue'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
