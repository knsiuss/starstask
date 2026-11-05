"use client";

import { useEffect, useState } from "react";

/** Draft autosave to localStorage — ketikan nggak hilang kalau pindah page. */
export function useDraft(key: string) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(`draft:${key}`);
    if (saved) setDraft(saved);
  }, [key]);

  function updateDraft(value: string) {
    setDraft(value);
    if (value) {
      localStorage.setItem(`draft:${key}`, value);
    } else {
      localStorage.removeItem(`draft:${key}`);
    }
  }

  function clearDraft() {
    setDraft("");
    localStorage.removeItem(`draft:${key}`);
  }

  return { draft, updateDraft, clearDraft };
}
