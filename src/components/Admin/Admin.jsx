import React, { useState, useEffect } from "react";
import { Users } from "lucide-react";

export default function Admin({ currentUser }) {
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminError, setAdminError] = useState("");

    const fetchAdminUsers = async () => {
        if (!currentUser || !currentUser.token) return;
        setAdminLoading(true);
        setAdminError("");
        try {
            const res = await fetch("/api/admin/users", {
                headers: {
                    Authorization: `Bearer ${currentUser.token}`,
                },
            });
            const data = await res.json();
            if (res.ok) {
                setAdminUsers(data.users || []);
            } else {
                setAdminError(data.error || "회원 목록을 불러오는데 실패했습니다.");
            }
        } catch (err) {
            console.error(err);
            setAdminError("서버와의 통신 오류가 발생했습니다.");
        } finally {
            setAdminLoading(false);
        }
    };

    const deleteAdminUser = async (username, nickname) => {
        if (!currentUser || !currentUser.token) return;
        if (
            !window.confirm(
                `정말 ${nickname}님(${username})의 회원 정보를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
            )
        )
            return;

        try {
            const res = await fetch(`/api/admin/users/${username}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${currentUser.token}`,
                },
            });
            const data = await res.json();
            if (res.ok) {
                alert("회원이 성공적으로 삭제되었습니다.");
                fetchAdminUsers();
            } else {
                alert(data.error || "회원 삭제에 실패했습니다.");
            }
        } catch (err) {
            console.error(err);
            alert("서버 통신 오류가 발생했습니다.");
        }
    };

    const resetAdminUserPassword = async (username, nickname) => {
        if (!currentUser || !currentUser.token) return;
        if (!window.confirm(`정말 ${nickname}님(${username})의 비밀번호를 "password"로 초기화하시겠습니까?`)) return;

        try {
            const res = await fetch(`/api/admin/users/${username}/reset-password`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${currentUser.token}`,
                },
            });
            const data = await res.json();
            if (res.ok) {
                alert("비밀번호가 성공적으로 초기화되었습니다.");
            } else {
                alert(data.error || "비밀번호 초기화에 실패했습니다.");
            }
        } catch (err) {
            console.error(err);
            alert("서버 통신 오류가 발생했습니다.");
        }
    };

    useEffect(() => {
        if (currentUser && currentUser.username.toLowerCase() === "admin") {
            fetchAdminUsers();
        }
    }, [currentUser]);

    if (!currentUser || currentUser.username.toLowerCase() !== "admin") {
        return (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-muted)" }}>
                권한이 없습니다. 관리자 계정으로 로그인해 주세요.
            </div>
        );
    }

    return (
        <section className="glass-panel" style={{ padding: "2.5rem" }}>
            <div className="section-title-bar" style={{ marginBottom: "2rem" }}>
                <h2 className="section-title">
                    <Users size={22} style={{ color: "var(--color-pink)", marginRight: "0.5rem" }} /> 회원 관리
                </h2>
                <button className="btn btn-outline btn-sm" onClick={fetchAdminUsers}>
                    새로고침
                </button>
            </div>

            {adminLoading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    회원 데이터를 로딩하는 중입니다...
                </div>
            ) : adminError ? (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ color: "var(--color-danger)", marginBottom: "1rem" }}>{adminError}</p>
                    <button className="btn btn-outline" onClick={fetchAdminUsers}>
                        다시 시도
                    </button>
                </div>
            ) : (
                <div className="record-list-container" style={{ marginTop: "1rem" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr
                                    style={{
                                        borderBottom: "1px solid var(--border-color)",
                                        paddingBottom: "1rem",
                                    }}
                                >
                                    <th
                                        style={{
                                            padding: "1rem 0.5rem",
                                            color: "var(--text-secondary)",
                                            fontWeight: "600",
                                        }}
                                    >
                                        #
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem 0.5rem",
                                            color: "var(--text-secondary)",
                                            fontWeight: "600",
                                        }}
                                    >
                                        아이디
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem 0.5rem",
                                            color: "var(--text-secondary)",
                                            fontWeight: "600",
                                        }}
                                    >
                                        닉네임
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem 0.5rem",
                                            color: "var(--text-secondary)",
                                            fontWeight: "600",
                                        }}
                                    >
                                        가입 일자
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem 0.5rem",
                                            color: "var(--text-secondary)",
                                            fontWeight: "600",
                                            textAlign: "center",
                                        }}
                                    >
                                        관리
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {adminUsers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            style={{
                                                padding: "3rem",
                                                textAlign: "center",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            가입된 일반 회원이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    adminUsers.map((user, idx) => {
                                        const formattedDate = user.created_at
                                            ? new Date(user.created_at).toLocaleString("ko-KR", {
                                                  year: "numeric",
                                                  month: "2-digit",
                                                  day: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                              })
                                            : "-";
                                        const isAdmin = user.username.toLowerCase() === "admin";

                                        return (
                                            <tr
                                                key={user.username}
                                                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                                            >
                                                <td style={{ padding: "0.75rem 0.5rem" }}>{idx + 1}</td>
                                                <td
                                                    style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}
                                                >
                                                    {user.username}
                                                </td>
                                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                                    {user.nickname}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.75rem 0.5rem",
                                                        color: "var(--text-muted)",
                                                        fontSize: "0.85rem",
                                                    }}
                                                >
                                                    {formattedDate}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "0.75rem 0.5rem",
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {isAdmin ? (
                                                        <span
                                                            style={{
                                                                fontSize: "0.85rem",
                                                                color: "var(--color-pink)",
                                                                fontWeight: "700",
                                                            }}
                                                        >
                                                            최고 관리자
                                                        </span>
                                                    ) : (
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                gap: "0.5rem",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            <button
                                                                className="btn btn-outline btn-sm"
                                                                style={{
                                                                    borderColor: "rgba(139, 92, 246, 0.4)",
                                                                    color: "var(--color-purple)",
                                                                    padding: "0.2rem 0.5rem",
                                                                    fontSize: "0.8rem",
                                                                }}
                                                                onClick={() =>
                                                                    resetAdminUserPassword(
                                                                        user.username,
                                                                        user.nickname,
                                                                    )
                                                                }
                                                            >
                                                                비번 초기화
                                                            </button>
                                                            <button
                                                                className="btn btn-outline btn-sm"
                                                                style={{
                                                                    borderColor: "rgba(239, 68, 68, 0.4)",
                                                                    color: "var(--color-danger)",
                                                                    padding: "0.2rem 0.5rem",
                                                                    fontSize: "0.8rem",
                                                                }}
                                                                onClick={() =>
                                                                    deleteAdminUser(
                                                                        user.username,
                                                                        user.nickname,
                                                                    )
                                                                }
                                                            >
                                                                회원 삭제
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
