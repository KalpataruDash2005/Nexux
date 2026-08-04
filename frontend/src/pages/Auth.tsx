import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, User } from 'lucide-react';
import { login as apiLogin, register } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const Auth: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const getErrorMessage = (err: any): string => {
            if (!err?.response?.data) return err?.message || 'An error occurred. Please try again.';
            const data = err.response.data;
            if (typeof data === 'string') return data;
            if (typeof data === 'object' && data !== null) {
                if (data.message) return String(data.message);
                if (data.error) return String(data.error);
            }
            return 'An error occurred. Please try again.';
        };

        try {
            if (isLogin) {
                const response = await apiLogin({ email, password });
                login(response.token, { email, role: response.role || 'STUDENT' });
                navigate('/dashboard');
            } else {
                await register({ email, password, role: 'STUDENT' });
                // Automatically log them in after registration
                const loginRes = await apiLogin({ email, password });
                login(loginRes.token, { email, role: 'STUDENT' });
                navigate('/onboarding');
            }
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#030303] text-[#F4F5F8] font-sans relative overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,.55) 100%)' }}></div>
            
            <div className="w-full max-w-md p-8 relative z-10">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 font-bold text-xl tracking-wide mb-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 shadow-[0_0_12px_rgba(62,123,255,0.8)]"></span>
                        CareerOS
                    </div>
                    <h1 className="text-2xl font-bold mt-6 mb-2">
                        {isLogin ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p className="text-[#8E93A0] text-sm">
                        {isLogin ? 'Enter your details to access your workspace.' : 'Start your journey with the AI Operating System.'}
                    </p>
                </div>

                <div className="bg-[rgba(255,255,255,0.035)] border border-[rgba(255,255,255,0.09)] rounded-2xl p-6 backdrop-blur-xl">
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div>
                                <label className="block text-xs font-medium text-[#8E93A0] mb-1.5 uppercase tracking-wider">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C6070]" />
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#3E7BFF] transition-colors" placeholder="John Doe" />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-[#8E93A0] mb-1.5 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C6070]" />
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#3E7BFF] transition-colors" placeholder="student@university.edu" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[#8E93A0] mb-1.5 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C6070]" />
                                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.09)] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#3E7BFF] transition-colors" placeholder="••••••••" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-b from-[#4E88FF] to-[#2E62E0] hover:shadow-[0_12px_40px_-6px_rgba(62,123,255,0.85)] disabled:opacity-50 transition-all text-white font-medium rounded-xl py-3 flex items-center justify-center gap-2">
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Continue')} {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>

                    <div className="mt-6">
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-[rgba(255,255,255,0.09)]"></div>
                            <span className="flex-shrink-0 mx-4 text-[#5C6070] text-xs uppercase tracking-wider">Or continue with</span>
                            <div className="flex-grow border-t border-[rgba(255,255,255,0.09)]"></div>
                        </div>
                        
                        <div className="mt-4">
                            <button type="button" onClick={() => window.location.href = 'http://localhost:8081/oauth2/authorization/google'} className="w-full flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.09)] transition-colors rounded-xl py-2.5 text-sm font-medium">
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-6 text-sm text-[#8E93A0]">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => setIsLogin(!isLogin)} className="text-[#3E7BFF] hover:text-[#6E9CFF] transition-colors font-medium">
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
