import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const PricingPage: React.FC = () => {
    const plan = (tier: string, price: string, desc: string, items: string[], badge?: string) => (
        <div className={`glass-card price-card ${badge ? 'featured' : ''}`}>
            {badge && <div className="price-badge">{badge}</div>}
            <div className="price-tier">{tier}</div>
            <div className="price-amt">{price}<span> / forever</span></div>
            <p className="price-desc">{desc}</p>
            <ul className="price-list">
                {items.map((item, i) => (
                    <li key={i}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {item}
                    </li>
                ))}
            </ul>
            <Link to="/auth?mode=signup" className="btn btn-primary">{badge === 'Free forever' ? 'Get it free' : 'Start free'}</Link>
        </div>
    );

    return (
        <div className="landing-wrapper">
            <div className="grain"></div>
            <div className="vignette"></div>
            <div className="content">
                <nav id="navbar">
                    <div className="wrap nav-inner">
                        <Link to="/" className="logo" aria-label="Nexora home"><span className="logo-mark flex items-center justify-center"><span className="absolute inset-0 border-t-[1.5px] border-l-[1.5px] border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></span><span className="absolute inset-0 border-b-[1.5px] border-r-[1.5px] border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></span><span className="font-black text-[8px] text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[1px]">N</span></span>Nexora</Link>
                        <div className="nav-cta-group">
                            <Link to="/auth" className="nav-signin">Sign in</Link>
                            <Link to="/auth?mode=signup" className="btn btn-primary btn-sm">Launch Nexora</Link>
                        </div>
                    </div>
                </nav>

                <section id="pricing">
                    <div className="wrap">
                        <div className="section-head reveal">
                            <span className="eyebrow" style={{justifyContent: 'center'}}>Pricing</span>
                            <h1 style={{ fontSize: 'clamp(30px,4vw,46px)', marginTop: '16px' }}>Get it free. Forever.</h1>
                            <p>Nexora is free for students. Every module, every agent, no subscription required.</p>
                        </div>
                        <div className="pricing-grid reveal-stagger">
                            {plan(
                                'Student',
                                '$0',
                                'Everything in Nexora, free for life.',
                                [
                                    'Unlimited academic workspaces',
                                    'AI Task Assistant with smart planning',
                                    'Placement readiness score & practice',
                                    'ATS resume analyzer',
                                    'Live mock interview room',
                                    '24/7 mentor agent (Nora)',
                                    'AI assistant on every page',
                                ],
                                'Free forever'
                            )}
                            {plan(
                                'Campus',
                                '$0',
                                'Free for campuses and universities.',
                                [
                                    'All Student features',
                                    'Campus console & analytics',
                                    'Agent deployment per department',
                                    'Onboarding for entire batch',
                                    'Priority support',
                                ]
                            )}
                            {plan(
                                'Enterprise',
                                '$0',
                                'Custom deployments on request.',
                                ['Self-hosted instance', 'Private data residency', 'Custom agents & models', 'Dedicated engineering help'],
                                'Early access'
                            )}
                        </div>
                        <div className="reveal" style={{ textAlign: 'center', marginTop: '48px' }}>
                            <Link to="/auth?mode=signup" className="btn btn-primary">Get it free &rarr;</Link>
                        </div>
                    </div>
                </section>

                <footer>
                    <div className="wrap">
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

export default PricingPage;