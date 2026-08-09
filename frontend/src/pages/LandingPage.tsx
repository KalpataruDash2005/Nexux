import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import { submitFeedback } from '../services/feedbackService';
import PromoVideoMarquee from '../components/PromoVideoMarquee';
import { useAuth } from '../context/AuthContext';

const LandingPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const dashboardTarget = isAuthenticated ? '/dashboard' : '/auth';
    const [mobileOpen, setMobileOpen] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackError, setFeedbackError] = useState('');

    const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFeedbackError('');
        setFeedbackSending(true);
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
            await submitFeedback({
                name: String(data.get('name') || ''),
                email: String(data.get('email') || ''),
                message: String(data.get('message') || ''),
            });
            setFeedbackSent(true);
        } catch {
            setFeedbackError('Could not send your feedback right now. Please try again.');
        } finally {
            setFeedbackSending(false);
        }
    };
    useEffect(() => {
        /* ============ STARFIELD ============ */
        const canvas = document.getElementById('starfield') as HTMLCanvasElement;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            let w: number, h: number, stars: any[] = [];
            const DPR = Math.min(window.devicePixelRatio || 1, 2);
            
            const resizeStarfield = () => {
                w = canvas.width = window.innerWidth * DPR;
                h = canvas.height = window.innerHeight * DPR;
                canvas.style.width = window.innerWidth + 'px';
                canvas.style.height = window.innerHeight + 'px';
                const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
                stars = Array.from({ length: count }, () => ({
                    x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 * DPR + 0.2,
                    baseA: Math.random() * 0.5 + 0.15, speed: Math.random() * 0.015 + 0.003, phase: Math.random() * Math.PI * 2
                }));
            };
            
            let t = 0;
            let animationFrameId: number;
            
            const drawStarfield = () => {
                if(!ctx) return;
                ctx.clearRect(0, 0, w, h);
                t += 1;
                for (const s of stars) {
                    const a = s.baseA + Math.sin(t * s.speed + s.phase) * 0.25;
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(255,255,255,' + Math.max(a, 0) + ')';
                    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                animationFrameId = requestAnimationFrame(drawStarfield);
            };
            
            window.addEventListener('resize', resizeStarfield);
            resizeStarfield();
            drawStarfield();
            
            // Clean up
            return () => {
                window.removeEventListener('resize', resizeStarfield);
                cancelAnimationFrame(animationFrameId);
            };
        }
    }, []);

    useEffect(() => {
        /* ============ CURSOR GLOW + PARALLAX ============ */
        const glow = document.getElementById('cursor-glow');
        const core = document.getElementById('ai-core');
        let mx = window.innerWidth / 2, my = window.innerHeight / 2;
        let shown = false;
        
        const handleMouseMove = (e: MouseEvent) => {
            mx = e.clientX; my = e.clientY;
            if (!shown && glow) { glow.style.opacity = '1'; shown = true; }
            if (glow) glow.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
            if (core) {
                const cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;
                const dx = (mx - cx) / cx, dy = (my - cy) / cy;
                core.style.transform = 'translate(' + (dx * 14) + 'px,' + (dy * 14) + 'px) rotate(' + (dx * 2) + 'deg)';
            }
        };
        
        const handleMouseLeave = () => { if(glow) glow.style.opacity = '0'; shown = false; };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    useEffect(() => {
        /* ============ NAVBAR ON SCROLL ============ */
        const nav = document.getElementById('navbar');
        const handleScroll = () => {
            if(nav) {
                if (window.scrollY > 40) nav.classList.add('scrolled'); 
                else nav.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        /* ============ SCROLL REVEAL ============ */
        const els = document.querySelectorAll('.reveal, .reveal-stagger');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
            });
        }, { threshold: 0.15 });
        els.forEach(el => io.observe(el));
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        /* ============ FAQ ACCORDION ============ */
        const items = document.querySelectorAll('.faq-item');
        const handleFaqClick = (e: Event) => {
            const btn = e.currentTarget as HTMLElement;
            const item = btn.closest('.faq-item') as HTMLElement;
            const a = item.querySelector('.faq-a') as HTMLElement;
            const isOpen = item.classList.contains('open');
            
            document.querySelectorAll('.faq-item.open').forEach(o => {
                if (o !== item) { 
                    o.classList.remove('open'); 
                    (o.querySelector('.faq-a') as HTMLElement).style.maxHeight = '0px'; 
                }
            });
            
            if (isOpen) { 
                item.classList.remove('open'); 
                a.style.maxHeight = '0px'; 
            } else { 
                item.classList.add('open'); 
                a.style.maxHeight = a.scrollHeight + 'px'; 
            }
        };
        
        items.forEach(item => {
            const q = item.querySelector('.faq-q');
            if(q) q.addEventListener('click', handleFaqClick);
        });
        
        return () => {
            items.forEach(item => {
                const q = item.querySelector('.faq-q');
                if(q) q.removeEventListener('click', handleFaqClick);
            });
        };
    }, []);

    return (
        <div className="landing-wrapper">
            <canvas id="starfield"></canvas>
            <div className="grain"></div>
            <div className="vignette"></div>
            <div id="cursor-glow"></div>

            <div className="content">
                <nav id="navbar" className={'landing-nav' + (mobileOpen ? ' mobile-open' : '')}>
                <div className="wrap nav-inner">
                    <Link to="/" className="logo" aria-label="Nexora home"><span className="logo-mark flex items-center justify-center"><span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span><span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span><span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">N</span></span>Nexora</Link>
                    <button className="nav-toggle" aria-label="Toggle menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((o) => !o)}>
                        <span></span><span></span><span></span>
                    </button>
                    <div className="nav-links" onClick={() => setMobileOpen(false)}>
                    <a href="#features">Product</a>
                    <a href="#agents">Agents</a>
                    <Link to={dashboardTarget}>Dashboard</Link>
                    <Link to="/pricing">Pricing</Link>
                    <a href="#faq">FAQ</a>
                    </div>
                    <div className="nav-cta-group" onClick={() => setMobileOpen(false)}>
                    <Link to="/auth" className="nav-signin">Sign in</Link>
                    <Link to="/auth?mode=signup" className="btn btn-primary btn-sm">Launch Nexora</Link>
                    </div>
                </div>
                </nav>

                <section id="hero">
                <div className="hero-video-bg">
                    <video src="/videos/hero-bg.mp4" poster="/videos/hero-poster.jpg" autoPlay muted loop playsInline preload="auto" ref={(el) => { if (el) { el.muted = true; el.playbackRate = 1; } }}></video>
                    <div className="hero-video-overlay"></div>
                    <div className="hero-readability"></div>
                </div>
                <div className="wrap">
                    <span className="eyebrow hero-badge"><i className="pulse-dot"></i> AI Operating System · For Students</span>
                    <h1>Your AI Operating System for<br/><span className="grad-word">Academic &amp; Placement Success</span></h1>
                    <p className="sub">Nexora turns your college life into a single operating system  AI-planned tasks, organized academic workspaces, an ATS-tuned resume, live mock interviews and a mentor that remembers your context.</p>
                    <div className="hero-ctas">
                    <Link to="/auth?mode=signup" className="btn btn-primary">Enter Nexora &rarr;</Link>
                    <a href="#agents" className="btn btn-ghost">See how it works</a>
                    </div>

                    <div className="hero-intro reveal">
                        <span className="eyebrow" style={{justifyContent: 'center'}}>First appearance</span>
                        <h2 className="hero-intro-title">Meet your command center</h2>
                        <p className="hero-intro-sub">This is the first screen you'll see right after signing in — tasks, academics, placement readiness and interviews all reporting back to a single intelligent core.</p>
                    </div>

                    <div className="dashboard-preview mt-12 mb-20 relative w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="dashboard-frame">
                            <div className="dashboard-bar">
                                <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                                <span className="dashboard-url">nexora.ai</span>
                            </div>
                            <img src="/demo-dashboard.jpg" alt="Nexora Demo Dashboard" className="w-full h-auto block" />
                        </div>
                        <div className="dashboard-caption">
                            Your command center  tasks, academics, placement readiness and interviews all reporting back to a single intelligent core.
                        </div>
                    </div>
                    
                    <div className="stat-strip">
                    <div className="stat"><b>340</b><span>Campuses live</span></div>
                    <div className="divider"></div>
                    <div className="stat"><b>91%</b><span>Readiness lift</span></div>
                    <div className="divider"></div>
                    <div className="stat"><b>24/7</b><span>Agent uptime</span></div>
                    </div>

                    <PromoVideoMarquee />
                </div>
                </section>

                <section id="features">
                <div className="wrap">
                    <div className="section-head reveal">
                    <span className="eyebrow" style={{justifyContent:'center'}}>System Modules</span>
                    <h2>Six systems. One operating layer.</h2>
                    <p>Every module works as one unit  your tasks, academics, resume and interviews all report back to a single intelligent core.</p>
                    </div>
                    <div className="feature-grid reveal-stagger">
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M4 19V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13"/><path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"/><path d="M8 8h8M8 12h5"/></svg></div>
                        <h3>Academic Workspaces</h3>
                        <p>Keep courses, notes, PDFs and study chats organized in dedicated workspaces, with everything indexed and one click away.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg></div>
                        <h3>Placement Preparation</h3>
                        <p>Coding problems, aptitude tests and interview sessions that all feed a live placement readiness score.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
                        <h3>AI Resume Analyzer</h3>
                        <p>Upload your resume and get a line-by-line AI analysis and score against recruiter-style parsing rules.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></div>
                        <h3>Mock Interview Room</h3>
                        <p>A live AI interviewer that runs technical, role and HR rounds and scores your clarity and depth.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg></div>
                        <h3>AI Task Assistant</h3>
                        <p>Describe a goal in plain words and the AI plans the work, sets smart deadlines and schedules it around your day.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
                        <h3>AI Assistant &amp; Mentor</h3>
                        <p>A context-aware assistant on every page that remembers your goals and guides your very next step.</p>
                    </div>
                    </div>
                </div>
                </section>

                <section id="agents">
                <div className="wrap">
                    <div className="section-head reveal">
                    <span className="eyebrow" style={{justifyContent:'center'}}>The Agent Layer</span>
                    <h2>Five agents, always awake</h2>
                    <p>Each agent owns one part of your outcome and hands off context to the others  no dashboard-checking required.</p>
                    <div className="agent-core" id="ai-core">
                        <div className="core-glow"></div>
                        <div className="core-ring r1"></div>
                        <div className="core-ring r2"></div>
                        <div className="core-ring r3"></div>
                        <div className="core-sphere"><span className="core-mark">Nora<em>AI</em></span></div>
                    </div>
                    </div>
                    <div className="agent-row reveal-stagger">
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Atlas</div>
                        <div className="agent-role">Academic Agent</div>
                        <p>Keeps your workspaces, notes and study material organized so nothing important slips through.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Forge</div>
                        <div className="agent-role">Resume Agent</div>
                        <p>Analyzes your resume against recruiter-style rules and scores it before you ever send it out.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Scout</div>
                        <div className="agent-role">Placement Agent</div>
                        <p>Tracks your interview, coding and aptitude practice and ranks your readiness for real drives.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Echo</div>
                        <div className="agent-role">Interview Agent</div>
                        <p>Runs you through live mock rounds and rebuilds each one around your weakest answers.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Sage</div>
                        <div className="agent-role">Mentor Agent</div>
                        <p>Remembers your context and preferences, and guides you toward the next right step.</p>
                    </div>
                    </div>
                </div>
                </section>
                
                
                <section id="feedback" className="py-24">
                <div className="wrap">
                    <div className="section-head reveal">
                    <span className="eyebrow" style={{justifyContent:'center'}}>Feedback</span>
                    <h2>Help us improve Nexora.</h2>
                    </div>
                    <div className="reveal flex justify-center mt-12">
                        <div className="glass-card w-full max-w-xl p-8 mx-auto">
                            {feedbackSent ? (
                                <div className="flex flex-col items-center text-center py-4">
                                    <div className="w-14 h-14 rounded-full border-2 border-emerald-400/60 text-emerald-400 flex items-center justify-center mb-4">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg">Thank you!</h3>
                                    <p className="text-[#8E93A0] text-sm mt-1">Your feedback has been sent to the Nexora team.</p>
                                    <button type="button" onClick={() => setFeedbackSent(false)} className="text-[#3E7BFF] text-sm font-medium mt-4 hover:underline">Send another</button>
                                </div>
                            ) : (
                            <form className="space-y-4 flex flex-col" onSubmit={handleFeedbackSubmit}>
                                {feedbackError && (
                                    <div className="flex items-center gap-2 border border-rose-500/40 bg-rose-500/10 rounded-lg px-4 py-3 text-rose-300 text-sm">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        {feedbackError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Your Name</label>
                                    <input type="text" name="name" required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Your Email</label>
                                    <input type="email" name="email" required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white" placeholder="student@university.edu" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Feedback</label>
                                    <textarea name="message" required rows={4} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white resize-none" placeholder="What can we do better?"></textarea>
                                </div>
                                <button type="submit" disabled={feedbackSending} className="btn btn-primary mt-6 self-end disabled:opacity-50" style={{width: '100%'}}>{feedbackSending ? 'Sending...' : 'Submit Feedback'}</button>
                            </form>
                            )}
                        </div>
                    </div>
                </div>
                </section>

                <section id="faq">
                <div className="wrap">
                    <div className="section-head reveal">
                    <span className="eyebrow" style={{justifyContent:'center'}}>Questions</span>
                    <h2>Before you enter the system</h2>
                    </div>
                    <div className="faq-list reveal">
                    <div className="faq-item">
                        <button className="faq-q">How does the AI Task Assistant plan my work?<span className="plus"></span></button>
                        <div className="faq-a"><p>Describe a goal in plain words and it breaks the work into manageable chunks, sets realistic deadlines and schedules each one around the rest of your week so nothing collides.</p></div>
                    </div>
                    <div className="faq-item">
                        <button className="faq-q">How is my placement readiness measured?<span className="plus"></span></button>
                        <div className="faq-a"><p>Every mock interview, coding problem and aptitude question updates a live readiness score across your dashboard, with your weak and strong areas laid out clearly.</p></div>
                    </div>
                    <div className="faq-item">
                        <button className="faq-q">Does the resume analysis use real ATS rules?<span className="plus"></span></button>
                        <div className="faq-a"><p>Yes. The analyzer parses your resume with recruiter-style matching, scores each section and suggests concrete, line-level improvements before you apply.</p></div>
                    </div>
                    <div className="faq-item">
                        <button className="faq-q">Is my academic data private?<span className="plus"></span></button>
                        <div className="faq-a"><p>Yes. Your academic and placement data stays scoped to your account and your campus's console  it's never used to train models outside your instance.</p></div>
                    </div>
                    </div>
                </div>
                </section>

                <footer>
                <div className="wrap">
                    <div className="footer-top">
                    <div className="footer-brand">
                        <Link to="/" className="logo" aria-label="Nexora home"><span className="logo-mark flex items-center justify-center"><span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span><span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span><span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">N</span></span>Nexora</Link>
                        <p>The AI operating system running quietly beneath academic and placement life  tasks, workspaces, resume and interviews in one place, for students who'd rather build than chase.</p>
                    </div>
                    <div className="footer-col">
                        <h4>Product</h4>
                        <a href="#features">Modules</a><a href="#agents">Agents</a><Link to="/pricing">Pricing</Link>
                    </div>
                    <div className="footer-col">
                        <h4>Company</h4>
                        <a href="#">About</a><a href="#">Careers</a><a href="#">Campuses</a>
                    </div>
                    </div>
                    <div className="footer-bottom">
                    <span> 2026 Nexora. All systems operational.</span>
                    <span>Built for students who ship.</span>
                    </div>
                </div>
                </footer>
            </div>
        </div>
    );
};

export default LandingPage;
