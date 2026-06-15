import { useState, useEffect } from "react";

export function useSessionState(key, initialValue) {
    const [state, setState] = useState(() => {
        try {
            const item = window.sessionStorage.getItem(key);
            if (item !== null) {
                return JSON.parse(item);
            }
            return typeof initialValue === "function" ? initialValue() : initialValue;
        } catch (error) {
            console.error("Error reading sessionStorage key", key, error);
            return typeof initialValue === "function" ? initialValue() : initialValue;
        }
    });

    useEffect(() => {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error("Error writing sessionStorage key", key, error);
        }
    }, [key, state]);

    return [state, setState];
}
