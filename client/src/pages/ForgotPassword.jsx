import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const { forgotPassword } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await forgotPassword(email);
    if (success) {
      navigate('/verify-otp', { state: { email } });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A] p-margin">
      <div className="glass-panel w-full max-w-[400px] p-xl rounded-xl flex flex-col gap-lg">
        <div className="text-center">
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">Reset Password</h1>
          <p className="font-body text-body text-on-surface-variant">Enter your email to receive an OTP</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label text-label text-on-surface uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body"
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-on-primary font-label text-label uppercase tracking-widest py-md rounded-lg mt-sm hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)]"
          >
            Send OTP
          </button>
        </form>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          Remember your password?{' '}
          <Link to="/login" className="text-primary hover:text-primary-fixed transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
