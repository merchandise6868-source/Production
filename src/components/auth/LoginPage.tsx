import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';

interface Props {
  onLoginSuccess: (username: string) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Xử lý đếm ngược khi bị tạm khóa do gõ sai quá 5 lần (Brute-force protection)
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const timer = setTimeout(() => {
        setLockoutRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutRemaining]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutRemaining > 0) {
      setErrorMsg(`Thiết bị đang bị tạm khóa bảo vệ! Vui lòng chờ ${lockoutRemaining} giây nữa.`);
      return;
    }

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!');
      return;
    }

    // Kiểm tra tài khoản quy định
    if (cleanUser === 'tienkyosx' && cleanPass === 'tienkyo@@123') {
      setErrorMsg(null);
      setFailedAttempts(0);

      // Nếu chọn ghi nhớ thiết bị máy
      if (rememberDevice) {
        const sessionPayload = {
          username: cleanUser,
          role: 'Quản Trị Viên',
          rememberDevice: true,
          token: 'DD_SESSION_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
          loginAt: new Date().toISOString(),
        };
        localStorage.setItem('DD_INVENTORY_AUTH_SESSION', JSON.stringify(sessionPayload));
      } else {
        sessionStorage.setItem('DD_INVENTORY_SESSION_USER', cleanUser);
      }

      onLoginSuccess(cleanUser);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        setLockoutRemaining(60);
        setErrorMsg('Bạn đã nhập sai quá 5 lần! Để bảo vệ hệ thống, tài khoản tạm khóa trong 60 giây.');
      } else {
        setErrorMsg(`Tên đăng nhập hoặc mật khẩu không chính xác! (Còn ${5 - newAttempts} lần thử)`);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Brand Banner */}
        <div className="bg-gradient-to-r from-sky-700 via-indigo-700 to-teal-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">D&D LONG AN</h1>
            <p className="text-xs text-sky-100 font-medium">Hệ Thống Quản Lý Kho & Sản Xuất</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <span>ĐĂNG NHẬP HỆ THỐNG</span>
            </h2>
            <p className="text-xs text-slate-500">
              Vui lòng nhập thông tin xác thực để truy cập dữ liệu kho
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Tên đăng nhập</span>
              </label>
              <input
                type="text"
                autoFocus
                disabled={lockoutRemaining > 0}
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mật khẩu</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={lockoutRemaining > 0}
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-3.5 pr-10 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember device checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-600">
                  Ghi nhớ thiết bị này (Tự động vào lần sau)
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={lockoutRemaining > 0}
              className={`w-full h-10 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                lockoutRemaining > 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-600 via-sky-600 to-indigo-700 hover:from-teal-700 hover:to-indigo-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lockoutRemaining > 0
                  ? `Tạm khóa (${lockoutRemaining}s)`
                  : 'ĐĂNG NHẬP VÀO HỆ THỐNG'}
              </span>
            </button>
          </form>

          {/* Device Security Note */}
          <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-400 space-y-1">
            <p>🔒 Kết nối an toàn nội bộ D&D Long An</p>
            <p className="text-[10px]">Phiên bản 2026 • Bảo mật phiên thiết bị tự động</p>
          </div>
        </div>
      </div>
    </div>
  );
};
