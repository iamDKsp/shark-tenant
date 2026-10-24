"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  CheckCircle2,
  HelpCircle,
  X,
  ShieldCheck,
  LogOut,
  RotateCcw,
  Fingerprint,
  Sun,
  Moon,
} from "lucide-react";
import { useSystemUiVersion } from "@/lib/theme";

type FlowPhase =
  | "splash"
  | "splash-fade"
  | "welcome"
  | "scanning-biometrics"
  | "exiting-scan"
  | "exiting-check"
  | "exiting-sheet"
  | "exiting-final";

type SheetView = "cards" | "credentials" | "settings";

// Helpers for WebAuthn ArrayBuffer <-> Base64URL conversion
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function LoginPage() {
  const router = useRouter();

  // Real Authentication & Biometric State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [enrollBiometrics, setEnrollBiometrics] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [infoBanner, setInfoBanner] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Saved user & device biometric state
  const [displayName, setDisplayName] = useState("Gestor");
  const [hasBiometricToken, setHasBiometricToken] = useState(false);
  const [hasWebAuthnHardware, setHasWebAuthnHardware] = useState(false);

  // Choreography & UI State
  const [phase, setPhase] = useState<FlowPhase>("splash");
  const [sheetView, setSheetView] = useState<SheetView>("cards");
  const [authMethod, setAuthMethod] = useState<"faceid" | "passcode">("faceid");
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [themeToast, setThemeToast] = useState<string | null>(null);
  const { isClassic, toggleVersion } = useSystemUiVersion();

  const handleToggleUiVersion = () => {
    const next = toggleVersion();
    if (next === "classic") {
      setThemeToast("Modo claro ativado");
    } else {
      setThemeToast("Modo escuro Shark ativado");
    }
  };

  useEffect(() => {
    if (!themeToast) return;
    const t = setTimeout(() => setThemeToast(null), 2800);
    return () => clearTimeout(t);
  }, [themeToast]);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const deriveFirstName = useCallback((savedName: string | null, savedEmail: string | null) => {
    if (savedName && savedName.trim().length > 0) {
      return savedName.trim().split(" ")[0];
    }
    if (savedEmail && savedEmail.includes("@")) {
      const prefix = savedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
      const firstWord = prefix.split(" ")[0];
      if (firstWord && firstWord.length > 1) {
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
      }
    }
    return "Gestor";
  }, []);

  // Load saved profile & check WebAuthn hardware support
  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    const savedName = localStorage.getItem("remembered_name");
    const savedBioToken = localStorage.getItem("shark_biometric_token");

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    setHasBiometricToken(Boolean(savedBioToken));
    setDisplayName(deriveFirstName(savedName, savedEmail));

    if (
      typeof window !== "undefined" &&
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setHasWebAuthnHardware(available))
        .catch(() => setHasWebAuthnHardware(false));
    }
  }, [deriveFirstName]);

  useEffect(() => {
    const savedName = localStorage.getItem("remembered_name");
    if (!savedName && email.includes("@")) {
      setDisplayName(deriveFirstName(null, email));
    }
  }, [email, deriveFirstName]);

  // Phase 1 -> Phase 2 Intro Sequence
  const startIntroSequence = useCallback(() => {
    clearAllTimers();
    setSheetView("cards");
    setError("");
    setInfoBanner("");
    setHelpModalOpen(false);
    setPhase("splash");

    scheduleTimer(() => {
      setPhase("splash-fade");
    }, 1850);

    scheduleTimer(() => {
      setPhase("welcome");
    }, 2300);
  }, [clearAllTimers, scheduleTimer]);

  useEffect(() => {
    startIntroSequence();
    return () => clearAllTimers();
  }, [startIntroSequence, clearAllTimers]);

  // Register real WebAuthn Platform Authenticator (Face ID / Touch ID / Windows Hello)
  const registerDeviceWebAuthn = async (userId: string, userEmail: string, userName: string) => {
    if (!hasWebAuthnHardware || typeof window === "undefined" || !navigator.credentials) {
      return false;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(userId);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "Shark Soluções Financeiras",
            id: window.location.hostname,
          },
          user: {
            id: userIdBytes,
            name: userEmail,
            displayName: userName || userEmail,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 45000,
        },
      })) as PublicKeyCredential | null;

      if (credential && credential.rawId) {
        const credId = bufferToBase64Url(credential.rawId);
        localStorage.setItem("shark_webauthn_cred_id", credId);
        return true;
      }
    } catch {
      // Fallback to signed biometricToken if user skips OS prompt
    }
    return false;
  };

  // Verify real WebAuthn Platform Authenticator
  const verifyDeviceWebAuthn = async (): Promise<boolean> => {
    const savedCredId = localStorage.getItem("shark_webauthn_cred_id");
    if (!hasWebAuthnHardware || !savedCredId || typeof window === "undefined" || !navigator.credentials) {
      return true;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const rawIdBytes = base64UrlToUint8Array(savedCredId);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: rawIdBytes.buffer as ArrayBuffer,
              type: "public-key",
              transports: ["internal"],
            },
          ],
          userVerification: "required",
          timeout: 45000,
        },
      });

      return Boolean(assertion);
    } catch {
      return false;
    }
  };

  // Video Exit Choreography followed by real navigation
  const playExitChoreographyAndRedirect = useCallback(
    (alreadyScanning = false) => {
      clearAllTimers();
      setSheetView("cards");
      setHelpModalOpen(false);

      setPhase("exiting-scan");

      const scanDuration = alreadyScanning ? 380 : 680;

      scheduleTimer(() => {
        setPhase("exiting-check");
      }, scanDuration);

      scheduleTimer(() => {
        setPhase("exiting-sheet");
      }, scanDuration + 540);

      scheduleTimer(() => {
        setPhase("exiting-final");
      }, scanDuration + 1040);

      scheduleTimer(() => {
        router.push("/");
        router.refresh();
      }, scanDuration + 1420);
    },
    [clearAllTimers, router, scheduleTimer]
  );

  // 1. REAL BIOMETRIC / FACE ID LOGIN FLOW
  const handleFaceIdCardClick = async () => {
    if (phase !== "welcome" || isLoading) return;
    setError("");
    setInfoBanner("");

    const savedBioToken = localStorage.getItem("shark_biometric_token");

    if (savedBioToken) {
      setIsLoading(true);
      setPhase("scanning-biometrics");

      const bioVerified = await verifyDeviceWebAuthn();
      if (!bioVerified) {
        setIsLoading(false);
        setPhase("welcome");
        setAuthMethod("faceid");
        setSheetView("credentials");
        setError("Leitura biométrica cancelada. Confirme sua senha ou tente novamente.");
        return;
      }

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ biometricToken: savedBioToken, rememberMe: true }),
        });

        const data = await res.json();

        if (res.ok) {
          if (data?.biometricToken) {
            localStorage.setItem("shark_biometric_token", data.biometricToken);
          }
          if (data?.user?.name) {
            localStorage.setItem("remembered_name", data.user.name);
            setDisplayName(deriveFirstName(data.user.name, data.user.email));
          }
          setIsLoading(false);
          playExitChoreographyAndRedirect(true);
          return;
        } else {
          localStorage.removeItem("shark_biometric_token");
          setHasBiometricToken(false);
          setIsLoading(false);
          setPhase("welcome");
          setAuthMethod("faceid");
          setSheetView("credentials");
          setError(data.error || "Sua sessão Face ID expirou. Confirme sua senha para reativar.");
          return;
        }
      } catch {
        setIsLoading(false);
        setPhase("welcome");
        setAuthMethod("faceid");
        setSheetView("credentials");
        setError("Erro de conexão ao validar Face ID. Tente novamente.");
        return;
      }
    }

    if (email.trim() && password.trim()) {
      setAuthMethod("faceid");
      setEnrollBiometrics(true);
      await executePasswordLogin();
      return;
    }

    setAuthMethod("faceid");
    setEnrollBiometrics(true);
    setInfoBanner(
      "Faça login uma vez com seu e-mail e senha para ativar o acesso instantâneo via Face ID neste aparelho."
    );
    setSheetView("credentials");
    setTimeout(() => {
      if (!email.trim()) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
    }, 180);
  };

  // 2. REAL EMAIL + PASSWORD LOGIN FLOW
  const executePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Preencha seu e-mail e senha para entrar.");
      return;
    }

    setIsLoading(true);
    setError("");
    setInfoBanner("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem("remembered_email", email.trim());
          if (data?.user?.name) {
            localStorage.setItem("remembered_name", data.user.name);
            setDisplayName(deriveFirstName(data.user.name, email));
          }
        } else {
          localStorage.removeItem("remembered_email");
        }

        if (enrollBiometrics && data?.biometricToken) {
          localStorage.setItem("shark_biometric_token", data.biometricToken);
          setHasBiometricToken(true);
          if (authMethod === "faceid" && hasWebAuthnHardware && data?.user?.id) {
            await registerDeviceWebAuthn(
              String(data.user.id),
              String(data.user.email || email),
              String(data.user.name || displayName)
            );
          }
        }

        setIsLoading(false);
        playExitChoreographyAndRedirect(false);
      } else {
        setIsLoading(false);
        setError(data.error || "E-mail ou senha incorretos.");
      }
    } catch {
      setIsLoading(false);
      setError("Erro ao conectar ao servidor. Verifique sua conexão.");
    }
  };

  const handlePasscodeCardClick = () => {
    if (phase !== "welcome" || isLoading) return;
    setAuthMethod("passcode");
    setError("");
    setInfoBanner("");
    setSheetView("credentials");
    setTimeout(() => {
      if (!email.trim()) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
    }, 180);
  };

  const handleUnlinkDevice = () => {
    localStorage.removeItem("shark_biometric_token");
    localStorage.removeItem("shark_webauthn_cred_id");
    localStorage.removeItem("remembered_email");
    localStorage.removeItem("remembered_name");
    setHasBiometricToken(false);
    setEmail("");
    setPassword("");
    setDisplayName("Gestor");
    setSheetView("cards");
  };

  const isSplash = phase === "splash" || phase === "splash-fade";
  const isScanningBio = phase === "scanning-biometrics";
  const isExitingScan = phase === "exiting-scan";
  const isExitingCheck = phase === "exiting-check";
  const isExitingSheet = phase === "exiting-sheet";
  const isExitingFinal = phase === "exiting-final";
  const isAnyExit = isExitingScan || isExitingCheck || isExitingSheet || isExitingFinal;

  // Biometric HUD only appears during active Face ID scan or authentication exit
  const showBiometricHud = isScanningBio || isExitingScan || isExitingCheck || isExitingSheet;

  return (
    <div
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden overscroll-none touch-manipulation flex items-center justify-center select-none font-sans transition-colors duration-300 ${
        isClassic ? "bg-[#059669] sm:bg-[#f0fdf4]" : "bg-[#059669] sm:bg-[#022c22]"
      }`}
    >
      {/* ── Outer 3D Topographic Wavy Background (Tablet/Desktop Only) ── */}
      <div className="pointer-events-none fixed inset-0 hidden sm:block overflow-hidden">
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: isClassic
              ? "radial-gradient(circle at 65% 25%, #d1fae5 0%, #ecfdf5 38%, #f8fafc 74%, #e2e8f0 100%)"
              : "radial-gradient(circle at 65% 25%, #059669 0%, #065f46 32%, #064e3b 62%, #022c22 100%)",
          }}
        />
        <svg
          viewBox="0 0 1440 1024"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isClassic ? "#ecfdf5" : "#065f46"} />
              <stop offset="50%" stopColor={isClassic ? "#d1fae5" : "#047857"} />
              <stop offset="100%" stopColor={isClassic ? "#f8fafc" : "#022c22"} />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isClassic ? "#f0fdf4" : "#047857"} />
              <stop offset="50%" stopColor={isClassic ? "#e2e8f0" : "#064e3b"} />
              <stop offset="100%" stopColor={isClassic ? "#ffffff" : "#011e17"} />
            </linearGradient>
            <filter id="waveShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow
                dx="10"
                dy="6"
                stdDeviation="8"
                floodColor={isClassic ? "#0f172a" : "#011510"}
                floodOpacity={isClassic ? "0.06" : "0.65"}
              />
            </filter>
          </defs>
          {Array.from({ length: 18 }).map((_, idx) => {
            const offset = idx * 48 - 180;
            return (
              <path
                key={idx}
                d={`M ${-220 + offset} -80 C ${140 + offset} 180, ${40 + offset} 490, ${280 + offset} 740 C ${480 + offset} 950, ${760 + offset} 1020, ${980 + offset} 1120 L -300 1120 Z`}
                fill={idx % 2 === 0 ? "url(#waveGrad1)" : "url(#waveGrad2)"}
                stroke={
                  isClassic ? "rgba(16, 185, 129, 0.18)" : "rgba(52, 211, 153, 0.14)"
                }
                strokeWidth="1.2"
                filter="url(#waveShadow)"
              />
            );
          })}
        </svg>
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[860px] rounded-full blur-[90px] ${
            isClassic ? "bg-emerald-400/25" : "bg-emerald-400/15"
          }`}
        />
      </div>

      {/* ── App Screen Container (100% Full Native Viewport on Mobile, Sleek Card on Desktop) ── */}
      <div
        className={`relative z-10 w-full h-full sm:w-[400px] sm:h-[820px] sm:max-h-[92vh] sm:rounded-[44px] ${
          isClassic
            ? "sm:shadow-[0_28px_80px_rgba(15,23,42,0.18),0_0_0_1px_rgba(5,150,105,0.2)]"
            : "sm:shadow-[0_30px_90px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.12)]"
        } overflow-hidden flex flex-col justify-between transition-colors duration-500 ${
          isExitingSheet
            ? "bg-[#064e3b]"
            : "bg-gradient-to-b from-[#059669] via-[#05875f] to-[#047857]"
        }`}
      >
        {/* Ambient Radial Highlight */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(circle at 50% 22%, rgba(52, 211, 153, 0.28) 0%, transparent 62%)",
            opacity: isExitingSheet ? 0.3 : 1,
          }}
        />

        {/* ── Floating Biometric Face ID Scanner HUD (Only visible during active scan/auth) ── */}
        <div className="pointer-events-none absolute inset-x-0 top-5 z-50 flex justify-center">
          <div
            className={`bg-black/95 text-white shadow-[0_14px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/15 flex items-center justify-center overflow-hidden transition-all duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showBiometricHud
                ? "w-[120px] h-[120px] rounded-[32px] scale-100 opacity-100 translate-y-0"
                : "w-[80px] h-[28px] rounded-full scale-75 opacity-0 -translate-y-6"
            }`}
          >
            {/* 3D Glowing Green Face ID Wireframe Scan */}
            {(isScanningBio || isExitingScan) && (
              <div className="relative w-16 h-16 flex items-center justify-center animate-fade-in">
                <div className="absolute inset-0 rounded-full bg-emerald-400/15 blur-md animate-pulse" />
                <svg
                  viewBox="0 0 64 64"
                  className="w-14 h-14 text-[#4ade80] animate-face-scan-3d"
                  fill="none"
                >
                  <ellipse
                    cx="32"
                    cy="32"
                    rx="26"
                    ry="26"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    className="opacity-60"
                  />
                  <ellipse
                    cx="32"
                    cy="32"
                    rx="24"
                    ry="12"
                    transform="rotate(-28 32 32)"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="opacity-85"
                  />
                  <ellipse
                    cx="32"
                    cy="32"
                    rx="12"
                    ry="24"
                    transform="rotate(24 32 32)"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="opacity-85"
                  />
                  <path
                    d="M24 26V29M40 26V29M32 28V35H29M25 40C27.5 43 36.5 43 39 40"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}

            {/* Glowing Green Circle with Checkmark */}
            {(isExitingCheck || isExitingSheet) && (
              <div className="relative w-14 h-14 flex items-center justify-center animate-login-check-circle">
                <div className="absolute inset-0 rounded-full bg-[#4ade80]/20 blur-md" />
                <svg viewBox="0 0 56 56" className="w-13 h-13" fill="none">
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#4ade80"
                    strokeWidth="3"
                    className="opacity-95"
                  />
                  <path
                    d="M19.5 28.5L25.5 34.5L37.5 22.5"
                    stroke="#4ade80"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-login-check-path"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            PHASE 1: SPLASH SCREEN (Frames 05 -> 11)
           ===================================================================== */}
        {isSplash && (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-full w-[112px] flex items-center justify-center">
                <div
                  className="h-[75%] w-[16px] bg-[#022c22] animate-splash-ribbon-up"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="h-[85%] w-[16px] bg-[#f59e0b] animate-splash-ribbon-up"
                  style={{ animationDelay: "65ms" }}
                />
                <div
                  className="h-[92%] w-[20px] bg-white animate-splash-ribbon-up"
                  style={{ animationDelay: "120ms" }}
                />
                <div
                  className="h-[82%] w-[18px] bg-[#6ee7b7] animate-splash-ribbon-up"
                  style={{ animationDelay: "175ms" }}
                />
                <div
                  className="h-[78%] w-[16px] bg-[#10b981] animate-splash-ribbon-up"
                  style={{ animationDelay: "225ms" }}
                />
                <div
                  className="h-[70%] w-[14px] bg-[#064e3b] animate-splash-ribbon-up"
                  style={{ animationDelay: "270ms" }}
                />
              </div>
            </div>

            <div
              className={`relative z-10 flex flex-col items-center gap-3 px-6 text-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                phase === "splash-fade"
                  ? "opacity-0 scale-95 -translate-y-2"
                  : "opacity-100 scale-100 translate-y-0 animate-fade-in"
              }`}
              style={{ animationDelay: "360ms" }}
            >
              <div className="w-24 h-24 rounded-3xl bg-[#022c22]/90 border border-emerald-300/40 shadow-2xl shadow-black/35 p-3 flex items-center justify-center">
                <img
                  src="/shark-symbol-v3.png"
                  alt="Shark Soluções Financeiras"
                  className="w-full h-full object-contain scale-110 drop-shadow-md"
                />
              </div>
              <div className="flex flex-col text-white">
                <span className="text-[28px] font-black tracking-tight leading-none">
                  SHARK
                </span>
                <span className="text-[13px] font-semibold text-emerald-100/90 tracking-widest uppercase mt-1.5">
                  Soluções Financeiras
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            PHASE 2 & 3: WELCOME / LOGIN SCREEN & EXIT CHOREOGRAPHY
           ===================================================================== */}
        {!isSplash && (
          <>
            {/* ── Continuous Curved Multi-Colored Ribbons in Background ── */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-[380px] z-10 overflow-hidden transition-opacity duration-300 ${
                isAnyExit ? "opacity-0" : "opacity-100"
              }`}
            >
              <svg
                viewBox="0 0 392 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                <path
                  d="M 22 -20 L 22 142 A 96 96 0 0 0 118 238 L 420 238"
                  stroke="#022c22"
                  strokeWidth="13"
                  strokeLinecap="butt"
                  className="animate-curved-ribbon"
                  style={{ animationDelay: "0ms" }}
                />
                <path
                  d="M 35 -20 L 35 142 A 83 83 0 0 0 118 225 L 420 225"
                  stroke="#f59e0b"
                  strokeWidth="13"
                  strokeLinecap="butt"
                  className="animate-curved-ribbon"
                  style={{ animationDelay: "60ms" }}
                />
                <path
                  d="M 48 -20 L 48 142 A 70 70 0 0 0 118 212 L 420 212"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="butt"
                  className="animate-curved-ribbon"
                  style={{ animationDelay: "120ms" }}
                />
                <path
                  d="M 61 -20 L 61 142 A 57 57 0 0 0 118 199 L 420 199"
                  stroke="#6ee7b7"
                  strokeWidth="13"
                  strokeLinecap="butt"
                  className="animate-curved-ribbon"
                  style={{ animationDelay: "180ms" }}
                />
                <path
                  d="M 74 -20 L 74 142 A 44 44 0 0 0 118 186 L 420 186"
                  stroke="#064e3b"
                  strokeWidth="13"
                  strokeLinecap="butt"
                  className="animate-curved-ribbon"
                  style={{ animationDelay: "240ms" }}
                />
              </svg>
            </div>

            {/* ── Subtle "J" Curved Watermark Line on Final Exit ── */}
            {isExitingFinal && (
              <div className="pointer-events-none absolute inset-0 z-10 animate-fade-in">
                <svg viewBox="0 0 392 824" fill="none" className="w-full h-full">
                  <path
                    d="M 206 445 L 206 675 A 78 78 0 0 1 128 753 L 0 753"
                    stroke="rgba(167, 243, 208, 0.16)"
                    strokeWidth="16"
                  />
                </svg>
              </div>
            )}

            {/* ── Upper Hero Area: Settings Button + Centered Large Logo + Greeting ── */}
            <div
              className="relative z-20 flex-1 flex flex-col justify-between px-6 pb-5"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            >
              {/* Top-Right Action Buttons: Discreet Classic Restore Icon + Settings Gear Button */}
              <div
                className={`relative flex items-center justify-end gap-2 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isAnyExit
                    ? "opacity-0 -translate-y-3 pointer-events-none"
                    : "opacity-100 translate-y-0"
                }`}
              >
                {themeToast && (
                  <div
                    className={`mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-bold shadow-lg animate-fade-in ${
                      isClassic
                        ? "bg-white/95 border-emerald-200 text-slate-800"
                        : "bg-[#12171d]/90 border-emerald-300/30 text-emerald-100"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isClassic ? "bg-amber-500" : "bg-emerald-400"
                      }`}
                    />
                    <span>{themeToast}</span>
                  </div>
                )}

                {/* Button to Toggle Light (Classic) / Dark Mode */}
                <button
                  type="button"
                  onClick={handleToggleUiVersion}
                  title={
                    isClassic
                      ? "Alternar para modo escuro Shark"
                      : "Alternar para modo claro"
                  }
                  aria-label={
                    isClassic
                      ? "Ativar modo escuro do sistema"
                      : "Ativar modo claro do sistema"
                  }
                  className={`relative w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-90 transition-all cursor-pointer animate-fade-in ${
                    isClassic
                      ? "bg-white/95 border-white text-amber-500 shadow-md hover:bg-white"
                      : "bg-[#022c22]/25 border-white/15 text-white/85 hover:text-white hover:bg-[#022c22]/40"
                  }`}
                  style={{ animationDelay: "180ms" }}
                >
                  {isClassic ? (
                    <Sun className="w-4.5 h-4.5" />
                  ) : (
                    <Moon className="w-4.5 h-4.5" />
                  )}
                  {isClassic && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#059669]"
                      title="Modo claro ativo"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSheetView((prev) => (prev === "settings" ? "cards" : "settings"))
                  }
                  title="Configurações de acesso e Face ID"
                  className="w-10 h-10 rounded-full bg-[#022c22]/25 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-[#022c22]/40 active:scale-90 transition-all cursor-pointer animate-fade-in"
                  style={{ animationDelay: "220ms" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-5 h-5"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="3.2" />
                    <circle cx="12" cy="12" r="7.5" strokeOpacity="0.85" />
                    <path d="M12 2.2V4.5M12 19.5V21.8M2.2 12H4.5M19.5 12H21.8M5.07 5.07L6.7 6.7M17.3 17.3L18.93 18.93M18.93 5.07L17.3 6.7M6.7 17.3L5.07 18.93" />
                  </svg>
                </button>
              </div>

              {/* Centered Prominent Brand Logo occupying the central hero space */}
              <div
                className={`my-auto flex flex-col items-center justify-center text-center transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isAnyExit
                    ? "opacity-0 scale-90 pointer-events-none"
                    : "opacity-100 scale-100 animate-fade-in"
                }`}
                style={{ animationDelay: "120ms" }}
              >
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-emerald-300/20 blur-xl" />
                  <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] bg-[#022c22]/85 backdrop-blur-md border border-emerald-300/35 shadow-[0_14px_34px_rgba(0,0,0,0.35)] p-2.5 flex items-center justify-center">
                    <img
                      src="/shark-symbol-v3.png"
                      alt="Shark Soluções Financeiras"
                      className="w-full h-full object-contain scale-110 drop-shadow"
                    />
                  </div>
                </div>
                <span className="mt-2.5 text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs leading-none">
                  SHARK
                </span>
                <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/90 drop-shadow-xs">
                  Soluções Financeiras
                </span>
              </div>

              {/* Staggered Two-Line Greeting */}
              <div
                className={`transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isAnyExit
                    ? "opacity-0 -translate-y-4 pointer-events-none"
                    : "opacity-100 translate-y-0"
                }`}
              >
                <p
                  className="text-[26px] sm:text-[28px] font-bold text-white/95 leading-[1.15] tracking-tight drop-shadow-xs animate-fade-in-up"
                  style={{ animationDelay: "80ms" }}
                >
                  Bem-vindo de volta,
                </p>
                <h1
                  className="text-[30px] sm:text-[32px] font-black text-white leading-[1.12] tracking-tight mt-0.5 drop-shadow-xs animate-fade-in-up"
                  style={{ animationDelay: "200ms" }}
                >
                  {displayName}
                </h1>
              </div>
            </div>

            {/* ── Asymmetric Bottom Sheet (Light / Dark Mode Adaptive) ── */}
            <div
              style={{
                paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
              }}
              className={`relative z-20 rounded-tr-[42px] rounded-tl-none px-6 pt-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isClassic
                  ? "bg-white text-slate-900 shadow-[0_-16px_50px_rgba(15,23,42,0.18)] border-t border-emerald-100"
                  : "bg-[#12171d] text-white shadow-[0_-16px_50px_rgba(0,0,0,0.45)] border-t border-white/[0.06]"
              } ${
                isExitingSheet || isExitingFinal
                  ? "translate-y-[105%]"
                  : "translate-y-0 animate-slide-up"
              }`}
            >
              {sheetView === "cards" && (
                /* =========================================================
                   VIEW A: THE SIGNATURE CARDS
                   ========================================================= */
                <div>
                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Left Card: REAL Face ID / Biometric Login */}
                    <button
                      type="button"
                      onClick={handleFaceIdCardClick}
                      disabled={isLoading}
                      style={{
                        transitionDelay: isExitingCheck ? "0ms" : "0ms",
                        animationDelay: "140ms",
                      }}
                      className={`group relative h-[136px] sm:h-[142px] rounded-[22px] p-4 flex flex-col justify-between text-left bg-gradient-to-br from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#059669] cursor-pointer active:scale-[0.97] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isClassic
                          ? "shadow-lg shadow-emerald-600/25 border border-emerald-400/35"
                          : "shadow-lg shadow-emerald-950/50 border border-emerald-300/25"
                      } ${
                        isExitingCheck || isExitingSheet || isExitingFinal
                          ? "translate-y-36 opacity-0 pointer-events-none"
                          : "translate-y-0 opacity-100 animate-fade-in-up"
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-white">
                        <svg
                          viewBox="0 0 28 28"
                          fill="none"
                          className="w-7 h-7 transition-transform duration-300 group-hover:scale-105"
                          stroke="currentColor"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8.5 3.5H6C4.61929 3.5 3.5 4.61929 3.5 6V8.5" />
                          <path d="M19.5 3.5H22C23.3807 3.5 24.5 4.61929 24.5 6V8.5" />
                          <path d="M8.5 24.5H6C4.61929 24.5 3.5 23.3807 3.5 22V19.5" />
                          <path d="M19.5 24.5H22C23.3807 24.5 24.5 23.3807 24.5 22V19.5" />
                          <path d="M10 10.5V12.5" />
                          <path d="M18 10.5V12.5" />
                          <path d="M14 11V15.2H12.6" />
                          <path d="M10.5 18.5C11.8 20.1 16.2 20.1 17.5 18.5" />
                        </svg>

                        {hasBiometricToken && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/25 text-[10px] font-bold text-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            Ativo
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="block text-[15px] font-bold text-white tracking-tight">
                          Face ID
                        </span>
                        <span className="block text-[11px] font-medium text-emerald-100/85 mt-0.5">
                          {hasBiometricToken
                            ? "Toque para entrar"
                            : "Ativar biometria"}
                        </span>
                      </div>
                    </button>

                    {/* Right Card: Passcode / E-mail & Senha */}
                    <button
                      type="button"
                      onClick={handlePasscodeCardClick}
                      disabled={isLoading}
                      style={{
                        transitionDelay: isExitingCheck ? "150ms" : "0ms",
                        animationDelay: "220ms",
                      }}
                      className={`group relative h-[136px] sm:h-[142px] rounded-[22px] p-4 flex flex-col justify-between text-left bg-gradient-to-br from-[#065f46] to-[#064e3b] hover:from-[#047857] hover:to-[#065f46] cursor-pointer active:scale-[0.97] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isClassic
                          ? "shadow-lg shadow-emerald-950/20 border border-emerald-700/25"
                          : "shadow-lg shadow-black/40 border border-emerald-400/15"
                      } ${
                        isExitingCheck || isExitingSheet || isExitingFinal
                          ? "translate-y-36 opacity-0 pointer-events-none"
                          : "translate-y-0 opacity-100 animate-fade-in-up"
                      }`}
                    >
                      <div className="w-9 h-9 flex items-center justify-start text-white">
                        <svg
                          viewBox="0 0 28 28"
                          fill="currentColor"
                          className="w-7 h-7 transition-transform duration-300 group-hover:scale-105"
                        >
                          <circle cx="7" cy="5.5" r="1.9" />
                          <circle cx="14" cy="5.5" r="1.9" />
                          <circle cx="21" cy="5.5" r="1.9" />
                          <circle cx="7" cy="11.5" r="1.9" />
                          <circle cx="14" cy="11.5" r="1.9" />
                          <circle cx="21" cy="11.5" r="1.9" />
                          <circle cx="7" cy="17.5" r="1.9" />
                          <circle cx="14" cy="17.5" r="1.9" />
                          <circle cx="21" cy="17.5" r="1.9" />
                          <circle cx="14" cy="23.5" r="1.9" />
                        </svg>
                      </div>

                      <div>
                        <span className="block text-[15px] font-bold text-white tracking-tight">
                          Com Senha
                        </span>
                        <span className="block text-[11px] font-medium text-emerald-200/75 mt-0.5">
                          E-mail e senha
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* "Fale conosco" Section + 3 Staggered Cards */}
                  <div className="mt-5">
                    <div
                      className={`flex items-center justify-between mb-3 transition-all duration-300 ${
                        isAnyExit
                          ? "opacity-0 translate-y-2"
                          : "opacity-100 translate-y-0 animate-fade-in"
                      }`}
                      style={{ animationDelay: "300ms" }}
                    >
                      <h2
                        className={`text-[15px] font-bold tracking-tight ${
                          isClassic ? "text-slate-900" : "text-white/95"
                        }`}
                      >
                        Fale conosco
                      </h2>
                      {email && (
                        <span
                          className={`text-[11px] font-medium truncate max-w-[180px] ${
                            isClassic ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {email}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Card 1: Ligar -> Direct WhatsApp 14998364338 */}
                      <a
                        href="https://wa.me/5514998364338"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          transitionDelay: isAnyExit ? "0ms" : "0ms",
                          animationDelay: "360ms",
                        }}
                        className={`group h-[98px] rounded-[20px] p-3.5 flex flex-col justify-between text-left cursor-pointer active:scale-95 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isClassic
                            ? "bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-200 shadow-xs"
                            : "bg-[#1c222b] hover:bg-[#232b36] border border-white/[0.05]"
                        } ${
                          isAnyExit
                            ? "translate-y-28 opacity-0 pointer-events-none"
                            : "translate-y-0 opacity-100 animate-fade-in-up"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className={`w-5 h-5 transition-colors ${
                            isClassic
                              ? "text-emerald-700 group-hover:text-emerald-600"
                              : "text-white/90 group-hover:text-emerald-400"
                          }`}
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span
                          className={`text-[13px] font-semibold tracking-tight ${
                            isClassic
                              ? "text-slate-800 group-hover:text-emerald-950"
                              : "text-white/90"
                          }`}
                        >
                          Ligar
                        </span>
                      </a>

                      {/* Card 2: Local -> Direct Google Maps Link */}
                      <a
                        href="https://share.google/PpOHdrAPqK2W523Z1"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          transitionDelay: isAnyExit ? "90ms" : "0ms",
                          animationDelay: "440ms",
                        }}
                        className={`group h-[98px] rounded-[20px] p-3.5 flex flex-col justify-between text-left cursor-pointer active:scale-95 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isClassic
                            ? "bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-200 shadow-xs"
                            : "bg-[#1c222b] hover:bg-[#232b36] border border-white/[0.05]"
                        } ${
                          isAnyExit
                            ? "translate-y-28 opacity-0 pointer-events-none"
                            : "translate-y-0 opacity-100 animate-fade-in-up"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className={`w-5 h-5 transition-colors ${
                            isClassic
                              ? "text-emerald-700 group-hover:text-emerald-600"
                              : "text-white/90 group-hover:text-emerald-400"
                          }`}
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                          <line x1="9" y1="3" x2="9" y2="18" />
                          <line x1="15" y1="6" x2="15" y2="21" />
                        </svg>
                        <span
                          className={`text-[13px] font-semibold tracking-tight ${
                            isClassic
                              ? "text-slate-800 group-hover:text-emerald-950"
                              : "text-white/90"
                          }`}
                        >
                          Local
                        </span>
                      </a>

                      {/* Card 3: Ajuda */}
                      <button
                        type="button"
                        onClick={() => setHelpModalOpen(true)}
                        style={{
                          transitionDelay: isAnyExit ? "180ms" : "0ms",
                          animationDelay: "520ms",
                        }}
                        className={`group h-[98px] rounded-[20px] p-3.5 flex flex-col justify-between text-left cursor-pointer active:scale-95 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isClassic
                            ? "bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-200 shadow-xs"
                            : "bg-[#1c222b] hover:bg-[#232b36] border border-white/[0.05]"
                        } ${
                          isAnyExit
                            ? "translate-y-28 opacity-0 pointer-events-none"
                            : "translate-y-0 opacity-100 animate-fade-in-up"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className={`w-5 h-5 transition-colors ${
                            isClassic
                              ? "text-emerald-700 group-hover:text-emerald-600"
                              : "text-white/90 group-hover:text-emerald-400"
                          }`}
                          stroke="currentColor"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span
                          className={`text-[13px] font-semibold tracking-tight ${
                            isClassic
                              ? "text-slate-800 group-hover:text-emerald-950"
                              : "text-white/90"
                          }`}
                        >
                          Ajuda
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {sheetView === "credentials" && (
                /* =========================================================
                   VIEW B: REAL CREDENTIALS FORM (16px font to prevent iOS zoom)
                   ========================================================= */
                <form onSubmit={executePasswordLogin} className="space-y-3 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSheetView("cards");
                        setError("");
                        setInfoBanner("");
                      }}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold py-1 pr-2 cursor-pointer transition-colors ${
                        isClassic
                          ? "text-emerald-700 hover:text-emerald-600"
                          : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isClassic
                          ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                          : "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/25"
                      }`}
                    >
                      {authMethod === "faceid" ? "Vincular Face ID" : "Acesso com Senha"}
                    </span>
                  </div>

                  {infoBanner && !error && (
                    <div
                      className={`p-2.5 rounded-2xl border text-xs font-medium leading-relaxed ${
                        isClassic
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                      }`}
                    >
                      {infoBanner}
                    </div>
                  )}

                  {error && (
                    <div
                      className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
                        isClassic
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-red-500/15 border-red-500/30 text-red-300"
                      }`}
                    >
                      <span>{error}</span>
                      <button
                        type="button"
                        onClick={() => setError("")}
                        className={`ml-2 ${
                          isClassic
                            ? "text-red-500 hover:text-red-700"
                            : "text-red-300/70 hover:text-red-200"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label
                      className={`text-xs font-bold ml-1 block ${
                        isClassic ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail
                        className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                          isClassic ? "text-emerald-600" : "text-emerald-400/80"
                        }`}
                      />
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Seu e-mail de acesso"
                        required
                        className={`w-full pl-10 pr-4 py-2.5 border focus:border-emerald-500 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium select-text ${
                          isClassic
                            ? "bg-slate-50 border-slate-200 focus:bg-white text-slate-900 placeholder:text-slate-400"
                            : "bg-[#1c222b] border-white/10 text-white placeholder:text-slate-500"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      className={`text-xs font-bold ml-1 block ${
                        isClassic ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <Lock
                        className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                          isClassic ? "text-emerald-600" : "text-emerald-400/80"
                        }`}
                      />
                      <input
                        ref={passwordInputRef}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className={`w-full pl-10 pr-11 py-2.5 border focus:border-emerald-500 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium select-text ${
                          isClassic
                            ? "bg-slate-50 border-slate-200 focus:bg-white text-slate-900 placeholder:text-slate-400"
                            : "bg-[#1c222b] border-white/10 text-white placeholder:text-slate-500"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer ${
                          isClassic
                            ? "text-slate-400 hover:text-slate-700"
                            : "text-slate-400 hover:text-white"
                        }`}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-0.5 px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-xs font-semibold ${
                          isClassic ? "text-slate-600" : "text-slate-300"
                        }`}
                      >
                        Lembrar-me (manter conectado por 30 dias)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enrollBiometrics}
                        onChange={(e) => setEnrollBiometrics(e.target.checked)}
                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                      />
                      <span
                        className={`text-xs font-semibold ${
                          isClassic ? "text-emerald-700" : "text-emerald-300/90"
                        }`}
                      >
                        Habilitar login rápido no cartão Face ID
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#10b981] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60 ${
                      isClassic
                        ? "shadow-lg shadow-emerald-600/25"
                        : "shadow-lg shadow-emerald-950/60"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {authMethod === "faceid"
                            ? "Ativar Face ID e Entrar"
                            : "Acessar Painel"}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {sheetView === "settings" && (
                /* =========================================================
                   VIEW C: DEVICE & BIOMETRIC ACCESS SETTINGS
                   ========================================================= */
                <div className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSheetView("cards")}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold py-1 pr-2 cursor-pointer ${
                        isClassic
                          ? "text-emerald-700 hover:text-emerald-600"
                          : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <span
                      className={`text-xs font-bold ${
                        isClassic ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      Configurações de Acesso
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl border space-y-2 ${
                      isClassic
                        ? "bg-slate-50 border-slate-200"
                        : "bg-[#1c222b] border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                            isClassic
                              ? "bg-emerald-100/80 border-emerald-200 text-emerald-700"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p
                            className={`text-xs font-bold ${
                              isClassic ? "text-slate-900" : "text-white"
                            }`}
                          >
                            Status do Face ID / Biometria
                          </p>
                          <p
                            className={`text-[11px] ${
                              isClassic ? "text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {hasBiometricToken
                              ? `Vinculado a ${email || displayName}`
                              : "Ainda não vinculado neste dispositivo"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          hasBiometricToken
                            ? isClassic
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-emerald-500/20 text-emerald-300"
                            : isClassic
                              ? "bg-slate-200 text-slate-600"
                              : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {hasBiometricToken ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {hasWebAuthnHardware && (
                      <p
                        className={`text-[11px] flex items-center gap-1.5 pt-1 ${
                          isClassic ? "text-emerald-700" : "text-emerald-300/80"
                        }`}
                      >
                        <Fingerprint className="w-3.5 h-3.5 shrink-0" />
                        <span>Sensor biométrico do dispositivo detectado (WebAuthn).</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleToggleUiVersion}
                      className={`w-full py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        isClassic
                          ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                          : "bg-[#1c222b] hover:bg-[#242c37] border-white/10 text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isClassic ? (
                          <Moon className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Sun className="w-4 h-4 text-amber-400" />
                        )}
                        <span>
                          {isClassic
                            ? "Mudar para modo escuro Shark"
                            : "Mudar para modo claro"}
                        </span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isClassic
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {isClassic ? "Modo Claro" : "Modo Escuro"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={startIntroSequence}
                      className={`w-full py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        isClassic
                          ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                          : "bg-[#1c222b] hover:bg-[#242c37] border-white/10 text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <RotateCcw
                          className={`w-4 h-4 ${
                            isClassic ? "text-emerald-600" : "text-emerald-400"
                          }`}
                        />
                        <span>Repetir animação de abertura</span>
                      </span>
                    </button>

                    {(hasBiometricToken || email) && (
                      <button
                        type="button"
                        onClick={handleUnlinkDevice}
                        className={`w-full py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                          isClassic
                            ? "bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                            : "bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-300"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" />
                          <span>Trocar de conta / Desvincular Face ID</span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Help Mini-Sheet Overlay when clicking Ajuda */}
              {helpModalOpen && (
                <div
                  className={`absolute inset-0 z-30 backdrop-blur-md rounded-tr-[42px] p-6 flex flex-col justify-between animate-fade-in ${
                    isClassic
                      ? "bg-white/95 text-slate-900"
                      : "bg-[#12171d]/95 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                          isClassic
                            ? "bg-emerald-100/80 border-emerald-200 text-emerald-700"
                            : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3
                          className={`text-sm font-bold ${
                            isClassic ? "text-slate-900" : "text-white"
                          }`}
                        >
                          Como funciona o Acesso
                        </h3>
                        <p
                          className={`text-[11px] ${
                            isClassic ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          Shark Soluções Financeiras
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHelpModalOpen(false)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                        isClassic
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          : "bg-white/5 hover:bg-white/10 text-slate-300"
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div
                    className={`my-auto py-3 space-y-2 text-xs leading-relaxed ${
                      isClassic ? "text-slate-600" : "text-slate-300"
                    }`}
                  >
                    <p
                      className={`font-semibold ${
                        isClassic ? "text-slate-900" : "text-white"
                      }`}
                    >
                      Usando o Face ID ou Senha:
                    </p>
                    <p>
                      No primeiro acesso, entre com seu e-mail e senha para vincular seu
                      aparelho. Nos próximos acessos, basta tocar no cartão{" "}
                      <strong
                        className={
                          isClassic ? "text-emerald-700" : "text-emerald-400"
                        }
                      >
                        Face ID
                      </strong>{" "}
                      para entrar instantaneamente, ou falar conosco pelo botão{" "}
                      <strong
                        className={
                          isClassic ? "text-emerald-700" : "text-emerald-400"
                        }
                      >
                        Ligar
                      </strong>
                      .
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setHelpModalOpen(false);
                      setSheetView("credentials");
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Preencher Credenciais
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
