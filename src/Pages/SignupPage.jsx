import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { registerUser } from '../utils/authSlice';
import axiosClient from '../utils/axiosClient';
import { useEffect, useRef, useState } from 'react';
import VartalaMark from '../components/VartalaMark';
import BackgroundArt from '../components/BackgroundArt';
import CardFoliage from '../components/CardFoliage';

// wordmark font — falls back to system fonts if the Google font hasn't loaded
const BRAND_FONT = "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";

const detailsSchema = z.object({
  firstname: z.string().trim().min(2, 'First name must be at least 2 characters').max(20, 'First name is too long'),
  username: z.string().trim().min(3, 'Username must be 3 to 20 characters').max(20, 'Username must be 3 to 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscore allowed'),
  emailId: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(64, 'Password is too long'),
});

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

const DEBOUNCE_MS = 1000;

// common providers we can confidently suggest a correction against —
// intentionally NOT exhaustive; the goal is catching obvious typos like
// "gmai.cop", not guessing at someone's genuine custom/work domain
const COMMON_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'live.com', 'aol.com', 'protonmail.com', 'rediffmail.com', 'yandex.com',
];

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// returns a suggested domain (e.g. "gmail.com") if the typed domain looks
// like a near-miss typo of a common provider, otherwise null
function suggestEmailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let best = null;
  let bestDist = Infinity;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const dist = levenshtein(domain, candidate);
    if (dist < bestDist) { bestDist = dist; best = candidate; }
  }
  // only flag close typos (1-2 char difference) — anything further apart
  // is more likely a real, different domain than a mistyped common one
  return best && bestDist > 0 && bestDist <= 2 ? best : null;
}

function getAuthErrorMessage(err) {
  if (!err) return '';
  const message = typeof err === 'string' ? err : err.message || err.error || '';

  if (/already taken|already exists|duplicate/i.test(message)) {
    return 'That email or username is already taken.';
  }
  if (/invalid otp|otp expired|not found/i.test(message)) {
    return 'That code is incorrect or has expired. Please request a new one.';
  }
  if (/429|too many|wait/i.test(message)) {
    return message.match(/wait \d+ seconds/i)?.[0]
      ? `Please ${message.match(/wait \d+ seconds/i)[0]} before trying again.`
      : 'Too many attempts. Please wait a moment and try again.';
  }
  if (/network|failed to fetch|timeout|ECONNREFUSED|ENETUNREACH|ENOTFOUND|EAI_AGAIN|ECONNRESET|500|502|503/i.test(message)) {
    return 'Unable to reach the server right now. Please try again in a moment.';
  }
  return message || 'Something went wrong. Please try again.';
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

// small status pill shown under a field: 'idle' | 'checking' | 'available' | 'taken'
function AvailabilityHint({ status }) {
  if (status === 'checking') return <p className="text-[12px] sm:text-[12.5px] text-[#6b6257] mt-1 ml-4 sm:ml-5">Checking...</p>;
  if (status === 'available') return <p className="text-[12px] sm:text-[12.5px] text-[#2f6b45] mt-1 ml-4 sm:ml-5">Available</p>;
  if (status === 'taken') return <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">Already taken</p>;
  return null;
}

export default function SignupPage() {
  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [pendingData, setPendingData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [eyePressed, setEyePressed] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  // 'idle' | 'checking' | 'available' | 'taken'
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [emailStatus, setEmailStatus] = useState('idle');
  const [emailSuggestion, setEmailSuggestion] = useState(null); // e.g. "gmail.com" when a typo looks likely

  const usernameTimer = useRef(null);
  const emailTimer = useRef(null);
  // guards against a slow older request overwriting a newer result
  const usernameRequestId = useRef(0);
  const emailRequestId = useRef(0);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const detailsForm = useForm({ resolver: zodResolver(detailsSchema), mode: 'onChange' });
  const otpForm = useForm({ resolver: zodResolver(otpSchema) });

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  // clean up pending timers if the component unmounts mid-type
  useEffect(() => {
    return () => {
      clearTimeout(usernameTimer.current);
      clearTimeout(emailTimer.current);
    };
  }, []);

  const checkUsername = (value) => {
    clearTimeout(usernameTimer.current);

    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(value);
    if (!valid) {
      setUsernameStatus('idle'); // let the zod message handle the format error instead
      return;
    }

    setUsernameStatus('checking');
    const thisRequest = ++usernameRequestId.current;

    usernameTimer.current = setTimeout(async () => {
      try {
        const { data } = await axiosClient.get('/user/available', { params: { username: value } });
        if (thisRequest !== usernameRequestId.current) return; // a newer keystroke already superseded this
        setUsernameStatus(data.username?.available ? 'available' : 'taken');
      } catch {
        if (thisRequest !== usernameRequestId.current) return;
        setUsernameStatus('idle'); // fail silently, server-side check on submit still protects us
      }
    }, DEBOUNCE_MS);
  };

  const checkEmail = (value) => {
    clearTimeout(emailTimer.current);

    const valid = z.string().email().safeParse(value).success;
    if (!valid) {
      setEmailStatus('idle');
      setEmailSuggestion(null);
      return;
    }

    setEmailSuggestion(suggestEmailDomain(value));
    setEmailStatus('checking');
    const thisRequest = ++emailRequestId.current;

    emailTimer.current = setTimeout(async () => {
      try {
        const { data } = await axiosClient.get('/user/available', { params: { emailId: value } });
        if (thisRequest !== emailRequestId.current) return;
        setEmailStatus(data.emailId?.available ? 'available' : 'taken');
      } catch {
        if (thisRequest !== emailRequestId.current) return;
        setEmailStatus('idle');
      }
    }, DEBOUNCE_MS);
  };

  const onSubmitDetails = async (data) => {
    setFormTouched(false);

    // guard: don't let them submit if we already know it's taken
    if (usernameStatus === 'taken' || emailStatus === 'taken') return;

    const result = await dispatch(registerUser(data));
    if (registerUser.fulfilled.match(result) && !result.payload?.user) {
      setPendingData(data);
      setStep('otp');
    }
  };

  const onSubmitOtp = (data) => {
    setFormTouched(false);
    dispatch(registerUser({ ...pendingData, otp: data.otp }));
  };

  const resendOtp = async () => {
    setFormTouched(false);
    await dispatch(registerUser(pendingData));
  };

  const handleEyeClick = () => {
    setShowPassword((s) => !s);
    // trigger a quick normal -> small -> normal press animation on click
    setEyePressed(true);
    window.setTimeout(() => setEyePressed(false), 150);
  };

  const serverErrorMessage = formTouched ? '' : getAuthErrorMessage(error);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#f3ead8] flex items-center justify-center font-body px-4 py-8 sm:px-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap');
      `}</style>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 15% 5%, #fbf6e9 0%, #f3ead8 45%, #ecdfc2 100%)' }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-40 sm:opacity-100">
        <BackgroundArt />
      </div>

      <div
        className="pointer-events-none absolute -left-24 -top-32 h-225 w-120 rotate-18 z-20 opacity-60 mix-blend-soft-light hidden sm:block"
        style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%)' }}
      />

      <div className="relative z-10 w-full max-w-100 max-h-full overflow-y-auto rounded-[28px] sm:rounded-[34px] border border-[#e9ddc4] bg-[#faf5e9] px-6 py-8 sm:px-9 sm:pt-10 sm:pb-8 shadow-[0_30px_50px_-18px_rgba(120,85,35,0.4)]">
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
          <h1 className="font-display text-[24px] sm:text-[30px] leading-tight text-[#2e2a22]">
            {step === 'details' ? 'Create an account' : 'Verify your email'}
          </h1>
          <p className="text-[13px] sm:text-[14px] text-[#6b6257] mt-1">
            {step === 'details'
              ? 'Join GUPSHUP and start chatting'
              : `We sent a 6-digit code to ${pendingData?.emailId}`}
          </p>
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

        {step === 'details' && (
          <form className="relative space-y-3 sm:space-y-3.5" onSubmit={detailsForm.handleSubmit(onSubmitDetails)} noValidate>
            <div>
              <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                  <circle cx="12" cy="8" r="3.3" />
                  <path d="M5 20c1-4 4-6 7-6s6 2 7 6" strokeLinecap="round" />
                </svg>
                <input
                  {...detailsForm.register('firstname', { onChange: () => setFormTouched(true) })}
                  type="text"
                  placeholder="First name"
                  autoComplete="given-name"
                  className="grow min-w-0 bg-transparent outline-none text-[15px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70"
                />
              </label>
              {detailsForm.formState.errors.firstname && (
                <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">
                  {detailsForm.formState.errors.firstname.message}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="3.4" />
                  <path d="M15.4 12v1.4a2.6 2.6 0 0 0 5.1.7 9 9 0 1 0-3.4 6.1" strokeLinecap="round" />
                </svg>
                <input
                  {...detailsForm.register('username', {
                    onChange: (e) => { setFormTouched(true); checkUsername(e.target.value.trim()); },
                  })}
                  type="text"
                  placeholder="Username"
                  autoComplete="username"
                  className="grow min-w-0 bg-transparent outline-none text-[15px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70"
                />
              </label>
              {detailsForm.formState.errors.username ? (
                <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">
                  {detailsForm.formState.errors.username.message}
                </p>
              ) : (
                <AvailabilityHint status={usernameStatus} />
              )}
            </div>

            <div>
              <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <input
                  {...detailsForm.register('emailId', {
                    onChange: (e) => { setFormTouched(true); checkEmail(e.target.value.trim()); },
                  })}
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  className="grow min-w-0 bg-transparent outline-none text-[15px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70"
                />
              </label>
              {detailsForm.formState.errors.emailId ? (
                <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">
                  {detailsForm.formState.errors.emailId.message}
                </p>
              ) : emailSuggestion ? (
                <button
                  type="button"
                  onClick={() => {
                    const current = detailsForm.getValues('emailId');
                    const at = current.lastIndexOf('@');
                    const fixed = `${current.slice(0, at)}@${emailSuggestion}`;
                    detailsForm.setValue('emailId', fixed, { shouldValidate: true });
                    checkEmail(fixed);
                  }}
                  className="text-[12px] sm:text-[12.5px] text-[#8a5527] mt-1 ml-4 sm:ml-5 underline decoration-dotted cursor-pointer hover:text-[#6b4018]"
                >
                  Did you mean {emailSuggestion}?
                </button>
              ) : (
                <AvailabilityHint status={emailStatus} />
              )}
            </div>

            <div>
              <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  {...detailsForm.register('password', { onChange: () => setFormTouched(true) })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="new-password"
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
              {detailsForm.formState.errors.password && (
                <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">
                  {detailsForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                usernameStatus === 'checking' || emailStatus === 'checking' ||
                usernameStatus === 'taken' || emailStatus === 'taken' ||
                Object.keys(detailsForm.formState.errors).length > 0
              }
              className="w-full h-12 sm:h-13 rounded-full text-[15px] sm:text-[16px] font-medium text-[#f3e8d6] mt-1 cursor-pointer transition-all duration-150 ease-out hover:scale-105 hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100"
              style={{
                background: 'linear-gradient(180deg, #b97a45 0%, #8a5527 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), 0 6px 14px -6px rgba(120,70,30,0.55)',
              }}
            >
              {loading ? 'Sending code...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form className="relative space-y-3 sm:space-y-3.5" onSubmit={otpForm.handleSubmit(onSubmitOtp)} noValidate>
            <div>
              <label className="flex items-center gap-3 h-12 sm:h-13 px-4 sm:px-5 rounded-full border-[1.5px] border-[#3b2e22] bg-[#faf5e9]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b2e22" strokeWidth="1.8" className="shrink-0">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M12 15v3" />
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                </svg>
                <input
                  {...otpForm.register('otp', { onChange: () => setFormTouched(true) })}
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  maxLength={6}
                  className="grow min-w-0 bg-transparent outline-none text-[15px] tracking-[4px] text-[#3b2e22] placeholder:text-[#4a3d2e]/70 placeholder:tracking-normal"
                />
              </label>
              {otpForm.formState.errors.otp && (
                <p className="text-[12px] sm:text-[12.5px] text-[#8a2f2f] mt-1 ml-4 sm:ml-5">
                  {otpForm.formState.errors.otp.message}
                </p>
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
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="flex items-center justify-between text-[13px] sm:text-[13.5px] pt-1">
              <button
                type="button"
                onClick={() => { setStep('details'); setFormTouched(true); }}
                className="text-[#6b6257] cursor-pointer transition-all duration-150 ease-out hover:scale-105 hover:brightness-125 hover:underline active:scale-95"
              >
                &larr; Edit details
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading}
                className="text-[#2f4d55] cursor-pointer transition-all duration-150 ease-out hover:scale-105 hover:brightness-125 hover:underline active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className="relative text-center text-[13.5px] sm:text-[14.5px] mt-5 sm:mt-6">
          <p className="text-[#2e2a22]">
            Already have an account?{' '}
            <NavLink
              to="/login"
              className="inline-block text-[#4e21bf] cursor-pointer transition-all duration-150 ease-out hover:scale-110 hover:brightness-125 hover:underline active:scale-95"
            >
              Log In
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}