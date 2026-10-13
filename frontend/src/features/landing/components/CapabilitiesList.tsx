import { useTranslation } from "react-i18next";

const CAPABILITIES = [
  "capabilities.semanticSearch",
  "capabilities.objectDetection",
  "capabilities.visualSimilarity",
  "capabilities.autoCuration",
  "capabilities.duplicateDetection",
  "capabilities.smartRetouch",
];

export function CapabilitiesList() {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t("capabilities.pipelineTitle", "Pipeline xử lý")}
          </h3>
          <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">
            {t(
              "capabilities.pipelineBody",
              "Mỗi ảnh tải lên đi qua ba mô hình thị giác trước khi xuất hiện trong thư viện của bạn.",
            )}
          </p>
        </div>

        <ul className="space-y-1 text-right font-mono text-sm uppercase tracking-widest">
          {CAPABILITIES.map((key) => (
            <li
              key={key}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
