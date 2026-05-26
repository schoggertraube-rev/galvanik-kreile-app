export function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) return "Guten Morgen, Meister!";
  if (hour >= 11 && hour < 14) return "Willkommen zurück vom Essen!";
  if (hour >= 14 && hour < 18) return "Willkommen zurück, Meister!";
  if (hour >= 18 && hour < 23) return "Guten Abend, Meister!";
  return "Ruhige Nachtschicht, Meister!";
}
