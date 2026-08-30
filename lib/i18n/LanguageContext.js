"use client";

import { createContext, useContext, useEffect, useState } from "react";
import ko from "../../messages/ko.json";
import en from "../../messages/en.json";

const messages = { ko, en };

const LanguageContext = createContext({
  lang: "ko",
  setLang: () => {},
  t: (key) => key,
});

function getNested(obj, path) {
  return path
    .split(".")
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("ko");

  useEffect(() => {
    const stored = window.localStorage.getItem("preferred_language");
    if (stored && messages[stored]) {
      setLangState(stored);
    }
  }, []);

  function setLang(newLang) {
    if (!messages[newLang]) return;
    setLangState(newLang);
    window.localStorage.setItem("preferred_language", newLang);
  }

  function t(key) {
    const value = getNested(messages[lang], key);
    if (value !== undefined) return value;
    const fallback = getNested(messages.ko, key);
    return fallback !== undefined ? fallback : key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
