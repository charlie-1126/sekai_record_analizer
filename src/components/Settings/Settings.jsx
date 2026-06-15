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
    ratingMode,
    toggleRatingMode,
    showUnreleased,
    toggleShowUnreleased,
    trainerSpeed,
    setTrainerSpeed,
}) {
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    return (
        <section className="glass-panel" style={{ padding: "2.5rem", maxWidth: "600px", margin: "0 auto" }}>
            <h2 className="section-title" style={{ marginBottom: "2rem" }}>
                <User size={22} style={{ color: "var(--color-cyan)", marginRight: "0.5rem" }} /> 환경 설정
            </h2>

            {/* Rating Mode selection */}
            <div
                className="filter-group"
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}
            >
                <label className="filter-label" style={{ fontWeight: 700 }}>
                    레이팅 모드
                </label>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                    <label
                        className={`checkbox-label ${ratingMode === "b39" ? "active-played" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="radio"
                            name="ratingMode"
                            value="b39"
                            checked={ratingMode === "b39"}
                            onChange={toggleRatingMode}
                            style={{ marginRight: "0.5rem" }}
                        />
                        B39
                    </label>
                    <label
                        className={`checkbox-label ${ratingMode === "potential" ? "active-ap" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            borderColor: ratingMode === "potential" ? "#c77dff" : "",
                            background: ratingMode === "potential" ? "rgba(199,125,255,0.08)" : "",
                        }}
                    >
                        <input
                            type="radio"
                            name="ratingMode"
                            value="potential"
                            checked={ratingMode === "potential"}
                            onChange={toggleRatingMode}
                            style={{ marginRight: "0.5rem" }}
                        />
                        Potential
                    </label>
                </div>
            </div>

            {/* Unreleased Songs display selection */}
            <div
                className="filter-group"
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}
            >
                <label className="filter-label" style={{ fontWeight: 700 }}>
                    출시 예정곡
                </label>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                    <label
                        className={`checkbox-label ${showUnreleased ? "active-ap" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            borderColor: showUnreleased ? "var(--color-cyan)" : "",
                            background: showUnreleased ? "rgba(56, 189, 248, 0.08)" : "",
                        }}
                    >
                        <input
                            type="radio"
                            name="showUnreleased"
                            value="show"
                            checked={showUnreleased === true}
                            onChange={() => toggleShowUnreleased(true)}
                            style={{ marginRight: "0.5rem" }}
                        />
                        표시
                    </label>
                    <label
                        className={`checkbox-label ${!showUnreleased ? "active-played" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="radio"
                            name="showUnreleased"
                            value="hide"
                            checked={showUnreleased === false}
                            onChange={() => toggleShowUnreleased(false)}
                            style={{ marginRight: "0.5rem" }}
                        />
                        숨김
                    </label>
                </div>
            </div>

            {/* Trainer Speed selection */}
            <div
                className="filter-group"
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}
            >
                <label className="filter-label" style={{ fontWeight: 700 }}>
                    채보 속도
                </label>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                    <label
                        className={`checkbox-label ${trainerSpeed === "10.5" ? "active-played" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="radio"
                            name="trainerSpeed"
                            value="10.5"
                            checked={trainerSpeed === "10.5"}
                            onChange={() => {
                                setTrainerSpeed("10.5");
                                handleSaveSettings(
                                    settingsNickname,
                                    settingsTitleLang,
                                    ratingMode,
                                    showUnreleased,
                                    "10.5",
                                );
                            }}
                            style={{ marginRight: "0.5rem" }}
                        />
                        10.5
                    </label>
                    <label
                        className={`checkbox-label ${trainerSpeed === "10.0" ? "active-ap" : ""}`}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            borderColor: trainerSpeed === "10.0" ? "#c77dff" : "",
                            background: trainerSpeed === "10.0" ? "rgba(199,125,255,0.08)" : "",
                        }}
                    >
                        <input
                            type="radio"
                            name="trainerSpeed"
                            value="10.0"
                            checked={trainerSpeed === "10.0"}
                            onChange={() => {
                                setTrainerSpeed("10.0");
                                handleSaveSettings(
                                    settingsNickname,
                                    settingsTitleLang,
                                    ratingMode,
                                    showUnreleased,
                                    "10.0",
                                );
                            }}
                            style={{ marginRight: "0.5rem" }}
                        />
                        10.0
                    </label>
                </div>
            </div>

            <div style={{ margin: "1.5rem 0", borderTop: "1px solid var(--border-color)" }} />

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
                    <div className="filter-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label className="filter-label" style={{ fontWeight: 700 }}>
                            닉네임
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
                    <div className="filter-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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

                    {/* Status message feedback */}
                    {settingsMessage && (
                        <div
                            className="glass-panel"
                            style={{
                                padding: "0.75rem 1rem",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                color: settingsMessage.startsWith("⚠") ? "var(--color-danger)" : "var(--color-success)",
                                borderLeft: `4px solid ${settingsMessage.startsWith("⚠") ? "var(--color-danger)" : "var(--color-success)"}`,
                            }}
                        >
                            {settingsMessage}
                        </div>
                    )}

                    {/* Password change section */}
                    <div>
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
