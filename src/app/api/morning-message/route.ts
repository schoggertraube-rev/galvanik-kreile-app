import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET(request: Request) {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context") || "morning";

  // Simulate gathering stats from database or local repositories
  let temp = 20;
  let code = 0;
  
  try {
    const weatherRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=50.1109&longitude=8.6821&current_weather=true"
    );
    const data = await weatherRes.json();
    temp = Math.round(data?.current_weather?.temperature ?? 20);
    code = data?.current_weather?.weathercode ?? 0;
  } catch (e) {
    console.warn("API Weather fetch failed, using default values");
  }

  const hour = new Date().getHours();
  let message = "";

  if (context === "end-of-day" || hour >= 15) {
    message = "Gleich feierabend! 🍺 Salzsäure bestellen nicht vergessen und dann: wohlverdient Feierabend.";
    if (code >= 51 && code <= 67) {
      message = "Regen über Frankfurt. Perfekter Abend, um es sich drinnen gemütlich zu machen! 🛋️";
    }
  } else {
    // Morning/default message
    if (code >= 51 && code <= 67) {
      message = `Draußen Schmuddel bei ${temp}°C – guter Tag, drinnen ein paar liegengebliebene Aufträge abzuhaken. ☕`;
    } else {
      message = `Heute: ${temp}°C und perfektes Wetter! Ein toller Tag, um abends noch kurz an den Main zu gehen. 🍺`;
    }
  }

  return NextResponse.json({ message, temp, code });
}
