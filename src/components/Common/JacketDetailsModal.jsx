import React from "react";
import { JacketImage } from "./JacketImage";
import { getSongTitle, getConstant } from "../../utils/ratingUtils";
import { isNewSong, formatPublishedDate } from "../../utils/potentialUtils";
import { ExternalLink } from "lucide-react";

export default function JacketDetailsModal({
    selectedJacketSong,
    setSelectedJacketSong,
    settingsTitleLang,
    handleScoreChange,
}) {
    if (!selectedJacketSong) return null;

    const { song, diff, status } = selectedJacketSong;

    return (
        <div className="modal-backdrop" onClick={() => setSelectedJacketSong(null)}>
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "450px", width: "100%", padding: "2rem" }}
            >
                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", alignItems: "center" }}>
                    <JacketImage
                        songId={song.id}
                        size={140}
                        style={{ borderRadius: "8px", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}
                    />
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                            minWidth: 0,
                            flex: 1,
                        }}
                    >
                        <div
                            style={{
                                fontSize: "1.15rem",
                                fontWeight: "700",
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                            title={getSongTitle(song, settingsTitleLang)}
                        >
                            {getSongTitle(song, settingsTitleLang)}
                        </div>
                        <div
                            style={{
                                fontSize: "0.85rem",
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            작곡: {song.composer || "-"}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            난이도:{" "}
                            <span
                                className={`diff-badge diff-${diff}`}
                                style={{
                                    display: "inline-block",
                                    padding: "0.1rem 0.4rem",
                                    borderRadius: "4px",
                                    fontWeight: "700",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                }}
                            >
                                {diff.toUpperCase()}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            레벨: <strong>{song.levels[diff] || "-"}</strong>
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            상수: <strong>{getConstant(song, diff, "full_combo").toFixed(1)}</strong>(FC) /{" "}
                            <strong>{getConstant(song, diff, "full_perfect").toFixed(1)}</strong>(AP)
                        </div>
                        {/* 출시일 정보 */}
                        {song.publishedAt && (
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-secondary)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                }}
                            >
                                출시일: <strong>{formatPublishedDate(song.publishedAt)}</strong>
                                {isNewSong(song) && (
                                    <span
                                        style={{
                                            display: "inline-block",
                                            background: "linear-gradient(135deg, #ff4545ed, #f42516)",
                                            color: "#ffffff",
                                            fontWeight: 800,
                                            fontSize: "0.6rem",
                                            padding: "0.1rem 0.35rem",
                                            borderRadius: "4px",
                                            letterSpacing: "0.05em",
                                        }}
                                    >
                                        NEW
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                        {[
                            {
                                value: "none",
                                label: "NC",
                                color: "var(--text-muted)",
                                bg: "rgba(255,255,255,0.05)",
                                border: "var(--border-color)",
                            },
                            {
                                value: "clear",
                                label: "C",
                                color: "var(--color-clear)",
                                bg: "rgba(251, 191, 36, 0.1)",
                                border: "rgba(251, 191, 36, 0.3)",
                            },
                            {
                                value: "full_combo",
                                label: "FC",
                                color: "var(--color-fc)",
                                bg: "rgba(192, 132, 252, 0.1)",
                                border: "rgba(192, 132, 252, 0.3)",
                            },
                            {
                                value: "full_perfect",
                                label: "AP",
                                color: "var(--color-ap)",
                                bg: "rgba(56, 189, 248, 0.1)",
                                border: "rgba(56, 189, 248, 0.3)",
                            },
                        ].map((opt) => {
                            const isActive = status === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    className="btn"
                                    style={{
                                        padding: "0.6rem 0.5rem",
                                        fontSize: "0.85rem",
                                        background: isActive ? opt.color : opt.bg,
                                        color: isActive ? "#060913" : opt.color,
                                        border: `1px solid ${isActive ? opt.color : opt.border}`,
                                        fontWeight: "700",
                                        boxShadow: isActive ? `0 0 10px ${opt.color}40` : "none",
                                    }}
                                    onClick={() => {
                                        handleScoreChange(song.id, diff, opt.value);
                                        setSelectedJacketSong({
                                            ...selectedJacketSong,
                                            status: opt.value,
                                        });
                                    }}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    <a
                        href={`https://asset.rilaksekai.com/charts/${String(song.id).padStart(3, "0")}/${diff.toLowerCase()}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                        style={{
                            width: "100%",
                            textDecoration: "none",
                            boxSizing: "border-box",
                            marginTop: "0.25rem",
                        }}
                    >
                        <span>채보</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
