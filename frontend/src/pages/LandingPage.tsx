import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
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
        /* ============ HERO DUST PARTICLES ============ */
        const canvas = document.getElementById('hero-particles') as HTMLCanvasElement;
        if (canvas && canvas.parentElement) {
            const ctx = canvas.getContext('2d');
            let w: number, h: number, parts: any[] = [];
            const DPR = Math.min(window.devicePixelRatio || 1, 2);
            
            const resizeParticles = () => {
                const rect = canvas.parentElement!.getBoundingClientRect();
                w = canvas.width = rect.width * DPR;
                h = canvas.height = rect.height * DPR;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                parts = Array.from({ length: 40 }, () => ({
                    x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 * DPR + 0.4,
                    vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, a: Math.random() * 0.4 + 0.1
                }));
            };
            
            let animationFrameId: number;
            const drawParticles = () => {
                if(!ctx) return;
                ctx.clearRect(0, 0, w, h);
                for (const p of parts) {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(140,170,255,' + p.a + ')';
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                animationFrameId = requestAnimationFrame(drawParticles);
            };
            
            window.addEventListener('resize', resizeParticles);
            resizeParticles();
            drawParticles();
            
            return () => {
                window.removeEventListener('resize', resizeParticles);
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
                <nav id="navbar">
                <div className="wrap nav-inner">
                    <div className="logo"><span className="logo-mark flex items-center justify-center"><span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span><span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span><span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">N</span></span>Nexora</div>
                    <div className="nav-links">
                    <a href="#features">Product</a>
                    <a href="#agents">Agents</a>
                    <a href="#dashboard">Dashboard</a>
                    <a href="#pricing">Pricing</a>
                    <a href="#faq">FAQ</a>
                    </div>
                    <div className="nav-cta-group">
                    <Link to="/auth" className="nav-signin">Sign in</Link>
                    <Link to="/auth" className="btn btn-primary btn-sm">Launch Nexora</Link>
                    </div>
                </div>
                </nav>

                <section id="hero">
                <div className="wrap">
                    <span className="eyebrow">AI Operating System - For Students</span>
                    <div className="hero-stage">
                    <canvas id="hero-particles"></canvas>
                    <div className="ai-core-wrap" id="ai-core">
                        <div className="core-glow"></div>
                        <div className="core-ring r1"></div>
                        <div className="core-ring r2"></div>
                        <div className="core-ring r3"></div>
                        <div className="core-sphere"></div>
                    </div>
                    </div>
                    <h1>Your AI Operating System for<br/>Academic &amp; Placement Success</h1>
                    <p className="sub">Nexora runs quietly behind every decision you make in college  tracking coursework, building your resume, training you for interviews, and clearing a straight path to placement.</p>
                    <div className="hero-ctas">
                    <Link to="/auth" className="btn btn-primary">Enter Nexora</Link>
                    <a href="#agents" className="btn btn-ghost">Watch it think</a>
                    </div>
                    
                    <div className="dashboard-preview mt-16 mb-16 relative w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-[rgba(255,255,255,0.1)] shadow-[0_0_50px_rgba(62,123,255,0.3)] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <img src="/demo-dashboard.jpg" alt="Nexora Demo Dashboard" className="w-full h-auto block" />
                    </div>

                    <div className="stat-strip">
                    <div className="stat"><b>12,400+</b><span>Students onboard</span></div>
                    <div className="divider"></div>
                    <div className="stat"><b>340</b><span>Campuses live</span></div>
                    <div className="divider"></div>
                    <div className="stat"><b>91%</b><span>Readiness lift</span></div>
                    <div className="divider"></div>
                    <div className="stat"><b>24/7</b><span>Agent uptime</span></div>
                    </div>
                </div>
                </section>

                <section id="features">
                <div className="wrap">
                    <div className="section-head reveal">
                    <span className="eyebrow" style={{justifyContent:'center'}}>System Modules</span>
                    <h2>Six systems. One operating layer.</h2>
                    <p>Every part of student life Nexora touches, engineered as a distinct intelligence that reports back to one core.</p>
                    </div>
                    <div className="feature-grid reveal-stagger">
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M4 19V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13"/><path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"/><path d="M8 8h8M8 12h5"/></svg></div>
                        <h3>Academic Intelligence</h3>
                        <p>Live GPA modeling, syllabus tracking and exam forecasting that flags risk before it becomes a grade.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg></div>
                        <h3>Placement Engine</h3>
                        <p>Matches your profile against live company drives and ranks your odds against real hiring bars.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
                        <h3>AI Resume Studio</h3>
                        <p>Rewrites and scores your resume line by line against ATS parsers used by real recruiters.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></div>
                        <h3>Mock Interview Room</h3>
                        <p>A voice-driven AI interviewer that adapts difficulty in real time and scores tone, clarity and depth.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg></div>
                        <h3>AI Career Mentor</h3>
                        <p>A standing agent that studies your trajectory and nudges you toward the roles you're actually built for.</p>
                    </div>
                    <div className="glass-card tilt-target">
                        <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
                        <h3>Daily Planner</h3>
                        <p>Rebuilds your schedule every morning around deadlines, energy and what actually moves the needle.</p>
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
                    </div>
                    <div className="agent-row reveal-stagger">
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Atlas</div>
                        <div className="agent-role">Academic Agent</div>
                        <p>Watches every course, deadline and grade curve so nothing slips silently.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Forge</div>
                        <div className="agent-role">Resume Agent</div>
                        <p>Continuously rewrites your resume against the exact role you're chasing.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Scout</div>
                        <div className="agent-role">Placement Agent</div>
                        <p>Scans live drives daily and ranks each one against your actual readiness.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Echo</div>
                        <div className="agent-role">Interview Agent</div>
                        <p>Runs you through mock rounds and rebuilds them around your weak spots.</p>
                    </div>
                    <div className="agent-card">
                        <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                        <div className="agent-name">Sage</div>
                        <div className="agent-role">Mentor Agent</div>
                        <p>Holds the long view  career direction, skill gaps, what to learn next.</p>
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
                            <form className="space-y-4 flex flex-col" onSubmit={(e) => { e.preventDefault(); alert('Feedback submitted! Thank you.'); }}>
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Your Name</label>
                                    <input type="text" required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Your Email</label>
                                    <input type="email" required className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white" placeholder="student@university.edu" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#8E93A0] mb-2 text-left">Feedback</label>
                                    <textarea required rows={4} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-lg px-4 py-3 focus:border-[#3E7BFF] focus:outline-none text-white resize-none" placeholder="What can we do better?"></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary mt-6 self-end" style={{width: '100%'}}>Submit Feedback</button>
                            </form>
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
                        <button className="faq-q">Does Nexora replace my college's placement cell?<span className="plus"></span></button>
                        <div className="faq-a"><p>No. It sits alongside it  Scout pulls in drives your cell posts and ranks them against your profile, so nothing your cell shares gets missed.</p></div>
                    </div>
                    <div className="faq-item">
                        <button className="faq-q">How does Forge actually improve my resume?<span className="plus"></span></button>
                        <div className="faq-a"><p>Forge rewrites each line against the ATS parser style of your target role, then scores the result before you ever send it out.</p></div>
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
                        <div className="logo"><span className="logo-mark flex items-center justify-center"><span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span><span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span><span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">N</span></span>Nexora</div>
                        <p>The AI operating system running quietly beneath academic and placement life, for students who'd rather build than chase.</p>
                    </div>
                    <div className="footer-col">
                        <h4>Product</h4>
                        <a href="#features">Modules</a><a href="#agents">Agents</a><a href="#pricing">Pricing</a>
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
