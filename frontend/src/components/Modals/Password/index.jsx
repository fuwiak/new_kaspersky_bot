import React, { useState, useEffect } from "react";
import System from "../../../models/system";
import SingleUserAuth from "./SingleUserAuth";
import MultiUserAuth from "./MultiUserAuth";
import {
  AUTH_TOKEN,
  AUTH_USER,
  AUTH_TIMESTAMP,
} from "../../../utils/constants";
import useLogo from "../../../hooks/useLogo";

export default function PasswordModal({ mode = "single" }) {
  const { loginLogo, isCustomLogo } = useLogo();
  return (
    <div className="fixed inset-0 bg-zinc-950 light:bg-slate-50 flex flex-col items-center justify-center overflow-hidden">
      <img
        src={loginLogo}
        alt="Logo"
        className={`max-h-[80px] ${isCustomLogo ? "rounded-lg" : ""}`}
        style={{ objectFit: "contain" }}
      />
      {mode === "single" ? <SingleUserAuth /> : <MultiUserAuth />}
    </div>
  );
}

export function usePasswordModal(notry = false) {
  const [auth, setAuth] = useState({
    loading: true,
    requiresAuth: false,
    mode: "single",
  });

  useEffect(() => {
    async function checkAuthReq() {
      if (!window) return;

      // If the last validity check is still valid
      // we can skip the loading.
      if (!System.needsAuthCheck() && notry === false) {
        setAuth({
          loading: false,
          requiresAuth: false,
          mode: "multi",
        });
        return;
      }

      const settings = await System.keys();
      
      // Если RequiresAuth отключен, автоматически получаем токен
      const requiresAuth = settings?.RequiresAuth || false;
      
      if (settings?.MultiUserMode) {
        const currentToken = window.localStorage.getItem(AUTH_TOKEN);
        if (!!currentToken) {
          const valid = notry ? false : await System.checkAuth(currentToken);
          if (!valid) {
            // Если RequiresAuth отключен, автоматически получаем новый токен
            if (!requiresAuth) {
              try {
                const result = await System.requestToken({ username: "" });
                if (result.valid && result.token) {
                  window.localStorage.setItem(AUTH_TOKEN, result.token);
                  if (result.user) {
                    window.localStorage.setItem(AUTH_USER, JSON.stringify(result.user));
                  }
                  setAuth({
                    loading: false,
                    requiresAuth: false,
                    mode: "multi",
                  });
                  return;
                }
              } catch (e) {
                console.error("Auto-login failed:", e);
              }
            }
            setAuth({
              loading: false,
              requiresAuth: true,
              mode: "multi",
            });
            window.localStorage.removeItem(AUTH_USER);
            window.localStorage.removeItem(AUTH_TOKEN);
            window.localStorage.removeItem(AUTH_TIMESTAMP);
            return;
          } else {
            setAuth({
              loading: false,
              requiresAuth: false,
              mode: "multi",
            });
            return;
          }
        } else {
          // Если RequiresAuth отключен, автоматически получаем токен
          if (!requiresAuth) {
            try {
              const result = await System.requestToken({ username: "" });
              if (result.valid && result.token) {
                window.localStorage.setItem(AUTH_TOKEN, result.token);
                if (result.user) {
                  window.localStorage.setItem(AUTH_USER, JSON.stringify(result.user));
                }
                setAuth({
                  loading: false,
                  requiresAuth: false,
                  mode: "multi",
                });
                return;
              }
            } catch (e) {
              console.error("Auto-login failed:", e);
            }
          }
          setAuth({
            loading: false,
            requiresAuth: true,
            mode: "multi",
          });
          return;
        }
      } else {
        // Running token check in single user Auth mode.
        // If Single user Auth is disabled - skip check
        if (!requiresAuth) {
          setAuth({
            loading: false,
            requiresAuth: false,
            mode: "single",
          });
          return;
        }

        const currentToken = window.localStorage.getItem(AUTH_TOKEN);
        if (!!currentToken) {
          const valid = notry ? false : await System.checkAuth(currentToken);
          if (!valid) {
            // Если RequiresAuth отключен, автоматически получаем новый токен
            if (!requiresAuth) {
              try {
                const result = await System.requestToken({ password: "" });
                if (result.valid && result.token) {
                  window.localStorage.setItem(AUTH_TOKEN, result.token);
                  setAuth({
                    loading: false,
                    requiresAuth: false,
                    mode: "single",
                  });
                  return;
                }
              } catch (e) {
                console.error("Auto-login failed:", e);
              }
            }
            setAuth({
              loading: false,
              requiresAuth: true,
              mode: "single",
            });
            window.localStorage.removeItem(AUTH_TOKEN);
            window.localStorage.removeItem(AUTH_USER);
            window.localStorage.removeItem(AUTH_TIMESTAMP);
            return;
          } else {
            setAuth({
              loading: false,
              requiresAuth: false,
              mode: "single",
            });
            return;
          }
        } else {
          // Если RequiresAuth отключен, автоматически получаем токен
          if (!requiresAuth) {
            try {
              const result = await System.requestToken({ password: "" });
              if (result.valid && result.token) {
                window.localStorage.setItem(AUTH_TOKEN, result.token);
                setAuth({
                  loading: false,
                  requiresAuth: false,
                  mode: "single",
                });
                return;
              }
            } catch (e) {
              console.error("Auto-login failed:", e);
            }
          }
          setAuth({
            loading: false,
            requiresAuth: true,
            mode: "single",
          });
          return;
        }
      }
    }
    checkAuthReq();
  }, []);

  return auth;
}
