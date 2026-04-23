import React, { createContext, useContext, useState, useEffect } from 'react';
import { request } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const payload = await request("/api/auth/me", { method: "GET" });
      setCurrentUser(payload.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const payload = await request("/api/auth/login", {
      body: JSON.stringify({ email, password }),
      method: "POST"
    });
    setCurrentUser(payload.user);
    return payload;
  }

  async function register(userData) {
    const payload = await request("/api/auth/register", {
      body: JSON.stringify(userData),
      method: "POST"
    });
    setCurrentUser(payload.user);
    return payload;
  }

  async function logout() {
    try {
      await request("/api/auth/logout", {
        body: JSON.stringify({}),
        method: "POST"
      });
    } catch {
      // Ignore
    }
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
