import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import translationVI from "./locales/vi/translation.json";
import translationEN from "./locales/en/translation.json";

const resources = {
  vi: { translation: translationVI },
  en: { translation: translationEN },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "vi", // Ngôn ngữ dùng khi không phát hiện được hoặc thiếu key

    // Cấu hình cho LanguageDetector
    detection: {
      // 1. Thứ tự kiểm tra ngôn ngữ
      order: ["querystring", "localStorage", "cookie", "navigator", "htmlTag"],

      // 2. Tên của tham số URL hoặc Key lưu trữ
      lookupQuerystring: "lang", // URL dạng: example.com/?lang=en
      lookupLocalStorage: "app_language", // Lưu vào LocalStorage với key 'app_language'
      lookupCookie: "i18next",

      // 3. Nơi sẽ LƯU LẠI ngôn ngữ khi gọi hàm i18n.changeLanguage('en')
      caches: ["localStorage", "cookie"], // Lưu vào cả LocalStorage và Cookie

      // 4. Thời gian sống của Cookie (tính bằng phút)
      cookieMinutes: 10080, // 7 ngày

      // 5. Bỏ qua các ngôn ngữ không hỗ trợ (chỉ chấp nhận ngôn ngữ có trong resources)
      checkWhitelist: true,
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
