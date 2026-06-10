import React, { useState } from "react";
import { User, Lock, LogOut } from "lucide-react";
import ChangePasswordModal from "../Auth/ChangePasswordModal";

export default function Settings({
    currentUser,
    setShowAuthModal,
    settingsNickname,
    setSettingsNickname,
    settingsTitleLang,
    setSettingsTitleLang,
    handleSaveSettings,
    isLoadingSongs,
    fetchSongsFromServer,
    settingsMessage,
    setSettingsMessage,
    handleLogout,
}) {
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    return (
        <section className="glass-panel" style={{ padding: "2.5rem", maxWidth: "600px", margin: "0 auto" }}>
            <h2 className="section-title" style={{ marginBottom: "2rem" }}>
                <User size={22} style={{ color: "var(--color-cyan)", marginRight: "0.5rem" }} /> 환경 설정
            </h2>

            {!currentUser ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                    <p style={{ marginBottom: "1.5rem" }}>
                        로그인 시 프로필 설정 및 곡명 다국어 변경 옵션을 이용할 수 있습니다.
                    </p>
                    <button className="btn btn-primary animate-glow" onClick={() => setShowAuthModal(true)}>
                        로그인 / 회원가입
                    </button>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {/* Nickname modification */}
                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label" style={{ fontWeight: 700 }}>
                            대시보드 닉네임 변경
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            value={settingsNickname}
                            onChange={(e) => setSettingsNickname(e.target.value)}
                            onBlur={() => handleSaveSettings(settingsNickname, settingsTitleLang)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.target.blur();
                                }
                            }}
                            placeholder="변경할 닉네임을 입력하세요..."
                        />
                    </div>

                    {/* Language option for song titles */}
                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label" style={{ fontWeight: 700 }}>
                            곡 명 표시 설정
                        </label>
                        <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                            <label
                                className={`checkbox-label ${settingsTitleLang === "jp" ? "active-played" : ""}`}
                                style={{
                                    flex: 1,
                                    justifyContent: "center",
                                    padding: "0.75rem",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="songTitleLang"
                                    value="jp"
                                    checked={settingsTitleLang === "jp"}
                                    onChange={() => {
                                        setSettingsTitleLang("jp");
                                        handleSaveSettings(settingsNickname, "jp");
                                    }}
                                    style={{ marginRight: "0.5rem" }}
                                />
                                일본어 원제목 우선
                            </label>
                            <label
                                className={`checkbox-label ${settingsTitleLang === "ko" ? "active-ap" : ""}`}
                                style={{
                                    flex: 1,
                                    justifyContent: "center",
                                    padding: "0.75rem",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="songTitleLang"
                                    value="ko"
                                    checked={settingsTitleLang === "ko"}
                                    onChange={() => {
                                        setSettingsTitleLang("ko");
                                        handleSaveSettings(settingsNickname, "ko");
                                    }}
                                    style={{ marginRight: "0.5rem" }}
                                />
                                한국어 번역제목 우선
                            </label>
                        </div>
                    </div>

                    {/* Song sync section */}
                    <div
                        className="filter-group"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            marginTop: "0.5rem",
                        }}
                    >
                        <label className="filter-label" style={{ fontWeight: 700 }}>
                            곡 데이터 동기화
                        </label>
                        <button
                            className="btn btn-secondary animate-glow"
                            disabled={isLoadingSongs}
                            onClick={async () => {
                                setSettingsMessage("곡 정보 동기화 진행 중...");
                                try {
                                    const res = await fetch("/api/songs/sync");
                                    const data = await res.json();
                                    if (data.success) {
                                        setSettingsMessage(data.message || "곡 정보 동기화 성공!");
                                        // Refresh songs list
                                        fetchSongsFromServer();
                                    } else {
                                        setSettingsMessage(`⚠ ${data.message || "동기화 실패"}`);
                                    }
                                } catch (err) {
                                    setSettingsMessage("⚠ 서버 동기화 실패");
                                }
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.5rem",
                                padding: "0.75rem",
                            }}
                        >
                            곡 정보 동기화
                        </button>
                    </div>

                    {/* Status message feedback */}
                    {settingsMessage && (
                        <div
                            className="glass-panel"
                            style={{
                                padding: "0.75rem 1rem",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                color: settingsMessage.startsWith("⚠")
                                    ? "var(--color-danger)"
                                    : "var(--color-success)",
                                borderLeft: `4px solid ${settingsMessage.startsWith("⚠") ? "var(--color-danger)" : "var(--color-success)"}`,
                            }}
                        >
                            {settingsMessage}
                        </div>
                    )}

                    {/* Password change section */}
                    <div
                        style={{
                            marginTop: "1.25rem",
                            borderTop: "1px solid var(--border-color)",
                            paddingTop: "1.25rem",
                        }}
                    >
                        <button
                            type="button"
                            className="btn btn-outline"
                            style={{
                                width: "100%",
                                padding: "0.75rem",
                                borderColor: "var(--color-cyan)",
                                color: "var(--color-cyan)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.5rem",
                            }}
                            onClick={() => setShowChangePasswordModal(true)}
                        >
                            <Lock size={16} /> 비밀번호 변경
                        </button>
                    </div>

                    {/* Logout Area */}
                    <div
                        style={{
                            display: "flex",
                            gap: "1rem",
                            marginTop: "0.75rem",
                            paddingTop: "0",
                        }}
                    >
                        <button
                            type="button"
                            className="btn btn-outline"
                            style={{
                                flex: 1,
                                borderColor: "var(--color-danger)",
                                color: "var(--color-danger)",
                            }}
                            onClick={handleLogout}
                        >
                            <LogOut size={16} /> 로그아웃
                        </button>
                    </div>
                </div>
            )}

            <ChangePasswordModal
                isOpen={showChangePasswordModal}
                onClose={() => setShowChangePasswordModal(false)}
                token={currentUser?.token}
            />
        </section>
    );
}
