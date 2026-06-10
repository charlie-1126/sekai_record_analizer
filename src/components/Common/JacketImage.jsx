import React, { useState, useEffect } from "react";
import { Music } from "lucide-react";

export const JacketImage = ({ songId, size = 50, className = "", style = {} }) => {
    const [imgSrc, setImgSrc] = useState(`/api/jackets/${songId}`);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setImgSrc(`/api/jackets/${songId}`);
        setFailed(false);
    }, [songId]);

    if (failed) {
        return (
            <div
                className={className}
                style={{
                    width: size,
                    height: size,
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, rgba(255,0,127,0.15), rgba(0,242,254,0.15))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-color)",
                    ...style,
                }}
            >
                <Music size={size * 0.4} style={{ color: "var(--color-cyan)" }} />
            </div>
        );
    }

    return (
        <img
            src={imgSrc}
            alt="Jacket"
            onError={() => setFailed(true)}
            className={className}
            style={{
                width: size,
                height: size,
                borderRadius: "8px",
                objectFit: "cover",
                border: "1px solid var(--border-color)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                ...style,
            }}
        />
    );
};
