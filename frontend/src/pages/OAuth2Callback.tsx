import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuth2Callback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const parseJwt = (token: string): any => {
        try {
            const raw = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
            const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
            return JSON.parse(atob(padded));
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get('token');
        const error = queryParams.get('error');

        if (token) {
            const claims = parseJwt(token);
            const email = claims?.sub && claims.sub !== 'oauth-user' ? claims.sub : 'student';
            login(token, { email, role: 'STUDENT' });
            navigate('/dashboard');
        } else if (error) {
            console.error('OAuth2 Error:', error);
            navigate(`/auth?error=${encodeURIComponent(error)}`);
        } else {
            navigate('/auth');
        }
    }, [location, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-muted">Completing sign in...</p>
            </div>
        </div>
    );
};

export default OAuth2Callback;
