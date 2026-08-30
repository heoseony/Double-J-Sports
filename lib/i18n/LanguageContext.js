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

  function t(key, vars) {
    const value = getNested(messages[lang], key);
    const fallback = getNested(messages.ko, key);
    let result = value !== undefined ? value : fallback;
    if (result === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        result = result.replace(`{${k}}`, vars[k]);
      });
    }
    return result;
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
