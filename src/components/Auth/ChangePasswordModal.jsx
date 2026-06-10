import React, { useState } from "react";
import { X } from "lucide-react";

export default function ChangePasswordModal({ isOpen, onClose, token }) {
    const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
    const [changeNewPassword, setChangeNewPassword] = useState("");
    const [changeConfirmPassword, setChangeConfirmPassword] = useState("");
    const [changePasswordMessage, setChangePasswordMessage] = useState("");

    if (!isOpen) return null;

    const handleChangePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!token) return;
        if (!changeCurrentPassword || !changeNewPassword || !changeConfirmPassword) {
            setChangePasswordMessage("⚠ 모든 빈칸을 입력해주세요.");
            return;
        }
        if (changeNewPassword !== changeConfirmPassword) {
            setChangePasswordMessage("⚠ 새 비밀번호와 확인이 일치하지 않습니다.");
            return;
        }

        setChangePasswordMessage("");
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: changeCurrentPassword,
                    newPassword: changeNewPassword,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                alert("비밀번호가 성공적으로 변경되었습니다.");
                setChangeCurrentPassword("");
                setChangeNewPassword("");
                setChangeConfirmPassword("");
                setChangePasswordMessage("");
                onClose();
            } else {
                setChangePasswordMessage(`⚠ ${data.error || "비밀번호 변경 실패"}`);
            }
        } catch (err) {
            console.error(err);
            setChangePasswordMessage("⚠ 서버 통신 오류가 발생했습니다.");
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "400px", width: "100%", padding: "2rem", position: "relative" }}
            >
                {/* Close button */}
                <button
                    className="btn-close"
                    style={{
                        position: "absolute",
                        top: "1.25rem",
                        right: "1.25rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                    }}
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <X size={20} />
                </button>

                <h3
                    style={{
                        fontSize: "1.5rem",
                        marginBottom: "1.5rem",
                        background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-pink) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        textAlign: "center",
                    }}
                >
                    비밀번호 변경
                </h3>

                <form
                    onSubmit={handleChangePasswordSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
                >
                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label">현재 비밀번호</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="현재 비밀번호"
                            value={changeCurrentPassword}
                            onChange={(e) => setChangeCurrentPassword(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </div>

                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label">새 비밀번호</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="새 비밀번호"
                            value={changeNewPassword}
                            onChange={(e) => setChangeNewPassword(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </div>

                    <div
                        className="filter-group"
                        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    >
                        <label className="filter-label">새 비밀번호 확인</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="새 비밀번호 확인"
                            value={changeConfirmPassword}
                            onChange={(e) => setChangeConfirmPassword(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </div>

                    {changePasswordMessage && (
                        <div
                            style={{
                                color: changePasswordMessage.startsWith("⚠")
                                    ? "var(--color-danger)"
                                    : "var(--color-success)",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                textAlign: "center",
                            }}
                        >
                            {changePasswordMessage}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary animate-glow" style={{ width: "100%" }}>
                        비밀번호 수정
                    </button>
                </form>
            </div>
        </div>
    );
}
