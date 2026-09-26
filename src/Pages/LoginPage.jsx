import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { loginUser } from '../utils/authSlice';
import { useEffect, useState } from 'react';
import VartalaMark from '../components/VartalaMark';
import BackgroundArt from '../components/BackgroundArt';
import CardFoliage from '../components/CardFoliage';

// wordmark font — falls back to system fonts if the Google font hasn't loaded
const BRAND_FONT = "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";

const loginSchema = z.object({
  identifier: z.string().min(3, 'Enter your username or email'),
  password: z.string().min(1, 'Password is required'),
});

function getAuthErrorMessage(err) {
  if (!err) return '';
  const message = typeof err === 'string' ? err : err.message || err.error || '';

  if (/401|unauthori[sz]ed|invalid credentials/i.test(message)) {
    return 'Invalid username/email or password. Please try again.';
  }
  if (/429|too many/i.test(message)) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (/403|forbidden|blocked|disabled/i.test(message)) {
    return 'Your account is not authorized to log in. Please contact support.';
  }
  if (/network|failed to fetch|timeout|ECONNREFUSED|500|502|503/i.test(message)) {
    return 'Unable to reach the server right now. Please try again in a moment.';
  }
  return message || 'Something went wrong while logging in. Please try again.';
}

// closed/crossed-out eye — shown when the password is hidden (click to reveal)
function EyeOffIcon({ size = 18, color = '#3B1D0B' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 12c2.4-4 6-6.5 9-6.5 1.2 0 2.4.3 3.6.9M21 12c-1 1.7-2.3 3.2-3.9 4.3M9.9 8.3A3 3 0 0 0 12 15a3 3 0 0 0 2-.8" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

// open eye — shown when the password is visible (click to hide)
function EyeOnIcon({ size = 18, color = '#3B1D0B' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c2.4-4.2 6-6.5 9-6.5s6.6 2.3 9 6.5c-2.4 4.2-6 6.5-9 6.5s-6.6-2.3-9-6.5Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [eyePressed, setEyePressed] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const onSubmit = (data) => {
    setFormTouched(false);
    dispatch(loginUser(data));
  };

  const handleEyeClick = () => {
    setShowPassword((s) => !s);
    // trigger a quick normal -> small -> normal press animation on click
    setEyePressed(true);
    window.setTimeout(() => setEyePressed(false), 150);
  };

  const serverErrorMessage = formTouched ? '' : getAuthErrorMessage(error);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f3ead8] flex items-center justify-center font-body px-4 py-8 sm:px-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap');
      `}</style>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 15% 5%, #fbf6e9 0%, #f3ead8 45%, #ecdfc2 100%)' }}
      />

      {/* background fern art: dimmer on mobile so it reads as texture, not clutter */}
      <div className="pointer-events-none absolute inset-0 opacity-40 sm:opacity-100">
        <BackgroundArt />
      </div>

      <div
        className="pointer-events-none absolute -left-24 -top-32 h-225 w-120 rotate-18 z-20 opacity-60 mix-blend-soft-light hidden sm:block"
        style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%)' }}
      />

      <div className="relative z-10 w-full max-w-100 rounded-[28px] sm:rounded-[34px] border border-[#e9ddc4] bg-[#faf5e9] px-6 py-8 sm:px-9 sm:pt-10 sm:pb-8 shadow-[0_30px_50px_-18px_rgba(120,85,35,0.4)] overflow-hidden">
        <CardFoliage />

        <div className="relative flex items-center justify-center gap-3 sm:gap-4 mb-5 sm:mb-6">
          <VartalaMark size={64} className="sm:hidden" />
          <VartalaMark size={80} className="hidden sm:block" />
          <span
            className="font-display font-extrabold tracking-[0.06em] text-[32px] sm:text-[40px] leading-none text-[#4a463e]"
            style={{ fontFamily: BRAND_FONT }}
          >
            GUPSHUP
          </span>
        </div>

        <div className="relative text-center mb-5 sm:mb-6">
          <h1 className="font-display text-[24px] sm:text-[30px] leading-tight text-[#2e2a22]">Welcome back!</h1>
          <p className="text-[13px] sm:text-[14px] text-[#6b6257] mt-1">Log in to connect with friends</p>
        </div>

        {serverErrorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="relative mb-3 rounded-2xl border border-[#c94f4f]/30 bg-[#f8e4e4] px-4 py-2.5 text-[13px] sm:text-[13.5px] text-[#8a2f2f]"
          >
            {serverErrorMessage}
          </div>
        )}

        <form className="relative space-y-3 sm:space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                <circle cx="12" cy="8" r="3.3" />
                <path d="M5 20c1-4 4-6 7-6s6 2 7 6" strokeLinecap="round" />
              </svg>
              <input
                {...register('identifier', { onChange: () => setFormTouched(true) })}
                type="text"
                placeholder="Username or Email"
                autoComplete="username"
                className="grow min-w-0 bg-transparent outline-none text-[15px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70"
              />
            </label>
            {errors.identifier && (
              <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                {...register('password', { onChange: () => setFormTouched(true) })}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                autoComplete="current-password"
                className="grow min-w-0 bg-transparent outline-none text-[15px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70"
              />
              <button
                type="button"
                onClick={handleEyeClick}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className={`shrink-0 cursor-pointer rounded-full p-1 transition-transform duration-150 ease-out hover:scale-125 hover:brightness-125 ${
                  eyePressed ? 'scale-75' : 'scale-100'
                }`}
              >
                {showPassword ? <EyeOnIcon /> : <EyeOffIcon />}
              </button>
            </label>
            {errors.password && (
              <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 sm:h-13 rounded-full text-[15px] sm:text-[16px] font-medium text-[#f3e8d6] mt-1 cursor-pointer transition-all duration-150 ease-out hover:scale-105 hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100"
            style={{
              background: 'linear-gradient(180deg, #b97a45 0%, #8a5527 100%)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), 0 6px 14px -6px rgba(120,70,30,0.55)',
            }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="relative text-center text-[13.5px] sm:text-[14.5px] mt-5 sm:mt-6">
          <p className="text-[#2e2a22]">
            Don&apos;t have an account?{' '}
            <NavLink
              to="/signup"
              className="inline-block text-[#4e21bf] cursor-pointer transition-all duration-150 ease-out hover:scale-110 hover:brightness-125 hover:underline active:scale-95"
            >
              Sign Up
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}