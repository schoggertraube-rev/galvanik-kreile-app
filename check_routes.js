const urls = [
  "https://galvanik-kreile-werkstatt.vercel.app",
  "https://galvanik-kreile-werkstatt.vercel.app/warendurchlauf",
  "https://galvanik-kreile-werkstatt.vercel.app/warendurchlauf/wareneingang",
  "https://galvanik-kreile-werkstatt.vercel.app/performance"
];

async function check() {
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      console.log(`[${res.status}] ${url}`);
    } catch (e) {
      console.log(`[ERROR] ${url} : ${e.message}`);
    }
  }
}

check();
