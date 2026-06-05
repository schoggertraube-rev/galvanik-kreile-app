export function getGreeting(date = new Date(), role = "Meister") {
  const hour = date.getHours();
  
  // Map roles to displays
  let roleDisplay = role || "Meister";
  if (role === "admin" || role === "developer" || role === "inhaber") roleDisplay = "Admin";
  else if (role === "werkstatt") roleDisplay = "Werkstatt";
  else if (role === "buero") roleDisplay = "Büro";
  else if (role === "meister") roleDisplay = "Meister";
  
  // Capitalize first letter if it's something else
  roleDisplay = roleDisplay.charAt(0).toUpperCase() + roleDisplay.slice(1);

  if (hour >= 4 && hour < 11) {
    return { text: `Guten Morgen, ${roleDisplay}!`, emoji: "👋" };
  } else if (hour >= 11 && hour < 14) {
    return { text: `Mahlzeit, ${roleDisplay}!`, emoji: "🍽" };
  } else if (hour >= 14 && hour < 18) {
    return { text: `Schönen Nachmittag, ${roleDisplay}!`, emoji: "☀️" };
  } else if (hour >= 18 && hour < 22) {
    return { text: `Guten Abend, ${roleDisplay}!`, emoji: "🌙" };
  } else {
    return { text: `Späte Schicht, ${roleDisplay}.`, emoji: "🌙" };
  }
}
