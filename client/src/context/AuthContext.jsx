import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // You can set the base URL based on environment or proxy
  const API_URL = 'http://localhost:5000/api/auth'; 

  useEffect(() => {
    // Check if user is logged in
    if (token) {
      try {
        // Simple mock decode or you could verify with a /me endpoint
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          logout();
        } else {
          setUser({ id: payload.userId }); // Set minimal user state
        }
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      toast.success('Logged in successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      return false;
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/signup`, { name, email, password });
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      toast.success('Account created successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Signup failed');
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    toast.success('Logged out');
  };

  const forgotPassword = async (email) => {
    try {
      await axios.post(`${API_URL}/forgot-password`, { email });
      toast.success('OTP sent to your email');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP');
      return false;
    }
  };

  const verifyOTP = async (email, otp) => {
    try {
      await axios.post(`${API_URL}/verify-otp`, { email, otp });
      toast.success('OTP verified');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP');
      return false;
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      await axios.post(`${API_URL}/reset-password`, { email, otp, newPassword });
      toast.success('Password reset successfully. You can now login.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, forgotPassword, verifyOTP, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
