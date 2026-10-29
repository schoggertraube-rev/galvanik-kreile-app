export function getGreeting(date = new Date(), displayName = "") {
  const hour = date.getHours();
  const greetingName = displayName.trim();
  const suffix = greetingName ? `, ${greetingName}` : "";

  if (hour >= 4 && hour < 11) {
    return { text: `Guten Morgen${suffix}!`, emoji: "👋" };
  } else if (hour >= 11 && hour < 14) {
    return { text: `Mahlzeit${suffix}!`, emoji: "🍽" };
  } else if (hour >= 14 && hour < 18) {
    return { text: `Schönen Nachmittag${suffix}!`, emoji: "☀️" };
  } else if (hour >= 18 && hour < 22) {
    return { text: `Guten Abend${suffix}!`, emoji: "🌙" };
  } else {
    return { text: `Späte Schicht${suffix}.`, emoji: "🌙" };
  }
}
