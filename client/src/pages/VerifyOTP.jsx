import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const VerifyOTP = () => {
  const [otp, setOtp] = useState('');
  const { verifyOTP } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    const success = await verifyOTP(email, otp);
    if (success) {
      navigate('/reset-password', { state: { email, otp } });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A] p-margin">
      <div className="glass-panel w-full max-w-[400px] p-xl rounded-xl flex flex-col gap-lg">
        <div className="text-center">
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">Verify OTP</h1>
          <p className="font-body text-body text-on-surface-variant">Enter the 6-digit code sent to your email</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label text-label text-on-surface uppercase tracking-widest">OTP Code</label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body text-center tracking-widest text-lg"
              placeholder="123456"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-on-primary font-label text-label uppercase tracking-widest py-md rounded-lg mt-sm hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)]"
          >
            Verify
          </button>
        </form>
        
        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          Back to{' '}
          <Link to="/login" className="text-primary hover:text-primary-fixed transition-colors">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyOTP;
