import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * /login is just a deep-link entry that opens the LoginModal on top of
 * the landing page. The actual UI lives in features/auth/login-modal.tsx.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    if (loading) return;
    if (user && !isDemoMode()) return; // already handled by Navigate below
    openLogin();
    navigate("/", { replace: true });
  }, [loading, user, openLogin, navigate]);

  if (loading) return null;
  if (user && !isDemoMode()) return <Navigate to="/dashboard" replace />;
  return null;
}
