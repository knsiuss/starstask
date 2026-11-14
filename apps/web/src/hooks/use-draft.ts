"use client";

import { useState } from "react";

/** Draft autosave to localStorage so typing survives page navigation. */
export function useDraft(key: string) {
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(`draft:${key}`) ?? "";
  });

  function updateDraft(value: string) {
    setDraft(value);
    if (value) {
      window.localStorage.setItem(`draft:${key}`, value);
    } else {
      window.localStorage.removeItem(`draft:${key}`);
    }
  }

  function clearDraft() {
    setDraft("");
    window.localStorage.removeItem(`draft:${key}`);
  }

  return { draft, updateDraft, clearDraft };
}
