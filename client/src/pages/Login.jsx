import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    if (success) {
      navigate('/');
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A] p-margin">
      <div className="glass-panel w-full max-w-[400px] p-xl rounded-xl flex flex-col gap-lg">
        <div className="text-center">
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">Welcome Back</h1>
          <p className="font-body text-body text-on-surface-variant">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label text-label text-on-surface uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body disabled:opacity-50"
              placeholder="Enter your email"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <div className="flex justify-between items-center">
              <label className="font-label text-label text-on-surface uppercase tracking-widest">Password</label>
              <Link to="/forgot-password" className="font-label text-label text-primary hover:text-primary-fixed transition-colors">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body disabled:opacity-50"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-label text-label uppercase tracking-widest py-md rounded-lg mt-sm hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:text-primary-fixed transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
