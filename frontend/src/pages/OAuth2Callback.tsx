import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuth2Callback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get('token');
        const error = queryParams.get('error');

        if (token) {
            login(token, { email: 'oauth-user', role: 'STUDENT' });
            // Ideally we'd decode JWT to check if it's a new user and send to onboarding, 
            // but we'll default to dashboard for now.
            navigate('/dashboard');
        } else if (error) {
            console.error('OAuth2 Error:', error);
            navigate(`/auth?error=${encodeURIComponent(error)}`);
        } else {
            navigate('/auth');
        }
    }, [location, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#030303] text-[#F4F5F8]">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-[#3E7BFF] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[#8E93A0]">Completing sign in...</p>
            </div>
        </div>
    );
};

export default OAuth2Callback;
