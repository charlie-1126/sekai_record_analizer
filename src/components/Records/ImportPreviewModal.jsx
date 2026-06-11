import React from "react";
import { ChevronRight } from "lucide-react";

export default function ImportPreviewModal({
    isOpen,
    onCancel,
    onConfirm,
    previewCalculatedData,
    playerRating,
    playerAppendRating,
    overallStats,
}) {
    if (!isOpen || !previewCalculatedData) return null;

    const renderDelta = (delta, small = false) => {
        if (delta > 0) {
            return (
                <span
                    style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--color-success)", fontWeight: 700 }}
                >
                    ▲ +{delta}
                </span>
            );
        } else if (delta < 0) {
            return (
                <span
                    style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--color-danger)", fontWeight: 700 }}
                >
                    ▼ {delta}
                </span>
            );
        }
        return (
            <span style={{ fontSize: small ? "0.75rem" : "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                0
            </span>
        );
    };

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "550px", width: "100%", padding: "2rem" }}
            >
                <div
                    className="preview-comparison-grid"
                    style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}
                >
                    {/* 일반 셐포스 레이팅 */}
                    <div
                        className="preview-row"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: "8px",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>일반 셐포스 레이팅 (B39)</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span
                                style={{
                                    color: "var(--text-muted)",
                                    textDecoration: "line-through",
                                    fontSize: "0.9rem",
                                }}
                            >
                                {playerRating}
                            </span>
                            <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                            <span style={{ fontWeight: 800, color: "var(--color-cyan)", fontSize: "1.1rem" }}>
                                {previewCalculatedData.playerRating}
                            </span>
                            {renderDelta(previewCalculatedData.playerRating - playerRating)}
                        </div>
                    </div>

                    {/* 어펜드 레이팅 */}
                    <div
                        className="preview-row"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: "8px",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>어펜드 레이팅 (B15)</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span
                                style={{
                                    color: "var(--text-muted)",
                                    textDecoration: "line-through",
                                    fontSize: "0.9rem",
                                }}
                            >
                                {playerAppendRating}
                            </span>
                            <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                            <span style={{ fontWeight: 800, color: "var(--color-append)", fontSize: "1.1rem" }}>
                                {previewCalculatedData.playerAppendRating}
                            </span>
                            {renderDelta(previewCalculatedData.playerAppendRating - playerAppendRating)}
                        </div>
                    </div>

                    {/* 플레이 통계 비교 */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "0.75rem",
                            marginTop: "0.5rem",
                        }}
                    >
                        <div
                            style={{
                                textAlign: "center",
                                padding: "0.75rem",
                                background: "rgba(255,255,255,0.01)",
                                borderRadius: "8px",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.25rem",
                                    fontWeight: 700,
                                }}
                            >
                                AP
                            </div>
                            <div
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: 800,
                                    color: "var(--color-ap)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.1rem",
                                    alignItems: "center",
                                }}
                            >
                                <span>{previewCalculatedData.stats.apCount}개</span>
                                {renderDelta(previewCalculatedData.stats.apCount - overallStats.apCount, true)}
                            </div>
                        </div>
                        <div
                            style={{
                                textAlign: "center",
                                padding: "0.75rem",
                                background: "rgba(255,255,255,0.01)",
                                borderRadius: "8px",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.25rem",
                                    fontWeight: 700,
                                }}
                            >
                                FC
                            </div>
                            <div
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: 800,
                                    color: "var(--color-fc)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.1rem",
                                    alignItems: "center",
                                }}
                            >
                                <span>{previewCalculatedData.stats.fcCount}개</span>
                                {renderDelta(previewCalculatedData.stats.fcCount - overallStats.fcCount, true)}
                            </div>
                        </div>
                        <div
                            style={{
                                textAlign: "center",
                                padding: "0.75rem",
                                background: "rgba(255,255,255,0.01)",
                                borderRadius: "8px",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.25rem",
                                    fontWeight: 700,
                                }}
                            >
                                C
                            </div>
                            <div
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: 800,
                                    color: "var(--color-clear)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.1rem",
                                    alignItems: "center",
                                }}
                            >
                                <span>{previewCalculatedData.stats.clearCount}개</span>
                                {renderDelta(previewCalculatedData.stats.clearCount - overallStats.clearCount, true)}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>
                        취소
                    </button>
                    <button className="btn btn-primary animate-glow" style={{ flex: 1 }} onClick={onConfirm}>
                        적용하기
                    </button>
                </div>
            </div>
        </div>
    );
}
