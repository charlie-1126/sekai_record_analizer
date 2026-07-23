import React from "react";
import { X, Download, ShieldCheck, Database, Calendar } from "lucide-react";

export default function ExportModal({ isOpen, onClose, onExportSekaforce, onExportProprietary }) {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "500px", width: "100%", padding: "2rem", position: "relative" }}
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0.25rem",
                        borderRadius: "50%",
                        transition: "background-color 0.2s",
                    }}
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <X size={20} />
                </button>

                <div
                    style={{
                        textAlign: "center",
                        marginBottom: "2rem",
                    }}
                >
                    <h3
                        style={{
                            fontSize: "1.5rem",
                            margin: "0 0 0.5rem 0",
                            background: "linear-gradient(135deg, var(--color-cyan) 0%, var(--color-pink) 100%)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 800,
                        }}
                    >
                        데이터 내보내기 형식 선택
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                        원하는 파일의 형식을 선택하여 플레이 데이터를 다운로드하세요.
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {/* Option 1: Sekaforce Compatible Format */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1.25rem",
                            borderRadius: "12px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(255, 255, 255, 0.01)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                            transition: "all 0.3s ease",
                            cursor: "pointer",
                        }}
                        onClick={() => {
                            onExportSekaforce();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--color-cyan)";
                            e.currentTarget.style.background = "rgba(0, 242, 254, 0.02)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.01)";
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Database size={18} style={{ color: "var(--color-cyan)" }} />
                            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-cyan)" }}>
                                셐포스 규격
                            </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                            셐포스 사이트 연동을 위한 표준 JSON 형식입니다.
                            <br />
                            <strong style={{ color: "var(--color-danger)" }}>
                                ※ 성과 달성 날짜 데이터가 제외됩니다.
                            </strong>
                        </p>
                        <button
                            className="btn btn-outline"
                            style={{
                                width: "100%",
                                padding: "0.5rem 1rem",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.35rem",
                                borderColor: "rgba(0, 242, 254, 0.4)",
                                color: "var(--color-cyan)",
                                marginTop: "0.25rem",
                            }}
                        >
                            <Download size={14} /> 셐포스 규격 다운로드
                        </button>
                    </div>

                    {/* Option 2: Sekaitool Proprietary Format */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: "1.25rem",
                            borderRadius: "12px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(255, 255, 255, 0.01)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                            transition: "all 0.3s ease",
                            cursor: "pointer",
                        }}
                        onClick={() => {
                            onExportProprietary();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--color-pink)";
                            e.currentTarget.style.background = "rgba(244, 63, 94, 0.02)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.01)";
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Calendar size={18} style={{ color: "var(--color-pink)" }} />
                            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-pink)" }}>
                                sekaitool 규격
                            </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                            곡별 성과(FC/AP)를 달성한 구체적인 날짜 데이터까지 모두 포함하는 전체 백업용 JSON
                            파일입니다. 이 프로그램에서 데이터 백업 및 복구 시 권장합니다.
                        </p>
                        <button
                            className="btn btn-outline"
                            style={{
                                width: "100%",
                                padding: "0.5rem 1rem",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.35rem",
                                borderColor: "rgba(244, 63, 94, 0.4)",
                                color: "var(--color-pink)",
                                marginTop: "0.25rem",
                            }}
                        >
                            <Download size={14} /> sekaitool 규격 다운로드
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                    <button
                        className="btn btn-outline"
                        style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
                        onClick={onClose}
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}
