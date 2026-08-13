interface FeedbackFooterProps {
  pageTitle?: string;
  route?: string;
  variant?: "compact" | "full";
}

export function FeedbackFooter({ pageTitle, route, variant = "full" }: FeedbackFooterProps) {
  void route;
  const isCompact = variant === "compact";

  return (
    <section className={`bg-bg-app-soft border border-neutral-gray-200 rounded-3xl p-6 text-center w-full ${isCompact ? "max-w-xl" : "max-w-2xl"} mx-auto mt-8`}>
      <p className="text-xs font-bold tracking-wider text-text-muted">PROVIDER_NOT_CONFIGURED</p>
      <h3 className={`${isCompact ? "text-base" : "text-lg"} font-bold font-serif text-navy-900 mt-2`}>
        Feedback{pageTitle ? ` für ${pageTitle}` : ""} ist noch nicht angebunden
      </h3>
      <p className="text-xs text-text-muted mt-2">
        Ohne bestätigten serverseitigen Speichervertrag wird kein Feedback angenommen.
      </p>
    </section>
  );
}
