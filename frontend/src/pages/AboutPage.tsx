import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './LandingPage.css';
import { useAuth } from '../context/AuthContext';

interface AboutPageProps {
  initialTab?: 'about' | 'careers' | 'campuses';
}

const AboutPage: React.FC<AboutPageProps> = ({ initialTab = 'about' }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || initialTab;
  const [campusSubmitted, setCampusSubmitted] = useState(false);
  const [careerSubmitted, setCareerSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Sanitize any leftover hash from history
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    const els = document.querySelectorAll('.reveal, .reveal-stagger');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('visible');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const dashboardTarget = user ? '/dashboard' : '/auth';

  return (
    <div className="landing-wrapper">
      <div className="grain"></div>
      <div className="vignette"></div>

      <div className="content">
        {/* Navigation */}
        <nav id="navbar" className="landing-nav">
          <div className="wrap nav-inner">
            <Link to="/" className="logo" aria-label="Nexora home">
              <span className="logo-mark flex items-center justify-center">
                <span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span>
                <span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span>
                <span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">
                  N
                </span>
              </span>
              Nexora
            </Link>
            <div className="nav-links">
              <Link to="/">Home</Link>
              <Link to="/about">About</Link>
              <Link to={dashboardTarget}>Dashboard</Link>
              <Link to="/pricing">Pricing</Link>
            </div>
            <div className="nav-cta-group">
              <Link to="/auth" className="nav-signin">
                Sign in
              </Link>
              <Link to="/auth?mode=signup" className="btn btn-primary btn-sm">
                Launch Nexora
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section style={{ paddingTop: '160px', paddingBottom: '70px', textAlign: 'center' }}>
          <div className="wrap">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>
              Company &amp; Architecture
            </span>
            <h1 style={{ fontSize: 'clamp(32px, 4.4vw, 54px)', marginTop: '20px', maxWidth: '860px', margin: '20px auto 0' }}>
              Built for students who <span className="grad-word">ship real outcomes</span>
            </h1>
            <p className="sub" style={{ maxWidth: '640px', margin: '22px auto 0', color: 'var(--muted)', fontSize: '16.5px', lineHeight: '1.75' }}>
              Nexora is the unified operating system connecting academic coursework, daily productivity, resume optimization, and placement readiness into a single intelligent core.
            </p>
          </div>
        </section>

        {/* Mission & Story Section */}
        <section style={{ padding: '60px 0' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow" style={{ justifyContent: 'center' }}>Our Purpose</span>
              <h2>Why We Built Nexora</h2>
              <p>
                Every student spends hours context-switching between 6 to 10 disconnected tools — Notion, Google Drive, LeetCode, Overleaf, ChatGPT, Canva, and college portals. None of them share context.
              </p>
            </div>

            <div className="feature-grid reveal-stagger">
              <div className="glass-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3>The Fragmentation Problem</h3>
                <p>
                  Courses in one tab, coding practice in another, resume PDFs in a folder, and mock interview notes scattered everywhere. When campus drive season arrives, students are scrambling without a unified picture of readiness.
                </p>
              </div>

              <div className="glass-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <h3>The Operating System Approach</h3>
                <p>
                  Nexora unifies everything under one persistent context engine (Nora AI). When you upload a course syllabus or solve an algorithm challenge, your placement score updates and your resume suggestions adapt automatically.
                </p>
              </div>

              <div className="glass-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3>Student-First &amp; Privacy-Centric</h3>
                <p>
                  Your academic documents, mock interview transcripts, and code submissions are private to your account. We never sell your data or train external public models on your personal materials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The Nora Multi-Agent Philosophy */}
        <section style={{ padding: '70px 0', borderTop: '1px solid var(--border)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow" style={{ justifyContent: 'center' }}>Autonomous Intelligence</span>
              <h2>Five Specialized Agents. One Core.</h2>
              <p>Rather than a generic chatbot that forgets who you are, Nexora orchestrates five distinct agents that specialize in each stage of your academic career.</p>
            </div>

            <div className="agent-row reveal-stagger">
              <div className="agent-card">
                <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                <div className="agent-name">Atlas</div>
                <div className="agent-role">Academic Agent</div>
                <p>Indexes syllabus files, summarizes lecture notes, and structures semester study sprints.</p>
              </div>
              <div className="agent-card">
                <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                <div className="agent-name">Forge</div>
                <div className="agent-role">Resume Agent</div>
                <p>Parses your resume against ATS rules and gives quantified improvements before recruiters see it.</p>
              </div>
              <div className="agent-card">
                <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                <div className="agent-name">Scout</div>
                <div className="agent-role">Placement Agent</div>
                <p>Tracks DSA mastery, aptitude scores, and company-specific drive readiness in real time.</p>
              </div>
              <div className="agent-card">
                <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                <div className="agent-name">Echo</div>
                <div className="agent-role">Interview Agent</div>
                <p>Simulates real-world technical and HR interview rounds with speech synthesis and dynamic follow-ups.</p>
              </div>
              <div className="agent-card">
                <div className="agent-status"><span className="dot-pulse"></span>Active</div>
                <div className="agent-name">Sage</div>
                <div className="agent-role">Mentor Agent</div>
                <p>Synthesizes your holistic progress and offers personalized strategic advice when you need guidance.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Campuses & Institutional Partnerships */}
        <section id="campuses" style={{ padding: '70px 0', borderTop: '1px solid var(--border)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow" style={{ justifyContent: 'center' }}>Institutions</span>
              <h2>Nexora for Universities &amp; Campuses</h2>
              <p>Over 340 colleges and universities deploy Nexora to give their entire student body instant access to AI academic tooling and verified placement readiness.</p>
            </div>

            <div className="glass-card max-w-2xl mx-auto p-8 reveal" style={{ marginTop: '20px' }}>
              {campusSubmitted ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-white font-bold text-lg">Inquiry Received</h3>
                  <p className="text-[#8E93A0] text-sm mt-2">Our campus partnership team will connect with your institution within 24 hours.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setCampusSubmitted(true);
                  }}
                  className="space-y-4 flex flex-col text-left"
                >
                  <div>
                    <label className="block text-sm text-[#8E93A0] mb-2">Institution Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Institute of Technology"
                      className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3E7BFF]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#8E93A0] mb-2">Coordinator Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Sarah Johnson"
                        className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3E7BFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#8E93A0] mb-2">Official Email (.edu / .ac.in)</label>
                      <input
                        type="email"
                        required
                        placeholder="placement@university.edu"
                        className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3E7BFF]"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary mt-4" style={{ width: '100%' }}>
                    Request Campus Onboarding &rarr;
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Careers & Engineering Roles */}
        <section id="careers" style={{ padding: '70px 0', borderTop: '1px solid var(--border)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow" style={{ justifyContent: 'center' }}>Careers</span>
              <h2>Join the Nexora Engineering Team</h2>
              <p>We are a distributed team of engineers, designers, and AI researchers building infrastructure for the next generation of knowledge workers.</p>
            </div>

            <div className="feature-grid reveal-stagger">
              <div className="glass-card">
                <div className="price-badge">Full-time · Remote</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Full Stack AI Systems Engineer</h3>
                <p className="mt-2 text-sm text-[#8E93A0]">
                  Architect real-time streaming LLM pipelines, FastAPI backends, and high-performance React frontends with Monaco code execution.
                </p>
                <a href="mailto:careers@nexora.ai?subject=Full%20Stack%20AI%20Systems%20Engineer" className="btn btn-ghost btn-sm mt-4">
                  Apply via Email &rarr;
                </a>
              </div>

              <div className="glass-card">
                <div className="price-badge">Full-time · Remote</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Agentic Workflow &amp; Evaluation Specialist</h3>
                <p className="mt-2 text-sm text-[#8E93A0]">
                  Design multi-agent tool-calling loops, AST code parsers, and grounded career readiness evaluation algorithms.
                </p>
                <a href="mailto:careers@nexora.ai?subject=Agentic%20Workflow%20Specialist" className="btn btn-ghost btn-sm mt-4">
                  Apply via Email &rarr;
                </a>
              </div>

              <div className="glass-card">
                <div className="price-badge">Student Fellow · Remote</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Campus Ambassador &amp; Student Lead</h3>
                <p className="mt-2 text-sm text-[#8E93A0]">
                  Lead hackathons, organize coding mock rounds, and bring Nexora's free AI platform to students at your university campus.
                </p>
                <a href="mailto:careers@nexora.ai?subject=Campus%20Ambassador%20Role" className="btn btn-ghost btn-sm mt-4">
                  Apply via Email &rarr;
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer>
          <div className="wrap">
            <div className="footer-top">
              <div className="footer-brand">
                <Link to="/" className="logo" aria-label="Nexora home">
                  <span className="logo-mark flex items-center justify-center">
                    <span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span>
                    <span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span>
                    <span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">
                      N
                    </span>
                  </span>
                  Nexora
                </Link>
                <p>The AI operating system running quietly beneath academic and placement life — tasks, workspaces, resume and interviews in one place, for students who ship.</p>
                <div className="footer-badge mt-4">
                  <span className="dot-pulse"></span>
                  <span>All Systems Operational</span>
                </div>
              </div>
              <div className="footer-col">
                <h4>Product</h4>
                <Link to="/">System Modules</Link>
                <Link to="/">Nora AI Agents</Link>
                <Link to={dashboardTarget}>Student Dashboard</Link>
                <Link to="/pricing">Pricing (100% Free)</Link>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <Link to="/about">About Nexora</Link>
                <Link to="/careers">Careers &amp; Interns</Link>
                <Link to="/campuses">University Campuses</Link>
              </div>
              <div className="footer-col">
                <h4>Resources</h4>
                <Link to="/">Platform FAQ</Link>
                <Link to="/auth">Sign In</Link>
                <Link to="/auth?mode=signup">Get Started</Link>
                <a href="mailto:support@nexora.ai">Contact Support</a>
              </div>
            </div>
            <div className="footer-bottom">
              <span>&copy; {new Date().getFullYear()} Nexora Technologies Inc. All rights reserved.</span>
              <span>Built for students who ship.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AboutPage;
