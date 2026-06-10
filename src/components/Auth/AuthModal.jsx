import React, { useState } from "react";

export default function AuthModal({ isOpen, onClose, setCurrentUser, syncScoresToServer }) {
    const [authUsername, setAuthUsername] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authNickname, setAuthNickname] = useState("");
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [autoLogin, setAutoLogin] = useState(false);
    const [authError, setAuthError] = useState("");

    if (!isOpen) return null;

    const resetAuthForm = () => {
        setAuthUsername("");
        setAuthNickname("");
        setAuthPassword("");
        setAuthError("");
    };

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError("");

        if (!authUsername || !authPassword || (isRegisterMode && !authNickname)) {
            setAuthError("모든 정보를 정확하게 입력해 주세요.");
            return;
        }

        const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
        const payload = isRegisterMode
            ? { username: authUsername, nickname: authNickname, password: authPassword }
            : { username: authUsername, password: authPassword };

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                setAuthError(data.error || "인증 처리에 실패했습니다.");
                return;
            }

            if (isRegisterMode) {
                alert("회원가입이 완료되었습니다! 로그인 창으로 전환합니다.");
                setIsRegisterMode(false);
                setAuthPassword("");
            } else {
                const userObj = {
                    username: data.user.username,
                    nickname: data.user.nickname,
                    token: data.token,
                    friends: data.user.friends || [],
                    settings: data.user.settings || { songTitleLang: "jp" },
                    rating_history: data.user.rating_history || {},
                };
                setCurrentUser(userObj);
                if (autoLogin) {
                    localStorage.setItem("pjsk_auth", JSON.stringify(userObj));
                } else {
                    sessionStorage.setItem("pjsk_auth", JSON.stringify(userObj));
                }

                const localRec = localStorage.getItem("pjsk_user_scores");
                if (localRec) {
                    const parsed = JSON.parse(localRec);
                    if (parsed && parsed.length > 0) {
                        await syncScoresToServer(userObj, parsed);
                    }
                }

                onClose();
                resetAuthForm();
            }
        } catch (err) {
            setAuthError("서버와의 통신에 실패했습니다.");
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "400px", width: "100%", padding: "2rem" }}
            >
                <h3
                    style={{
                        fontSize: "1.5rem",
                        marginBottom: "1rem",
                        background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-pink) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        textAlign: "center",
                    }}
                >
                    {isRegisterMode ? "SEKAI 회원가입" : "SEKAI 로그인"}
                </h3>

                <form
                    onSubmit={handleAuthSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
                >
                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label">유저 ID</label>
                        <input
                            type="text"
                            className="form-control"
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                            placeholder="아이디를 입력하세요 (영어/숫자)"
                        />
                    </div>

                    {isRegisterMode && (
                        <div
                            className="filter-group"
                            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                        >
                            <label className="filter-label">프로필 닉네임</label>
                            <input
                                type="text"
                                className="form-control"
                                value={authNickname}
                                onChange={(e) => setAuthNickname(e.target.value)}
                                placeholder="대시보드에 보일 닉네임"
                            />
                        </div>
                    )}

                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label">비밀번호</label>
                        <input
                            type="password"
                            className="form-control"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="비밀번호를 입력하세요"
                        />
                    </div>

                    {!isRegisterMode && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginTop: "-0.5rem",
                                marginBottom: "0.25rem",
                            }}
                        >
                            <input
                                type="checkbox"
                                id="auto-login"
                                checked={autoLogin}
                                onChange={(e) => setAutoLogin(e.target.checked)}
                                style={{ cursor: "pointer", height: "16px", width: "16px" }}
                            />
                            <label
                                htmlFor="auto-login"
                                style={{
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    color: "var(--text-secondary)",
                                    userSelect: "none",
                                }}
                            >
                                자동 로그인
                            </label>
                        </div>
                    )}

                    {authError && (
                        <div
                            style={{
                                color: "var(--color-danger)",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                textAlign: "center",
                            }}
                        >
                            ⚠ {authError}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                        {isRegisterMode ? "회원가입 완료" : "로그인"}
                    </button>

                    <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        {isRegisterMode ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}
                        <span
                            style={{
                                color: "var(--color-cyan)",
                                cursor: "pointer",
                                marginLeft: "0.5rem",
                                textDecoration: "underline",
                            }}
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setAuthError("");
                            }}
                        >
                            {isRegisterMode ? "로그인하기" : "회원가입하기"}
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
}
