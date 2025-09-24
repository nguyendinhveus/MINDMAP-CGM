import React, { useState, useEffect } from 'react';
import { cognitoConfig } from '../utils/cognitoConfig'; // Đảm bảo tên file khớp

const Login = ({ onLogin }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        // Xử lý callback từ Google Login
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            handleGoogleCallback(code);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.email) newErrors.email = 'Email là bắt buộc';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
        if (!formData.password) newErrors.password = 'Mật khẩu là bắt buộc';
        else if (formData.password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:8081/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                // Phản hồi từ Cognito có dạng { AuthenticationResult: { IdToken, AccessToken, RefreshToken, ... } }
                const authResult = data.AuthenticationResult || {};
                const token = authResult.IdToken || authResult.AccessToken;

                if (!token) {
                    throw new Error('Không tìm thấy token trong phản hồi');
                }

                localStorage.setItem('cognito_token', token);
                onLogin({
                    email: formData.email,
                    name: formData.email.split('@')[0], // Có thể thay bằng tên thực từ Cognito nếu cần
                    loginTime: new Date().toISOString(),
                    token,
                });
            } else {
                // Backend trả về JSON với trường "error"
                setErrors({
                    general: data.error || 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.',
                });
            }
        } catch (err) {
            console.error('Login error:', err);
            setErrors({
                general: err.message || 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const url = `https://ap-southeast-2t30owwizg.auth.ap-southeast-2.amazoncognito.com/oauth2/authorize?response_type=code&client_id=${cognitoConfig.ClientId}&redirect_uri=${encodeURIComponent(cognitoConfig.RedirectUri)}&scope=${encodeURIComponent(cognitoConfig.Scope || 'openid+email+profile')}&identity_provider=Google`;
        window.location.href = url;
    };

    const handleGoogleCallback = async (code) => {
        setIsLoading(true);
        try {
            const response = await fetch('https://ap-southeast-2t30owwizg.auth.ap-southeast-2.amazoncognito.com/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: cognitoConfig.ClientId,
                    client_secret: cognitoConfig.ClientSecret || '',
                    code,
                    redirect_uri: cognitoConfig.RedirectUri,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                if (data.id_token) {
                    localStorage.setItem('cognito_token', data.id_token);
                    const userData = {
                        email: data.email || 'User',
                        name: (data.email || '').split('@')[0],
                        loginTime: new Date().toISOString(),
                        token: data.id_token,
                    };
                    onLogin(userData);
                    window.history.replaceState({}, document.title, '/');
                } else {
                    setErrors({ general: 'Không tìm thấy id_token trong phản hồi' });
                }
            } else {
                setErrors({ general: `Lỗi từ server: ${data.error || 'Không xác định'} - ${data.error_description || 'Không có mô tả'}` });
            }
        } catch (err) {
            setErrors({ general: 'Lỗi khi xử lý đăng nhập Google: ' + err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
            <div className="max-w-lg w-full">
                {/* Logo và Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">Mindmap App</h1>
                    <p className="text-gray-300">Tạo và quản lý mindmap của bạn</p>
                </div>

                {/* Form Container */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-10 border border-white/20">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                </svg>
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`w-full px-5 py-4 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg ${
                                    errors.email ? 'border-red-400' : ''
                                }`}
                                placeholder="Nhập email của bạn"
                            />
                            {errors.email && (
                                <p className="text-red-400 text-sm mt-1 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                    />
                                </svg>
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`w-full px-5 py-4 pr-12 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg ${
                                        errors.password ? 'border-red-400' : ''
                                    }`}
                                    placeholder="Nhập mật khẩu"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {showPassword ? (
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                                            />
                                        ) : (
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                        )}
                                    </svg>
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-red-400 text-sm mt-1 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {errors.password}
                                </p>
                            )}
                            {errors.general && (
                                <p className="text-red-400 text-sm mt-1 flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {errors.general}
                                </p>
                            )}
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center text-sm text-gray-300">
                                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="ml-2">Ghi nhớ đăng nhập</span>
                            </label>
                            <a href="#" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                                Quên mật khẩu?
                            </a>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center text-lg"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                    </svg>
                                    Đang đăng nhập...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                        />
                                    </svg>
                                    Đăng nhập
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 flex items-center">
                        <div className="flex-1 border-t border-gray-400"></div>
                        <span className="px-4 text-gray-400 text-sm">hoặc</span>
                        <div className="flex-1 border-t border-gray-400"></div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-3 text-lg"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Đăng nhập bằng Google
                    </button>

                    {/* Sign Up Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-300">
                            Chưa có tài khoản?
                            <a href="#" className="text-blue-400 hover:text-blue-300 font-medium ml-1 transition-colors">
                                Đăng ký ngay
                            </a>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-gray-400 text-sm">© 2025 Mindmap App. Tất cả quyền được bảo lưu.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;