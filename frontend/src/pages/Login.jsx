import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, loading } = useAuth();
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const onGoogleAuth = async () => {
    setError('');

    try {
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remember_me');
      }
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="relative flex w-full max-w-md flex-col rounded-xl border border-slate-200/20 bg-white/90 bg-clip-border text-gray-700 shadow-md shadow-black/30 backdrop-blur">
        <div className="relative mx-4 -mt-6 mb-4 grid h-28 place-items-center overflow-hidden rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 bg-clip-border text-white shadow-lg shadow-cyan-500/40">
          <h3 className="block text-3xl font-semibold leading-snug tracking-normal text-white antialiased">Sign In</h3>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="relative h-11 w-full min-w-[200px]">
            <input
              placeholder=" "
              className="peer h-full w-full rounded-md border border-slate-300 border-t-transparent bg-transparent px-3 py-3 text-sm font-normal text-slate-700 outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-slate-300 placeholder-shown:border-t-slate-300 focus:border-2 focus:border-cyan-500 focus:border-t-transparent focus:outline-0"
            />
            <label className="pointer-events-none absolute -top-1.5 left-0 flex h-full w-full select-none text-[11px] font-normal leading-tight text-slate-400 transition-all before:mr-1 before:mt-[6.5px] before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-l before:border-t before:border-slate-300 before:transition-all after:ml-1 after:mt-[6.5px] after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-r after:border-t after:border-slate-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[4.1] peer-placeholder-shown:text-slate-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-cyan-500 peer-focus:before:border-l-2 peer-focus:before:border-t-2 peer-focus:before:!border-cyan-500 peer-focus:after:border-r-2 peer-focus:after:border-t-2 peer-focus:after:!border-cyan-500">
              Email
            </label>
          </div>

          <div className="relative h-11 w-full min-w-[200px]">
            <input
              type="password"
              placeholder=" "
              className="peer h-full w-full rounded-md border border-slate-300 border-t-transparent bg-transparent px-3 py-3 text-sm font-normal text-slate-700 outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-slate-300 placeholder-shown:border-t-slate-300 focus:border-2 focus:border-cyan-500 focus:border-t-transparent focus:outline-0"
            />
            <label className="pointer-events-none absolute -top-1.5 left-0 flex h-full w-full select-none text-[11px] font-normal leading-tight text-slate-400 transition-all before:mr-1 before:mt-[6.5px] before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-l before:border-t before:border-slate-300 before:transition-all after:ml-1 after:mt-[6.5px] after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-r after:border-t after:border-slate-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[4.1] peer-placeholder-shown:text-slate-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-cyan-500 peer-focus:before:border-l-2 peer-focus:before:border-t-2 peer-focus:before:!border-cyan-500 peer-focus:after:border-r-2 peer-focus:after:border-t-2 peer-focus:after:!border-cyan-500">
              Password
            </label>
          </div>

          <div className="-ml-2.5">
            <div className="inline-flex items-center">
              <label htmlFor="remember-checkbox" className="relative flex cursor-pointer items-center rounded-full p-3">
                <input
                  id="remember-checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all before:absolute before:left-2/4 before:top-2/4 before:block before:h-12 before:w-12 before:-translate-x-2/4 before:-translate-y-2/4 before:rounded-full before:bg-slate-500 before:opacity-0 before:content-[''] before:transition-opacity hover:before:opacity-10 checked:border-cyan-500 checked:bg-cyan-500 checked:before:bg-cyan-500"
                  type="checkbox"
                />
                <span className="pointer-events-none absolute left-2/4 top-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                  <svg strokeWidth="1" stroke="currentColor" fill="currentColor" viewBox="0 0 20 20" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
                    <path
                      clipRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      fillRule="evenodd"
                    />
                  </svg>
                </span>
              </label>
              <label htmlFor="remember-checkbox" className="mt-px cursor-pointer select-none text-sm font-light text-slate-700">
                Remember Me
              </label>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="p-6 pt-0">
          <button
            type="button"
            onClick={onGoogleAuth}
            disabled={loading}
            className="block w-full select-none rounded-lg bg-gradient-to-tr from-cyan-600 to-cyan-400 px-6 py-3 text-center text-xs font-bold uppercase text-white shadow-md shadow-cyan-500/20 transition-all hover:shadow-lg hover:shadow-cyan-500/40 active:opacity-[0.85] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">Secure sign in is powered by your Google account.</p>

          <p className="mt-6 flex justify-center text-sm font-light leading-normal text-inherit antialiased">
            Don't have an account?
            <Link className="ml-1 block text-sm font-bold leading-normal text-cyan-500 antialiased" to="/">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
