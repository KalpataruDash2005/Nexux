import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout as apiLogout } from '../services/authService';
import { clearApiCache } from '../services/apiClient';

interface AuthContextType {
    token: string | null;
    user: any | null;
    login: (token: string, user: any) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<any | null>(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const navigate = useNavigate();
    const location = useLocation();

    const login = (newToken: string, newUser: any) => {
        clearApiCache();
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        clearApiCache();
        // Asynchronously notify backend to invalidate token blocklist
        apiLogout().catch(() => {});
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
    };

    useEffect(() => {
        // Protect routes that are not public
        const publicRoutes = [
            '/',
            '/auth',
            '/auth/',
            '/oauth2/callback',
            '/onboarding',
            '/pricing',
            '/pricing/',
            '/about',
            '/about/',
            '/careers',
            '/careers/',
            '/campuses',
            '/campuses/'
        ];
        if (!token && !publicRoutes.includes(location.pathname)) {
            navigate('/auth');
        }
    }, [token, location, navigate]);

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
